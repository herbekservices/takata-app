// routes/agent.js - Modules métier : dashboard, clients, prospects,
// abonnements (collecte), paiements/relances, commissions, notifications, stocks
const express = require('express');
const db = require('../db');
const { buildScheduleDates, localDateStr } = require('../dates');
const { requireAuth, isAdminLike, isTechnician, isCommercial, isSuper } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const isAdmin = isAdminLike;
// Garde : les actions commerciales (vente, encaissement, prospects) sont réservées
// Périmètres : données commerciales = direction + superviseur commercial ;
// données techniques = superviseur technique + techniciens.
const isCommercialScope = (u) => isSuper(u) || u.role === 'admincomm';
const isTechScope = (u) => u.role === 'admintech' || isTechnician(u);
const guardCommercial = (req, res, next) => {
  if (isTechScope(req.user)) return res.status(403).json({ error: 'Action réservée aux équipes commerciales.' });
  next();
};
// Énumérations métier validées côté route (les CHECK SQLite restent en filet de sécurité)
const CUSTOMER_STATUS = ['actif', 'installé', 'en attente', 'inactif'];
const PROSPECT_STATUS = ['nouveau', 'contacté', 'converti', 'perdu'];
const INSTALLATION_STATUS = ['planifiée', 'installé'];
const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank', 'card'];
const MAX_PAYMENT = 100000000; // 100 M F : garde-fou contre les montants aberrants
const str = (v, max = 500) => String(v ?? '').slice(0, max);
const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
// Garde d'appartenance : l'agent ne manipule que ses clients ; l'admin tout
function ownsCustomer(user, customer) {
return !!customer && (isCommercialScope(user) || customer.agent_id === user.id);
}

// ---- Tableau de bord ----
router.get('/dashboard', (req, res) => {
  const uid = req.user.id;
  // Vue opérationnelle technicien : tournées (abonnements en service), stock matériel
  if (isTechScope(req.user)) {
    const liveInstallations = db.prepare(`SELECT COUNT(*) c FROM installations WHERE status='installé'`).get().c;
    const planned = db.prepare(`SELECT COUNT(*) c FROM installations WHERE status='planifiée'`).get().c;
    const activeCustomers = db.prepare(`SELECT COUNT(*) c FROM customers WHERE status='installé'`).get().c;
    const stock = db.prepare(`SELECT si.product_id, si.quantity, p.name, p.category FROM stock_items si JOIN products p ON p.id=si.product_id WHERE si.quantity <= 10 ORDER BY si.quantity ASC LIMIT 5`).all();
    const stockAlerts = db.prepare(`SELECT COUNT(*) c FROM stock_items WHERE quantity <= 10`).get().c;
    return res.json({
      stats: { customers: activeCustomers, prospects: 0, installations: liveInstallations, planned,
               paidMonth: 0, totalPaid: 0, overdue: 0, upcoming: 0, stockAlerts, pendingCommissions: 0, liveInstallations },
      lowStock: stock, recentPayments: []
    });
  }
const where = isCommercialScope(req.user) ? '1=1' : 'agent_id = ?';
const params = isCommercialScope(req.user) ? [] : [uid];
  const q = (sql) => db.prepare(sql).get(...params);

  const customers = q(`SELECT COUNT(*) c FROM customers WHERE ${where}`);
  const prospects = q(`SELECT COUNT(*) c FROM prospects WHERE ${where} AND status != 'perdu'`);
  const installations = q(`SELECT COUNT(*) c FROM installations WHERE ${where}`);
  const paidMonth = q(`SELECT COALESCE(SUM(amount),0) s FROM payments WHERE ${where} AND created_at >= date('now','localtime','start of month')`);
  const totalPaid = q(`SELECT COALESCE(SUM(amount),0) s FROM payments WHERE ${where}`);
  const overdue = db.prepare(`
    SELECT COUNT(*) c FROM installments i
    WHERE i.status = 'pending' AND i.due_date < date('now','localtime')
    AND ${where.replaceAll('agent_id', 'i.agent_id')}
  `).get(...params);
  const upcoming = db.prepare(`
    SELECT COUNT(*) c FROM installments i
    WHERE i.status = 'pending' AND i.due_date >= date('now','localtime') AND i.due_date <= date('now','localtime','+7 days')
    AND ${where.replaceAll('agent_id', 'i.agent_id')}
  `).get(...params);
  // Stock par agent
  const stockAlerts = db.prepare(`
    SELECT COUNT(*) c FROM stock_items si WHERE si.quantity <= 3 ${isAdmin(req.user) ? '' : 'AND si.agent_id = ?'}
  `).get(...(isAdmin(req.user) ? [] : [uid]));
  const lowStock = db.prepare(`
    SELECT p.id, p.name, si.quantity FROM stock_items si JOIN products p ON p.id = si.product_id
    WHERE si.quantity <= 3 ${isAdmin(req.user) ? '' : 'AND si.agent_id = ?'} ORDER BY si.quantity ASC LIMIT 5
  `).all(...(isAdmin(req.user) ? [] : [uid]));
  const recentPayments = db.prepare(`
    SELECT p.id, p.amount, p.method, p.created_at, c.name AS customer FROM payments p
    JOIN customers c ON c.id = p.customer_id
    WHERE ${isAdmin(req.user) ? '1=1' : 'p.agent_id = ?'} ORDER BY p.id DESC LIMIT 5
  `).all(...params);
  const pendingCommissions = isAdmin(req.user)
    ? db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM commissions WHERE status='pending'`).get()
    : db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM commissions WHERE status='pending' AND agent_id = ?`).get(uid);

  res.json({
    stats: {
      customers: customers.c, prospects: prospects.c, installations: installations.c,
      paidMonth: paidMonth.s, totalPaid: totalPaid.s,
      overdue: overdue.c, upcoming: upcoming.c, stockAlerts: stockAlerts.c,
      pendingCommissions: pendingCommissions.s
    },
    lowStock, recentPayments
  });
});

// ---- Clients ----
router.get('/customers', (req, res) => {
  if (isTechScope(req.user)) return res.status(403).json({ error: 'Module réservé aux équipes commerciales.' });
  const { search = '' } = req.query;
  const uid = req.user.id;
  const like = `%${search.trim()}%`;
  const rows = isCommercialScope(req.user)
    ? db.prepare(`SELECT c.*, u.full_name AS agent FROM customers c JOIN users u ON u.id = c.agent_id
        WHERE c.name LIKE ? OR c.phone LIKE ? OR c.village LIKE ? ORDER BY c.id DESC LIMIT 200`).all(like, like, like)
    : db.prepare(`SELECT c.*, u.full_name AS agent FROM customers c JOIN users u ON u.id = c.agent_id
        WHERE c.agent_id = ? AND (c.name LIKE ? OR c.phone LIKE ? OR c.village LIKE ?) ORDER BY c.id DESC LIMIT 200`)
        .all(uid, like, like, like);
  res.json(rows);
});

router.post('/customers', guardCommercial, (req, res) => {
  const { name, phone = '', village = '', address = '', notes = '' } = req.body || {};
  const nameTrim = str(name).trim();
  if (!nameTrim) return res.status(400).json({ error: 'Le nom du client est requis.' });
  if (typeof phone !== 'string' || typeof village !== 'string' || typeof address !== 'string' || typeof notes !== 'string') {
    return res.status(400).json({ error: 'Champs textuels invalides.' });
  }
  const info = db.prepare(`INSERT INTO customers (agent_id, name, phone, village, address, notes) VALUES (?,?,?,?,?,?)`)
    .run(req.user.id, nameTrim, str(phone), str(village), str(address), str(notes));
  notif(req.user.id, 'Client enregistré', `${nameTrim} ajouté par ${req.user.full_name}.`);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/customers/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Client introuvable.' });
  if (!isAdmin(req.user) && c.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  const installations = db.prepare(`
    SELECT i.*, p.name AS product, p.price FROM installations i JOIN products p ON p.id = i.product_id
    WHERE i.customer_id = ? ORDER BY i.id DESC`).all(c.id);
  const payments = db.prepare(`SELECT * FROM payments WHERE customer_id = ? ORDER BY id DESC`).all(c.id);
  const installments = db.prepare(`
    SELECT i.*, p.name AS product FROM installments i LEFT JOIN installations ins ON ins.id = i.installation_id
    LEFT JOIN products p ON p.id = ins.product_id WHERE i.customer_id = ? ORDER BY i.due_date ASC`).all(c.id);
  res.json({ ...c, installations, payments, installments });
});

router.put('/customers/:id', guardCommercial, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Client introuvable.' });
  if (!isAdmin(req.user) && c.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  const { name, phone, village, address, status, notes } = req.body || {};
  const nameTrim = name === undefined ? c.name : str(name).trim();
  if (!nameTrim) return res.status(400).json({ error: 'Le nom du client est requis.' });
  if (status !== undefined && !CUSTOMER_STATUS.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs admises : ${CUSTOMER_STATUS.join(', ')}.` });
  }
  db.prepare(`UPDATE customers SET name=?, phone=?, village=?, address=?, status=?, notes=? WHERE id=?`)
    .run(nameTrim, phone === undefined ? c.phone : str(phone), village === undefined ? c.village : str(village),
         address === undefined ? c.address : str(address), status || c.status, notes === undefined ? c.notes : str(notes), c.id);
  res.json({ ok: true });
});

router.delete('/customers/:id', guardCommercial, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Client introuvable.' });
  if (!isAdmin(req.user) && c.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  // Refus explicite si le client a une activité (paiements, installations, échéances)
  const refs = db.prepare(`SELECT
      (SELECT COUNT(*) FROM payments WHERE customer_id = ?) +
      (SELECT COUNT(*) FROM installations WHERE customer_id = ?) +
      (SELECT COUNT(*) FROM installments WHERE customer_id = ?) AS c`).get(c.id, c.id, c.id);
  if (refs.c > 0) {
    return res.status(409).json({ error: 'Suppression impossible : ce client possède des paiements, installations ou échéances.' });
  }
  db.prepare('DELETE FROM customers WHERE id = ?').run(c.id);
  res.json({ ok: true });
});

// ---- Prospects (commerciaux) ----
router.get('/prospects', guardCommercial, (req, res) => {
  const { search = '', status = '' } = req.query;
  const like = `%${search.trim()}%`;
  const cond = [];
  const params = [];
  if (!isAdmin(req.user)) { cond.push('agent_id = ?'); params.push(req.user.id); }
  if (search) { cond.push('(name LIKE ? OR phone LIKE ? OR village LIKE ?)'); params.push(like, like, like); }
  if (status) { cond.push('status = ?'); params.push(status); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT p.*, u.full_name AS agent FROM prospects p JOIN users u ON u.id = p.agent_id ${where} ORDER BY p.id DESC LIMIT 200`).all(...params);
  res.json(rows);
});

router.post('/prospects', guardCommercial, (req, res) => {
  const { name, phone = '', village = '', interest = '', follow_up_date = '', notes = '' } = req.body || {};
  const nameTrim = str(name).trim();
  if (!nameTrim) return res.status(400).json({ error: 'Le nom du prospect est requis.' });
  const info = db.prepare(`INSERT INTO prospects (agent_id, name, phone, village, interest, follow_up_date, notes) VALUES (?,?,?,?,?,?,?)`)
    .run(req.user.id, nameTrim, str(phone), str(village), str(interest), str(follow_up_date), str(notes));
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/prospects/:id', guardCommercial, (req, res) => {
  const p = db.prepare('SELECT * FROM prospects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Prospect introuvable.' });
if (!isCommercialScope(req.user) && p.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  const { name, phone, village, interest, status, follow_up_date, notes } = req.body || {};
  const nameTrim = name === undefined ? p.name : str(name).trim();
  if (!nameTrim) return res.status(400).json({ error: 'Le nom du prospect est requis.' });
  if (status !== undefined && !PROSPECT_STATUS.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs admises : ${PROSPECT_STATUS.join(', ')}.` });
  }
  db.prepare(`UPDATE prospects SET name=?, phone=?, village=?, interest=?, status=?, follow_up_date=?, notes=? WHERE id=?`)
    .run(nameTrim, phone === undefined ? p.phone : str(phone), village === undefined ? p.village : str(village),
         interest === undefined ? p.interest : str(interest), status || p.status,
         follow_up_date === undefined ? p.follow_up_date : str(follow_up_date),
         notes === undefined ? p.notes : str(notes), p.id);
  res.json({ ok: true });
});

// Convertir un prospect en client (une seule fois)
router.post('/prospects/:id/convert', guardCommercial, (req, res) => {
  const p = db.prepare('SELECT * FROM prospects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Prospect introuvable.' });
  if (!isAdmin(req.user) && p.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  if (p.status === 'converti') return res.status(409).json({ error: 'Ce prospect est déjà converti en client.' });
  const info = db.prepare(`INSERT INTO customers (agent_id, name, phone, village, notes) VALUES (?,?,?,?,?)`)
    .run(p.agent_id, p.name, p.phone, p.village, `Converti depuis prospect #${p.id} : ${p.notes || ''}`.trim());
  db.prepare(`UPDATE prospects SET status = 'converti' WHERE id = ?`).run(p.id);
  res.status(201).json({ customerId: info.lastInsertRowid });
});

// ---- Produits & stocks (agent : lecture) ----
router.get('/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all();
  res.json(rows);
});

router.get('/stock', (req, res) => {
  const uid = req.user.id;
  // Technicien : matériel terrain partagé (intrants utiles aux tournées)
  // Technicien : la DISPONIBILITÉ du matériel (pas les quantités précises ni les coûts)
  if (isTechnician(req.user)) {
    const rows = db.prepare(`
      SELECT p.id AS product_id, p.name, p.category,
        CASE WHEN COALESCE((SELECT SUM(quantity) FROM stock_items si WHERE si.product_id = p.id), 0) > 0 THEN 1 ELSE 0 END AS disponible
      FROM products p WHERE p.category = 'Intrant' ORDER BY p.name`).all();
    return res.json(rows);
  }
  const rows = isAdmin(req.user)
    ? db.prepare(`
        SELECT si.id, si.quantity, p.name, p.price, p.category, COALESCE(u.full_name,'Dépôt central') AS agent
        FROM stock_items si JOIN products p ON p.id = si.product_id LEFT JOIN users u ON u.id = si.agent_id
        ORDER BY si.agent_id IS NOT NULL, u.full_name, p.name`).all()
    : db.prepare(`
        SELECT si.id, si.quantity, p.name, p.price, p.category FROM stock_items si JOIN products p ON p.id = si.product_id
        WHERE si.agent_id = ? ORDER BY p.name`).all(uid);
  res.json(rows);
});

// ---- Abonnements / contrats de collecte ----
// En lecture : le technicien voit TOUS les abonnements en service (ses tournées),
// les agents voir leurs contrats, les superviseurs tout.
router.get('/installations', (req, res) => {
  const uid = req.user.id;
const wide = isCommercialScope(req.user) || isTechScope(req.user);
  const where = wide ? '' : 'WHERE i.agent_id = ?';
  const params = wide ? [] : [uid];
  const rows = db.prepare(`
    SELECT i.*, c.name AS customer, c.phone AS customer_phone, p.name AS product, p.price, p.payg, p.nb_installments
    FROM installations i JOIN customers c ON c.id = i.customer_id JOIN products p ON p.id = i.product_id
    ${where} ORDER BY i.id DESC LIMIT 200`).all(...params);
  res.json(rows);
});

// POST /api/installations - souscrire un abonnement de collecte (réservé commercial)
router.post('/installations', guardCommercial, (req, res) => {
  const catCheck = db.prepare('SELECT category FROM products WHERE id = ?').get(Number(req.body.product_id));
  if (catCheck && catCheck.category !== 'Formule collecte') {
    return res.status(400).json({ error: 'Cet article n\'est pas à la vente (intrant de service, géré par la direction).' });
  }
  const { customer_id, product_id, serial = '', install_date, notes = '', status = 'installé' } = req.body || {};
  if (!customer_id || !product_id) return res.status(400).json({ error: 'Client et produit sont requis.' });
  if (status !== undefined && !INSTALLATION_STATUS.includes(status)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs admises : ${INSTALLATION_STATUS.join(', ')}.` });
  }
  if (install_date !== undefined && install_date !== '' && !isDateStr(install_date)) {
    return res.status(400).json({ error: 'Date d\'installation invalide (format AAAA-MM-JJ).' });
  }
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
  if (!customer) return res.status(404).json({ error: 'Client introuvable.' });
  if (!ownsCustomer(req.user, customer)) return res.status(403).json({ error: 'Accès refusé : ce client ne vous appartient pas.' });
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable.' });
  if (!product.active) return res.status(400).json({ error: 'Ce produit est désactivé.' });

  // Contrôle de disponibilité AVANT la transaction : aucune unité disponible → refus net.
  // En mono-processus synchrone, aucune course n'est possible entre ce contrôle et la transaction.
  const available = db.prepare(`
    SELECT * FROM stock_items WHERE product_id = ?
    AND ((agent_id = ?) OR (agent_id IS NULL)) ORDER BY (agent_id = ?) DESC`
  ).all(product_id, req.user.id, req.user.id).find((r) => r.quantity > 0);
  if (!available) return res.status(409).json({ error: 'Stock insuffisant pour cette installation. Demandez un réapprovisionnement.' });

  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO installations (customer_id, agent_id, product_id, serial, install_date, status, notes)
      VALUES (?,?,?,?,?,?,?)`)
      .run(customer_id, req.user.id, product_id, String(serial), install_date || localDateStr(), status, String(notes));

    // Stock : décrémenter la ligne disponible (dépôt central ou stock agent)
    db.prepare('UPDATE stock_items SET quantity = quantity - 1 WHERE id = ?').run(available.id);
    db.prepare(`INSERT INTO stock_movements (product_id, agent_id, type, quantity, note) VALUES (?,?, 'installation', -1, ?)`)
      .run(product_id, req.user.id, `Installation #${info.lastInsertRowid}`);

    // Échéancier (payg) ou paiement comptant implicite
    if (product.payg && product.nb_installments > 1) {
      const perInstall = Math.round((product.price / product.nb_installments) * 100) / 100;
      const insSched = db.prepare(`INSERT INTO installments (installation_id, customer_id, agent_id, due_date, amount) VALUES (?,?,?,?,?)`);
      // acompte (1re échéance) dû aujourd'hui ; suivantes +1 mois, jour borné au
      // dernier jour du mois cible (D-03 : plus de 31 janv. → 2/3 mars)
      buildScheduleDates(product.nb_installments).forEach((dueStr, k) => {
        const amount = k === 0 ? Math.round((product.price - perInstall * (product.nb_installments - 1)) * 100) / 100 : perInstall;
        insSched.run(info.lastInsertRowid, customer_id, req.user.id, dueStr, amount);
      });
    }

    // Commission (installation)
    const comm = Math.round(product.price * (product.commission_rate / 100) * 100) / 100;
    if (comm > 0) {
      db.prepare(`INSERT INTO commissions (agent_id, installation_id, amount) VALUES (?,?,?)`)
        .run(req.user.id, info.lastInsertRowid, comm);
    }

    db.prepare(`UPDATE customers SET status = 'installé' WHERE id = ?`).run(customer_id);
    notif(req.user.id, 'Installation enregistrée', `${product.name} installé chez ${customer.name}.`);
    return info.lastInsertRowid;
  });

  const id = tx();
  res.status(201).json({ id });
});

router.get('/installations/:id', (req, res) => {
  const i = db.prepare(`
    SELECT i.*, c.name AS customer, p.name AS product FROM installations i
    JOIN customers c ON c.id = i.customer_id JOIN products p ON p.id = i.product_id WHERE i.id = ?`).get(req.params.id);
  if (!i) return res.status(404).json({ error: 'Installation introuvable.' });
  if (!isCommercialScope(req.user) && !isTechScope(req.user) && i.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  const installments = db.prepare('SELECT * FROM installments WHERE installation_id = ? ORDER BY due_date').all(i.id);
  res.json({ ...i, installments });
});

// ---- Paiements ----
router.get('/payments', (req, res) => {
  const uid = req.user.id;
  const { customer_id } = req.query;
  const cond = [];
  const params = [];
if (!isCommercialScope(req.user)) { cond.push('p.agent_id = ?'); params.push(uid); }
  if (customer_id) { cond.push('p.customer_id = ?'); params.push(customer_id); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT p.*, c.name AS customer FROM payments p JOIN customers c ON c.id = p.customer_id
    ${where} ORDER BY p.id DESC LIMIT 200`).all(...params);
  res.json(rows);
});

// POST /api/payments - enregistrer un paiement (réservé commercial)
router.post('/payments', guardCommercial, (req, res) => {
  const { customer_id, amount, method = 'cash', ref = '', notes = '', installment_id = null, installation_id = null } = req.body || {};
  const amountNum = Number(amount);
  if (!customer_id || !Number.isFinite(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'Client et montant valide (nombre > 0) requis.' });
  }
  if (amountNum > MAX_PAYMENT) {
    return res.status(400).json({ error: `Montant trop élevé (maximum ${MAX_PAYMENT.toLocaleString('fr-FR')} F).` });
  }
  // Granularité monétaire : 2 décimales maximum
  const cents = Math.round(amountNum * 100);
  if (Math.abs(amountNum - cents / 100) > 1e-9) {
    return res.status(400).json({ error: 'Montant avec trop de décimales (maximum 2).' });
  }
  if (!PAYMENT_METHODS.includes(method)) {
    return res.status(400).json({ error: `Méthode de paiement invalide. Valeurs admises : ${PAYMENT_METHODS.join(', ')}.` });
  }
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
  if (!customer) return res.status(404).json({ error: 'Client introuvable.' });
  if (!ownsCustomer(req.user, customer)) return res.status(403).json({ error: 'Accès refusé : ce client ne vous appartient pas.' });

  // Vérifications d'appartenance des références optionnelles
  let installment = null;
  if (installment_id) {
    installment = db.prepare('SELECT * FROM installments WHERE id = ?').get(installment_id);
    if (!installment) return res.status(404).json({ error: 'Échéance introuvable.' });
    if (installment.customer_id !== customer.id) return res.status(400).json({ error: 'Cette échéance n\'appartient pas à ce client.' });
  }
  if (installation_id) {
    const inst = db.prepare('SELECT * FROM installations WHERE id = ?').get(installation_id);
    if (!inst) return res.status(404).json({ error: 'Installation introuvable.' });
    if (inst.customer_id !== customer.id) return res.status(400).json({ error: 'Cette installation n\'appartient pas à ce client.' });
  }
  const finalAmount = cents / 100;

  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO payments (customer_id, agent_id, amount, method, ref, notes, installment_id, installation_id)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(customer.id, req.user.id, finalAmount, method, String(ref), String(notes), installment_id || null, installation_id || null);

    // Solde l'échéance quand le CUMUL des paiements liés la couvre (D-05 :
    // 4 × 5 000 F sur une échéance de 20 000 F finissent par la solder).
    // Le paiement courant est déjà inséré ci-dessus : SUM l'inclut.
    if (installment && installment.status === 'pending') {
      const cumul = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE installment_id = ?').get(installment.id).s;
      if (cumul >= installment.amount) {
        db.prepare(`UPDATE installments SET status='paid', paid_date=date('now','localtime'), payment_id=? WHERE id=? AND status='pending'`)
          .run(info.lastInsertRowid, installment.id);
      }
    }

    // Commission sur paiement : renouvellement d'abonnement = 5 % ; séance à la carte = 20 %
    // (500 FC / 2 500 FC) ; paiement libre sans contrat = 5 % par défaut.
    const productRow = installation_id
      ? db.prepare(`SELECT p.* FROM installations i JOIN products p ON p.id = i.product_id WHERE i.id = ?`).get(installation_id)
      : db.prepare(`SELECT p.* FROM installations i JOIN products p ON p.id = i.product_id WHERE i.customer_id = ? ORDER BY i.id DESC LIMIT 1`).get(customer.id);
    const rate = productRow ? (productRow.payg ? 5 : productRow.commission_rate) : 5;
    const comm = Math.round(finalAmount * (rate / 100) * 100) / 100;
    if (comm > 0) {
      db.prepare(`INSERT INTO commissions (agent_id, payment_id, amount) VALUES (?,?,?)`)
        .run(req.user.id, info.lastInsertRowid, comm);
    }
    notif(req.user.id, 'Paiement enregistré', `${finalAmount.toLocaleString('fr-FR')} F reçus de ${customer.name}.`);
    return info.lastInsertRowid;
  });

  const id = tx();
  res.status(201).json({ id });
});

// ---- Échéances & relances ----
router.get('/installments', (req, res) => {
  const uid = req.user.id;
  const { status = '' } = req.query;
const cond = [isCommercialScope(req.user) ? '1=1' : 'i.agent_id = ?'];
const params = isCommercialScope(req.user) ? [] : [uid];
  if (status) { cond.push('i.status = ?'); params.push(status); }
  const rows = db.prepare(`
    SELECT i.*, c.name AS customer, c.phone AS customer_phone, p.name AS product
    FROM installments i JOIN customers c ON c.id = i.customer_id
    LEFT JOIN installations ins ON ins.id = i.installation_id LEFT JOIN products p ON p.id = ins.product_id
    WHERE ${cond.join(' AND ')} ORDER BY i.due_date ASC LIMIT 300`).all(...params);
  res.json(rows);
});

// Relance : crée une notification / trace de relance
router.post('/installments/:id/remind', (req, res) => {
  const i = db.prepare('SELECT * FROM installments WHERE id = ?').get(req.params.id);
  if (!i) return res.status(404).json({ error: 'Échéance introuvable.' });
  if (!isCommercialScope(req.user) && i.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });
  const customer = db.prepare('SELECT name, phone FROM customers WHERE id = ?').get(i.customer_id);
  notif(i.agent_id, 'Relance échéance', `Redevance de ${i.amount.toLocaleString('fr-FR')} FC due au ${i.due_date} - ${customer.name} (${customer.phone || 'sans téléphone'}).`);
  res.json({ ok: true });
});

// ---- Commissions (commerciaux & superviseurs) ----
router.get('/commissions', guardCommercial, (req, res) => {
  const uid = req.user.id;
const where = isCommercialScope(req.user) ? '' : 'WHERE c.agent_id = ?';
  const params = isAdmin(req.user) ? [] : [uid];
  const rows = db.prepare(`
    SELECT c.*, u.full_name AS agent FROM commissions c JOIN users u ON u.id = c.agent_id
    ${where} ORDER BY c.id DESC LIMIT 200`).all(...params);
  const totals = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN status='pending' THEN amount END),0) pending,
           COALESCE(SUM(CASE WHEN status='paid' THEN amount END),0) paid,
           COALESCE(SUM(amount),0) total
    FROM commissions ${where.replace('c.agent_id', 'agent_id').replace('WHERE', 'WHERE')};`).get(...params);
  const myTotals = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN status='pending' THEN amount END),0) pending,
           COALESCE(SUM(CASE WHEN status='paid' THEN amount END),0) paid,
           COALESCE(SUM(amount),0) total
    FROM commissions WHERE agent_id = ?`).get(uid);
  res.json({ rows, totals: isAdmin(req.user) ? totals : myTotals });
});

// ---- Notifications ----
router.get('/notifications', (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).c;
  res.json({ rows, unread });
});

router.post('/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;

// Helper notification (interne)
function notif(userId, title, body) {
  try {
    db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)').run(userId, title, body);
  } catch (e) { /* silencieux */ }
}
