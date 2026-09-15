// routes/tech.js — Rapports techniques : tournées, évacuations, désinfections, consommations
// Périmètres : le technicien crée/voit SES rapports ; admintech voit ceux de son équipe ;
// la direction voit tout ; commercial (agent) et admincomm : hors périmètre (403).
const express = require('express');
const db = require('../db');
const { requireAuth, isTechnician, isSuper, TECH_TEAM } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Accès réservé aux profils techniques (technicien, superviseur technique) et à la direction.
// Les commerciaux (agent) et le superviseur commercial sont hors périmètre.
router.use((req, res, next) => {
  if (req.user.role === 'agent' || req.user.role === 'admincomm') {
    return res.status(403).json({ error: 'Rapports techniques : hors de votre périmètre.' });
  }
  next();
});

// Bornes métier : une saisie hors de ces limites est refusée (évite de corrompre les statistiques)
const MAX_QTY = 100000;

// GET /api/tech/summary — compilation technique (technicien / admintech / direction)
router.get('/summary', (req, res) => {
  const roles = TECH_TEAM;
  const rolePh = roles.map(() => '?').join(',');
  const params = [...roles];

  const perTech = db.prepare(`
    SELECT u.id, u.full_name AS technicien, u.region,
      COALESCE(SUM(r.menages_servis), 0) AS menages_servis,
      COALESCE(SUM(r.poubelles_evacuees), 0) AS poubelles_evacuees,
      COALESCE(SUM(r.courses_camion), 0) AS courses_camion,
      COALESCE(SUM(r.desinfections), 0) AS desinfections,
      COALESCE(SUM(r.maisons_desinfectees), 0) AS maisons_desinfectees,
      COUNT(r.id) AS nb_rapports
    FROM users u LEFT JOIN tech_reports r ON r.user_id = u.id
    WHERE u.role IN (${rolePh}) GROUP BY u.id ORDER BY technicien`).all(...params);

  const totals = {
    menages_servis: perTech.reduce((a, x) => a + x.menages_servis, 0),
    poubelles_evacuees: perTech.reduce((a, x) => a + x.poubelles_evacuees, 0),
    courses_camion: perTech.reduce((a, x) => a + x.courses_camion, 0),
    desinfections: perTech.reduce((a, x) => a + x.desinfections, 0),
    maisons_desinfectees: perTech.reduce((a, x) => a + x.maisons_desinfectees, 0)
  };

  const consos = db.prepare(`
    SELECT p.id AS product_id, p.name AS produit, p.category,
      COALESCE(SUM(it.quantite_utilisee), 0) AS quantite_utilisee,
      COALESCE(SUM(it.etat_de_besoin), 0) AS etat_de_besoin
    FROM tech_report_items it
    JOIN products p ON p.id = it.product_id
    JOIN tech_reports r ON r.id = it.report_id
    JOIN users u ON u.id = r.user_id
    WHERE u.role IN (${rolePh})
    GROUP BY p.id ORDER BY etat_de_besoin DESC`).all(...params);

  const stock = db.prepare(`
    SELECT p.id AS product_id, COALESCE(SUM(si.quantity), 0) AS quantite_en_stock
    FROM products p LEFT JOIN stock_items si ON si.product_id = p.id
    WHERE p.category = 'Intrant' GROUP BY p.id`).all();
  const stockMap = {};
  stock.forEach((s) => { stockMap[s.product_id] = s.quantite_en_stock; });

  res.json({
    totals,
    per_tech: perTech,
    consos: consos.map((c) => ({ ...c, quantite_en_stock: stockMap[c.product_id] || 0 }))
  });
});

// GET /api/tech/reports — les rapports (les siens / son équipe / tout)
router.get('/reports', (req, res) => {
  const { date = '' } = req.query;
  const roles = TECH_TEAM;
  const rolePh = roles.map(() => '?').join(',');
  const cond = [`r.user_id IN (SELECT id FROM users WHERE role IN (${rolePh}))`];
  const params = [...roles];
  if (date) { cond.push('r.date = ?'); params.push(date); }
  const where = `WHERE ${cond.join(' AND ')}`;
  const reports = db.prepare(`
    SELECT r.*, u.full_name AS technicien
    FROM tech_reports r JOIN users u ON u.id = r.user_id
    ${where} ORDER BY r.date DESC, r.id DESC LIMIT 200`).all(...params);

  const itemsStmt = db.prepare(`
    SELECT it.*, p.name AS produit FROM tech_report_items it
    JOIN products p ON p.id = it.product_id WHERE it.report_id = ?`);
  const withItems = reports.map((r) => ({ ...r, items: itemsStmt.all(r.id) }));
  res.json(withItems);
});

// POST /api/tech/reports — créer le rapport du jour (technicien)
router.post('/reports', (req, res) => {
  const body = req.body || {};
  const { date, commentaire = '', items = [] } = body;

  const day = date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'Date invalide (format AAAA-MM-JJ).' });

  // Validation stricte des quantités : entier entre 0 et MAX_QTY (une valeur négative
  // ou aberrante est refusée au lieu d'être silencieusement corrigée/acceptée).
  const fields = ['menages_servis', 'poubelles_evacuees', 'courses_camion', 'desinfections', 'maisons_desinfectees'];
  const vals = {};
  for (const f of fields) {
    const raw = body[f];
    const v = (raw === undefined || raw === null || raw === '') ? 0 : Number(raw);
    if (!Number.isFinite(v) || v < 0 || v > MAX_QTY) {
      return res.status(400).json({ error: `Valeur invalide pour « ${f} » (nombre entre 0 et ${MAX_QTY}).` });
    }
    vals[f] = v;
  }

  const itemsArr = Array.isArray(items) ? items : [];
  for (const it of itemsArr) {
    const q = Number(it.quantite_utilisee || 0);
    const b = Number(it.etat_de_besoin || 0);
    if (!Number.isFinite(q) || q < 0 || q > MAX_QTY || !Number.isFinite(b) || b < 0 || b > MAX_QTY) {
      return res.status(400).json({ error: `Item invalide (quantité entre 0 et ${MAX_QTY}).` });
    }
  }

  const hasData = fields.some((f) => vals[f] > 0) || itemsArr.length > 0 || String(commentaire).trim().length > 0;
  if (!hasData) {
    return res.status(400).json({ error: 'Rapport vide : renseignez au moins une quantité, un intrant utilisé ou un commentaire.' });
  }

  const reportId = db.prepare(`
    INSERT INTO tech_reports (user_id, date, menages_servis, poubelles_evacuees, courses_camion, desinfections, maisons_desinfectees, commentaire)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(req.user.id, day, vals.menages_servis, vals.poubelles_evacuees, vals.courses_camion,
      vals.desinfections, vals.maisons_desinfectees, String(commentaire || '').slice(0, 2000)).lastInsertRowid;

  const insItem = db.prepare(`INSERT INTO tech_report_items (report_id, product_id, quantite_utilisee, etat_de_besoin) VALUES (?,?,?,?)`);
  const decStock = db.prepare('UPDATE stock_items SET quantity = quantity - ? WHERE id = ?');
  const insMove = db.prepare(`INSERT INTO stock_movements (product_id, agent_id, type, quantity, note) VALUES (?,?,?,?,?)`);
  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');

  let itemsCount = 0;
  for (const it of itemsArr) {
    const product = getProduct.get(it.product_id);
    if (!product) continue;
    const qte = Number(it.quantite_utilisee || 0);
    const besoin = Number(it.etat_de_besoin || 0);
    if (qte <= 0 && besoin <= 0) continue;
    insItem.run(reportId, product.id, qte, besoin);
    itemsCount++;
    const row = db.prepare(`
      SELECT * FROM stock_items WHERE product_id = ? AND ((agent_id = ?) OR (agent_id IS NULL))
      ORDER BY (agent_id = ?) DESC`).all(product.id, req.user.id, req.user.id).find((x) => x.quantity > 0);
    if (row && qte > 0) {
      const applied = Math.min(qte, row.quantity);
      decStock.run(applied, row.id);
      insMove.run(product.id, req.user.id, 'out', -applied, `Rapport du ${day} (technicien)`);
    }
  }

  res.status(201).json({ id: reportId, date: day, items: itemsCount });
});

// ============ TOURNÉES : le superviseur technique / la direction assignent, le technicien valide ============
router.post('/tournees', (req, res) => {
  if (!isSuper(req.user) && req.user.role !== 'admintech') return res.status(403).json({ error: 'Réservé au superviseur technique et à la direction.' });
  const { technicien_id, date, zone = '', menages_prevus = 0 } = req.body || {};
  const tech = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'technicien' AND active = 1").get(Number(technicien_id));
  if (!tech) return res.status(404).json({ error: 'Technicien introuvable ou inactif.' });
  const day = date || new Date().toISOString().slice(0, 10);
  const id = db.prepare(`INSERT INTO tournees (technicien_id, assignee_par, date, zone, menages_prevus) VALUES (?,?,?,?,?)`)
    .run(tech.id, req.user.id, day, String(zone || '').slice(0, 200), Math.max(0, Number(menages_prevus) || 0)).lastInsertRowid;
  res.status(201).json({ id, date: day, technicien_id: tech.id });
});

router.get('/tournees', (req, res) => {
  const roles = TECH_TEAM;
  const rolePh = roles.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT tr.*, u.full_name AS technicien, a.full_name AS assigne_par
    FROM tournees tr JOIN users u ON u.id = tr.technicien_id JOIN users a ON a.id = tr.assignee_par
    WHERE tr.technicien_id IN (SELECT id FROM users WHERE role IN (${rolePh}) AND active = 1)
    ORDER BY tr.date DESC, tr.id DESC LIMIT 200`).all(...roles);
  res.json(rows);
});

router.post('/tournees/:id/valider', (req, res) => {
  if (!isTechnician(req.user)) return res.status(403).json({ error: 'Réservé aux techniciens.' });
  const tour = db.prepare('SELECT * FROM tournees WHERE id = ?').get(Number(req.params.id));
  if (!tour) return res.status(404).json({ error: 'Tournée introuvable.' });
  if (tour.technicien_id !== req.user.id) return res.status(403).json({ error: 'Vous ne pouvez valider que vos propres tournées.' });
  if (tour.statut === 'validee') return res.status(400).json({ error: 'Cette tournée est déjà validée.' });
  const { menages_servis = 0, observations = '' } = req.body || {};
  db.prepare(`UPDATE tournees SET statut = 'validee', menages_servis = ?, observations = ? WHERE id = ?`)
    .run(Math.max(0, Number(menages_servis) || 0), String(observations || '').slice(0, 2000), tour.id);
  res.json({ ok: true, id: tour.id, statut: 'validee' });
});

// ============ DEMANDES DE MATÉRIEL : le technicien signale, le superviseur traite ============
router.post('/demandes', (req, res) => {
  if (!isTechnician(req.user)) return res.status(403).json({ error: 'Réservé aux techniciens.' });
  const { product_id, intrant, produit, quantite = 1, motif = '' } = req.body || {};
  // L'intrant peut être désigné par son identifiant OU par son nom (saisie terrain).
  let product = null;
  if (product_id !== undefined && product_id !== null && product_id !== '') {
    product = db.prepare("SELECT id FROM products WHERE id = ? AND category = 'Intrant'").get(Number(product_id));
  } else {
    const name = String(intrant || produit || '').trim();
    if (name) {
      product = db.prepare("SELECT id FROM products WHERE category = 'Intrant' AND name = ? COLLATE NOCASE").get(name)
        || db.prepare("SELECT id FROM products WHERE category = 'Intrant' AND name LIKE ? ORDER BY length(name) LIMIT 1").get('%' + name + '%');
    }
  }
  if (!product) return res.status(404).json({ error: "Intrant introuvable. Indiquez un product_id ou un nom d'intrant valide." });
  const q = Number(quantite);
  if (!Number.isFinite(q) || q <= 0) return res.status(400).json({ error: 'Quantité invalide.' });
  const id = db.prepare(`INSERT INTO tech_demandes (user_id, product_id, quantite, motif) VALUES (?,?,?,?)`)
    .run(req.user.id, product.id, q, String(motif || '').slice(0, 1000)).lastInsertRowid;
  res.status(201).json({ id });
});

router.get('/demandes', (req, res) => {
  if (req.user.role === 'admincomm') return res.status(403).json({ error: 'Demandes de matériel : hors de votre périmètre.' });
  const roles = TECH_TEAM;
  const rolePh = roles.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT d.*, u.full_name AS technicien, p.name AS produit
    FROM tech_demandes d JOIN users u ON u.id = d.user_id JOIN products p ON p.id = d.product_id
    WHERE d.user_id IN (SELECT id FROM users WHERE role IN (${rolePh}))
    ORDER BY (d.statut = 'ouverte') DESC, d.id DESC LIMIT 200`).all(...roles);
  res.json(rows);
});

router.post('/demandes/:id/traiter', (req, res) => {
  if (!isSuper(req.user) && req.user.role !== 'admintech') return res.status(403).json({ error: 'Réservé au superviseur technique et à la direction.' });
  const d = db.prepare('SELECT * FROM tech_demandes WHERE id = ?').get(Number(req.params.id));
  if (!d) return res.status(404).json({ error: 'Demande introuvable.' });
  db.prepare("UPDATE tech_demandes SET statut = 'traitee' WHERE id = ?").run(d.id);
  res.json({ ok: true, id: d.id });
});

module.exports = router;
