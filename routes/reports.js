// routes/reports.js — Rapports et export CSV
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole, isSuper, scopedRoles } = require('../auth');

const router = express.Router();
router.use(requireAuth);
const requireSupervision = requireRole('admin', 'admingen', 'admincomm', 'admintech');

function csvEscape(v) {
  let s = String(v ?? '');
  // Anti-injection de formule : neutralise les cellules débutant par = + @ (ou tabulation)
  if (/^[=+@\t]/.test(s)) s = "'" + s;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sendCsv(res, filename, headers, rows) {
  const lines = [headers.map(csvEscape).join(';'), ...rows.map((r) => r.map(csvEscape).join(';'))];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + lines.join('\n')); // BOM UTF-8 pour Excel
}

// ---- Résumé global (admin) ----
router.get('/summary', requireSupervision, (req, res) => {
  const { from = '', to = '' } = req.query;
  const roles = scopedRoles(req.user);
  const scopePh = roles.map(() => '?').join(',');
  const scopeSql = `agent_id IN (SELECT id FROM users WHERE role IN (${scopePh}))`;

  // Encaissements du périmètre (+ filtre de dates optionnel) — paramètres dans l'ordre SQL
  const payCond = [scopeSql.replace('agent_id', 'p.agent_id')];
  const payParams = [...roles];
  if (from) { payCond.push("date(p.created_at) >= date(?)"); payParams.push(from); }
  if (to) { payCond.push("date(p.created_at) <= date(?)"); payParams.push(to); }
  const payWhere = `WHERE ${payCond.join(' AND ')}`;
  const payments = db.prepare(`SELECT COALESCE(SUM(p.amount),0) total, COUNT(*) count FROM payments p ${payWhere}`).get(...payParams);
  const byMethod = db.prepare(`SELECT p.method, COUNT(*) count, COALESCE(SUM(p.amount),0) total FROM payments p ${payWhere} GROUP BY p.method`).all(...payParams);

  // Abonnements du périmètre
  const instCond = [scopeSql.replace('agent_id', 'i.agent_id')];
  const instParams = [...roles];
  if (from) { instCond.push("date(i.created_at) >= date(?)"); instParams.push(from); }
  if (to) { instCond.push("date(i.created_at) <= date(?)"); instParams.push(to); }
  const installations = db.prepare(`SELECT COUNT(*) count FROM installations i WHERE ${instCond.join(' AND ')}`).get(...instParams);

  // Nouveaux abonnés du périmètre
  const custCond = [scopeSql.replace('agent_id', 'c.agent_id')];
  const custParams = [...roles];
  if (from) { custCond.push("date(c.created_at) >= date(?)"); custParams.push(from); }
  if (to) { custCond.push("date(c.created_at) <= date(?)"); custParams.push(to); }
  const newCustomers = db.prepare(`SELECT COUNT(*) count FROM customers c WHERE ${custCond.join(' AND ')}`).get(...custParams);

  // Classement : uniquement les profils du périmètre
  const byAgent = db.prepare(`
    SELECT u.full_name AS agent, COUNT(p.id) AS payments, COALESCE(SUM(p.amount),0) AS total
    FROM users u LEFT JOIN payments p ON p.agent_id = u.id
    WHERE u.role IN (${scopePh}) GROUP BY u.id ORDER BY total DESC`).all(...roles);

  res.json({ payments, byMethod, byAgent, installations: installations.count, newCustomers: newCustomers.count });
});

// ---- Exports CSV ----
const EXPORTS = {
  customers: {
    filename: 'takata_clients.csv',
    headers: ['id', 'nom', 'téléphone', 'village', 'adresse', 'statut', 'agent', 'créé_le'],
    sql: `SELECT c.id, c.name, c.phone, c.village, c.address, c.status, u.full_name AS agent, c.created_at
          FROM customers c JOIN users u ON u.id = c.agent_id ORDER BY c.id`
  },
  prospects: {
    filename: 'takata_prospects.csv',
    headers: ['id', 'nom', 'téléphone', 'village', 'intérêt', 'statut', 'relance_le', 'agent', 'créé_le'],
    sql: `SELECT p.id, p.name, p.phone, p.village, p.interest, p.status, p.follow_up_date, u.full_name AS agent, p.created_at
          FROM prospects p JOIN users u ON u.id = p.agent_id ORDER BY p.id`
  },
  installations: {
    filename: 'takata_installations.csv',
    headers: ['id', 'client', 'produit', 'série', 'date', 'statut', 'agent'],
    sql: `SELECT i.id, c.name AS client, p.name AS produit, i.serial, i.install_date, i.status, u.full_name AS agent
          FROM installations i JOIN customers c ON c.id = i.customer_id JOIN products p ON p.id = i.product_id
          JOIN users u ON u.id = i.agent_id ORDER BY i.id`
  },
  payments: {
    filename: 'takata_paiements.csv',
    headers: ['id', 'client', 'agent', 'montant', 'méthode', 'référence', 'créé_le'],
    sql: `SELECT p.id, c.name AS client, u.full_name AS agent, p.amount, p.method, p.ref, p.created_at
          FROM payments p JOIN customers c ON c.id = p.customer_id JOIN users u ON u.id = p.agent_id ORDER BY p.id`
  },
  installments: {
    filename: 'takata_echeances.csv',
    headers: ['id', 'client', 'produit', 'échéance', 'montant', 'statut', 'payé_le'],
    sql: `SELECT i.id, c.name AS client, COALESCE(p.name,'—') AS produit, i.due_date, i.amount, i.status, i.paid_date
          FROM installments i JOIN customers c ON c.id = i.customer_id
          LEFT JOIN installations ins ON ins.id = i.installation_id LEFT JOIN products p ON p.id = ins.product_id
          ORDER BY i.due_date`
  },
  agents: {
    filename: 'takata_agents.csv',
    headers: ['id', 'nom', 'téléphone', 'région', 'actif', 'clients', 'encaissé_total'],
    sql: `SELECT u.id, u.full_name, u.phone, u.region, u.active,
          (SELECT COUNT(*) FROM customers c WHERE c.agent_id = u.id) AS clients,
          (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.agent_id = u.id) AS encaisse
          FROM users u WHERE u.role='agent' ORDER BY u.full_name`
  },
  commissions: {
    filename: 'takata_commissions.csv',
    headers: ['id', 'agent', 'montant', 'statut', 'créé_le'],
    sql: `SELECT c.id, u.full_name AS agent, c.amount, c.status, c.created_at
          FROM commissions c JOIN users u ON u.id = c.agent_id ORDER BY c.id`
  }
};

router.get('/export/:type', requireSupervision, (req, res) => {
  const type = req.params.type;
  const def = EXPORTS[type];
  if (!def) return res.status(404).json({ error: 'Export inconnu.' });

  // Périmètre d'export : direction = tout ; admincomm = équipes commerciales ; admintech = équipes techniques
  let sql = def.sql;
  const params = [];
  if (req.user && !isSuper(req.user)) {
    const teamRole = req.user.role === 'admintech' ? 'technicien' : 'agent';
    const orderCol = type === 'installments' ? 'i.due_date' : (type === 'agents' ? 'u.id' : (type === 'prospects' || type === 'payments') ? 'p.id' : type === 'installations' ? 'i.id' : 'c.id');
    const anchor = 'ORDER BY ' + orderCol;
    if (!sql.includes(anchor)) return res.status(403).json({ error: 'Export non scopé pour ce profil.' });
    const table = orderCol.split('.')[0];
    sql = sql.replace(anchor, `WHERE ${table}.agent_id IN (SELECT id FROM users WHERE role = '${teamRole}') ${anchor}`);
  }
  const rows = db.prepare(sql).all(...params).map((r) => Object.values(r));
  sendCsv(res, def.filename, def.headers, rows);
});

module.exports = router;