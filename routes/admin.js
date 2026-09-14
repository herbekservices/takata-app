// routes/admin.js — Espace de supervision : équipes, produits, stock, commissions
const express = require('express');
const db = require('../db');
const { hashPassword, revokeAllTokens, requireAuth, requireRole, isSuper, scopedRoles, ROLE } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'admingen', 'admincomm', 'admintech'));

// Ensemble des rôles qu'un superviseur peut voir, sous forme de condition SQL
function scopeWhere(user) {
  const roles = scopedRoles(user);
  return `u.role IN (${roles.map(() => '?').join(',')})`;
}

// ---- Équipes (commerciaux / techniciens / superviseurs) ----
router.get('/agents', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.phone, u.role, u.team, u.region, u.active, u.created_at,
      (SELECT COUNT(*) FROM customers c WHERE c.agent_id = u.id) AS customers,
      (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.agent_id = u.id) AS collected
    FROM users u WHERE ${scopeWhere(req.user)} ORDER BY u.full_name`).all(...scopedRoles(req.user));
  res.json(rows);
});

router.post('/agents', (req, res) => {
  if (!isSuper(req.user)) return res.status(403).json({ error: 'La création de comptes est réservée à la direction (adminGEN).' });
  const { username, password, full_name, phone = '', region = '', team = '' } = req.body || {};
  const uname = String(username || '').trim();
  const fname = String(full_name || '').trim();
  if (!uname || !password || !fname) return res.status(400).json({ error: 'username, password et full_name requis.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum.' });
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(uname);
  if (exists) return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà.' });
  // Le rôle créé dépend du périmètre du superviseur (admincomm → commercial, admintech → technicien)
  let role = ROLE.AGENT;
  if (req.user.role === ROLE.ADMINTECH) role = ROLE.TECH;
  if (isSuper(req.user)) role = String(req.body.role || ROLE.AGENT).trim();
const allowedRoles = ['agent', 'technicien', 'admincomm', 'admintech'];
  if (isSuper(req.user)) allowedRoles.push('admin', 'admingen');
  if (!allowedRoles.includes(role)) role = ROLE.AGENT;
  const info = db.prepare(`INSERT INTO users (username, password_hash, full_name, phone, role, team, region) VALUES (?,?,?,?,?,?,?)`)
    .run(uname, hashPassword(password), fname, String(phone), role, String(team), String(region));
  res.status(201).json({ id: info.lastInsertRowid, role });
});

router.put('/agents/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u || !scopedRoles(req.user).includes(u.role)) return res.status(404).json({ error: 'Membre d\'équipe introuvable.' });
  if (!isSuper(req.user)) return res.status(403).json({ error: 'La modification de comptes est réservée à la direction.' });
  const { full_name, phone, region, team, active, role } = req.body || {};
  let newRole = u.role;
  if (isSuper(req.user) && role && ['agent', 'technicien', 'admincomm', 'admintech'].includes(String(role))) newRole = String(role);
  if (isSuper(u) && role && String(role) !== u.role) {
    return res.status(403).json({ error: 'Le profil d\'un membre de la direction ne peut pas être modifié.' });
  }
if (isSuper(u) && active !== undefined && !active) return res.status(403).json({ error: 'Un membre de la direction ne peut pas être désactivé.' });
  db.prepare('UPDATE users SET full_name=?, phone=?, region=?, team=?, role=?, active=? WHERE id=?')
    .run(full_name || u.full_name, phone ?? u.phone, region ?? u.region, team ?? u.team, newRole, active === undefined ? u.active : (active ? 1 : 0), u.id);
  res.json({ ok: true });
});

router.post('/agents/:id/reset-password', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u || !scopedRoles(req.user).includes(u.role)) return res.status(404).json({ error: 'Membre d\'équipe introuvable.' });
  const { password } = req.body || {};
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Nouveau mot de passe : 6 caractères minimum.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), u.id);
  revokeAllTokens(u.id); // neutralise les sessions existantes (compte potentiellement compromis)
  res.json({ ok: true });
});

router.delete('/agents/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u || !scopedRoles(req.user).includes(u.role)) return res.status(404).json({ error: 'Membre d\'équipe introuvable.' });
if (!isSuper(req.user)) return res.status(403).json({ error: 'La gestion des comptes est réservée à la direction.' });
  if (isSuper(u)) return res.status(403).json({ error: 'Impossible de supprimer la direction.' });
  if (u.id === req.user.id) return res.status(403).json({ error: 'Impossible de supprimer votre propre compte.' });
  if (isSuper(req.user)) {
    // Suppression définitive (direction) : refusée si le compte possède des données liées
    const alloc = db.prepare('SELECT COUNT(*) c FROM stock_items WHERE agent_id = ?').get(u.id).c;
    if (alloc > 0) return res.status(409).json({ error: 'Ce compte a du matériel alloué. Réintégrez-le au dépôt (stock) avant la suppression.' });
    try {
      db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
      return res.json({ ok: true, deleted: true });
    } catch (e) {
      return res.status(409).json({ error: 'Ce compte possède des données liées (clients, paiements…). Désactivez-le plutôt.' });
    }
  }
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(u.id);
  res.json({ ok: true });
});

// ---- Produits ----
router.get('/products', (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY name').all());
});

router.post('/products', (req, res) => {
  const { name, category = 'Kit solaire', price, cost = 0, commission_rate = 5, payg = 0, nb_installments = 1 } = req.body || {};
  const priceNum = Number(price);
  const nameTrim = String(name || '').trim();
  const costNum = Number(cost);
  const rateNum = Number(commission_rate);
  const nb = Number(nb_installments);
  if (!nameTrim || !Number.isFinite(priceNum) || priceNum <= 0) return res.status(400).json({ error: 'Nom et prix valide (nombre > 0) requis.' });
  if (!Number.isFinite(costNum) || costNum < 0) return res.status(400).json({ error: 'Coût invalide.' });
  if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) return res.status(400).json({ error: 'Commission invalide (0 à 100 %).' });
  if (!Number.isInteger(nb) || nb < 1) return res.status(400).json({ error: 'Nombre d\'échéances invalide (entier ≥ 1).' });
  const info = db.prepare(`INSERT INTO products (name, category, price, cost, commission_rate, payg, nb_installments)
    VALUES (?,?,?,?,?,?,?)`)
    .run(nameTrim, String(category), priceNum, costNum, rateNum, payg ? 1 : 0, nb);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable.' });
  const { name, category, price, cost, commission_rate, payg, nb_installments, active } = req.body || {};
  const nameTrim = name === undefined ? p.name : String(name).trim();
  const priceNum = price === undefined ? p.price : Number(price);
  const costNum = cost === undefined ? p.cost : Number(cost);
  const rateNum = commission_rate === undefined ? p.commission_rate : Number(commission_rate);
  const nb = nb_installments === undefined ? p.nb_installments : Number(nb_installments);
  if (!nameTrim || !Number.isFinite(priceNum) || priceNum <= 0) return res.status(400).json({ error: 'Nom et prix valide (nombre > 0) requis.' });
  if (!Number.isFinite(costNum) || costNum < 0) return res.status(400).json({ error: 'Coût invalide.' });
  if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) return res.status(400).json({ error: 'Commission invalide (0 à 100 %).' });
  if (!Number.isInteger(nb) || nb < 1) return res.status(400).json({ error: 'Nombre d\'échéances invalide (entier ≥ 1).' });
  db.prepare(`UPDATE products SET name=?, category=?, price=?, cost=?, commission_rate=?, payg=?, nb_installments=?, active=? WHERE id=?`)
    .run(nameTrim, category || p.category, priceNum, costNum, rateNum,
         (payg === undefined ? p.payg : (payg ? 1 : 0)), nb,
         (active === undefined ? p.active : (active ? 1 : 0)), p.id);
  res.json({ ok: true });
});

// ---- Stock ----
router.get('/stock', (req, res) => {
  const rows = db.prepare(`
SELECT si.id, si.quantity, si.product_id, p.name, ${isSuper(req.user) ? 'p.price, p.cost,' : ''} p.category, si.agent_id, COALESCE(u.full_name,'Dépôt central') AS agent
    FROM stock_items si JOIN products p ON p.id = si.product_id LEFT JOIN users u ON u.id = si.agent_id
    ORDER BY p.name, si.agent_id IS NOT NULL, u.full_name`).all();
  res.json(rows);
});

router.get('/stock/movements', (req, res) => {
  const roles = scopedRoles(req.user);
  const rolePh = roles.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT m.*, p.name AS product, COALESCE(u.full_name,'—') AS agent
    FROM stock_movements m JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.agent_id
    WHERE m.agent_id IS NULL OR m.agent_id IN (SELECT id FROM users WHERE role IN (${rolePh}))
    ORDER BY m.id DESC LIMIT 100`).all(...roles);
  res.json(rows);
});

// Entrée de stock (dépôt central ou agent)
router.post('/stock/move', (req, res) => {
  if (!isSuper(req.user)) return res.status(403).json({ error: 'La gestion du stock est réservée à la direction.' });
  const { product_id, agent_id = null, type, quantity, note = '' } = req.body || {};
  if (!product_id || type === undefined || quantity === undefined || quantity === null || quantity === '') {
    return res.status(400).json({ error: 'product_id, type et quantity requis.' });
  }
  if (!['in', 'out', 'return'].includes(type)) return res.status(400).json({ error: 'type invalide.' });
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Quantité invalide (entier > 0 requis).' });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

  const row = db.prepare('SELECT * FROM stock_items WHERE product_id = ? AND agent_id IS ?').get(product_id, agent_id);
  const before = row ? row.quantity : 0;

  // Refus net d'une sortie supérieure au stock disponible (pas d'écrêtement silencieux)
  if (type === 'out' && qty > before) {
    return res.status(400).json({ error: 'Stock insuffisant pour cette sortie.' });
  }
  const after = type === 'out' ? before - qty : before + qty;
  const applied = type === 'out' ? -qty : qty;

  const tx = db.transaction(() => {
    if (!row) {
      db.prepare('INSERT INTO stock_items (product_id, agent_id, quantity) VALUES (?,?,?)').run(product_id, agent_id, after);
    } else {
      db.prepare('UPDATE stock_items SET quantity = ? WHERE id = ?').run(after, row.id);
    }
    db.prepare(`INSERT INTO stock_movements (product_id, agent_id, type, quantity, note) VALUES (?,?,?,?,?)`)
      .run(product_id, agent_id, type, applied, String(note));
  });
  tx();
  res.json({ ok: true });
});

// Saisie manuelle : définir la quantité possédée (dépôt central ou membre)
router.post('/stock/set', (req, res) => {
  const { product_id, agent_id = null, quantity, note = 'Ajustement manuel' } = req.body || {};
  if (quantity === undefined || quantity === null || quantity === '') return res.status(400).json({ error: 'Quantité requise.' });
  if (!isSuper(req.user) && agent_id === null) return res.status(403).json({ error: 'La saisie du stock central est réservée à la direction.' });
  const qty = Number(quantity);
  if (!product_id || !Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'product_id et quantité (entier ≥ 0) requis.' });
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Produit introuvable.' });
  if (agent_id !== null && agent_id !== undefined) {
    const member = db.prepare('SELECT * FROM users WHERE id = ?').get(agent_id);
    if (!member || !scopedRoles(req.user).includes(member.role)) return res.status(400).json({ error: 'Destinataire inconnu ou hors de votre périmètre.' });
    if (!isSuper(req.user)) {
      if (req.user.role !== 'admintech' || member.role !== 'technicien') return res.status(403).json({ error: 'Le superviseur technique dote uniquement ses techniciens (le dépôt central est géré par la direction).' });
    }
  }
  const row = db.prepare('SELECT * FROM stock_items WHERE product_id = ? AND agent_id IS ?').get(product_id, agent_id);
  const before = row ? row.quantity : 0;
  const delta = qty - before;
  const tx = db.transaction(() => {
    if (!row) db.prepare('INSERT INTO stock_items (product_id, agent_id, quantity) VALUES (?,?,?)').run(product_id, agent_id, qty);
    else db.prepare('UPDATE stock_items SET quantity = ? WHERE id = ?').run(qty, row.id);
    if (delta !== 0) db.prepare(`INSERT INTO stock_movements (product_id, agent_id, type, quantity, note) VALUES (?,?,?,?,?)`)
      .run(product_id, agent_id, delta > 0 ? 'in' : 'out', delta, String(note));
  });
  tx();
  res.json({ ok: true, quantity: qty });
});

// ---- Commissions (paiement des commissions) ----
router.post('/commissions/pay', (req, res) => {
  if (req.user.role === ROLE.ADMINTECH) return res.status(403).json({ error: 'Réservé aux équipes commerciales et à la direction.' });
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Sélection requise.' });
  db.prepare(`UPDATE commissions SET status = 'paid' WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  res.json({ ok: true });
});

// ---- Vue globale des données (selon le périmètre du superviseur) ----
router.get('/overview', (req, res) => {
  const roles = scopedRoles(req.user);
  const inScope = `agent_id IN (SELECT id FROM users WHERE role IN (${roles.map(() => '?').join(',')}) AND active=1)`;
  const params = [...roles];
  const q = (sql) => db.prepare(sql).get(...params);
  const all = (sql) => db.prepare(sql).all(...params);

  const customers = q(`SELECT COUNT(*) c FROM customers WHERE ${inScope}`).c;
  const prospects = q(`SELECT COUNT(*) c FROM prospects WHERE ${inScope}`).c;
  const installations = q(`SELECT COUNT(*) c FROM installations WHERE ${inScope}`).c;
  const agents = q(`SELECT COUNT(*) c FROM users WHERE ${'role IN (' + roles.map(() => '?').join(',') + ')'} AND active = 1`).c;
  const totalPaid = q(`SELECT COALESCE(SUM(amount),0) s FROM payments WHERE ${inScope}`).s;
  const pendingCommissions = q(`SELECT COALESCE(SUM(amount),0) s FROM commissions WHERE status='pending' AND ${'agent_id IN (SELECT id FROM users WHERE role IN (' + roles.map(() => '?').join(',') + '))'}`).s;
  const stockValue = db.prepare(`SELECT COALESCE(SUM(si.quantity * p.price),0) s FROM stock_items si JOIN products p ON p.id = si.product_id`).get().s;
  const overdue = q(`SELECT COUNT(*) c FROM installments WHERE status='pending' AND due_date < date('now','localtime') AND ${'agent_id IN (SELECT id FROM users WHERE role IN (' + roles.map(() => '?').join(',') + '))'}`).c;
  const topAgents = all(`
    SELECT u.full_name, u.region, u.role, COUNT(DISTINCT p.id) payments, COALESCE(SUM(p.amount),0) collected
    FROM users u LEFT JOIN payments p ON p.agent_id = u.id
    WHERE u.role IN (${roles.map(() => '?').join(',')}) AND u.active=1 GROUP BY u.id ORDER BY collected DESC LIMIT 5`);
  res.json({ customers, prospects, installations, agents, totalPaid, pendingCommissions, stockValue, overdue, topAgents });
});

module.exports = router;