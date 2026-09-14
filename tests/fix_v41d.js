// tests/fix_v41d.js — summary : ordre des paramètres SQL corrigé (scope avant dates)
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'routes', 'reports.js');
let s = fs.readFileSync(p, 'utf8').split('\n');
const out = [];

const start = s.findIndex((l) => l.includes("router.get('/summary'"));
if (start === -1) { console.log('⚠️ summary non trouvé'); process.exit(1); }
let end = start;
while (end < s.length && s[end].trim() !== '});') end++;

s.splice(start, end - start + 1, ...[
  "router.get('/summary', requireSupervision, (req, res) => {",
  "  const { from = '', to = '' } = req.query;",
  "  const roles = scopedRoles(req.user);",
  "  const scopePh = roles.map(() => '?').join(',');",
  "  const scopeSql = `agent_id IN (SELECT id FROM users WHERE role IN (${scopePh}))`;",
  "",
  "  // Encaissements du périmètre (+ filtre de dates optionnel) — paramètres dans l'ordre SQL",
  "  const payCond = [scopeSql.replace('agent_id', 'p.agent_id')];",
  "  const payParams = [...roles];",
  "  if (from) { payCond.push(\"date(p.created_at) >= date(?)\"); payParams.push(from); }",
  "  if (to) { payCond.push(\"date(p.created_at) <= date(?)\"); payParams.push(to); }",
  "  const payWhere = `WHERE ${payCond.join(' AND ')}`;",
  "  const payments = db.prepare(`SELECT COALESCE(SUM(p.amount),0) total, COUNT(*) count FROM payments p ${payWhere}`).get(...payParams);",
  "  const byMethod = db.prepare(`SELECT p.method, COUNT(*) count, COALESCE(SUM(p.amount),0) total FROM payments p ${payWhere} GROUP BY p.method`).all(...payParams);",
  "",
  "  // Abonnements du périmètre",
  "  const instCond = [scopeSql.replace('agent_id', 'i.agent_id')];",
  "  const instParams = [...roles];",
  "  if (from) { instCond.push(\"date(i.created_at) >= date(?)\"); instParams.push(from); }",
  "  if (to) { instCond.push(\"date(i.created_at) <= date(?)\"); instParams.push(to); }",
  "  const installations = db.prepare(`SELECT COUNT(*) count FROM installations i WHERE ${instCond.join(' AND ')}`).get(...instParams);",
  "",
  "  // Nouveaux abonnés du périmètre",
  "  const custCond = [scopeSql.replace('agent_id', 'c.agent_id')];",
  "  const custParams = [...roles];",
  "  if (from) { custCond.push(\"date(c.created_at) >= date(?)\"); custParams.push(from); }",
  "  if (to) { custCond.push(\"date(c.created_at) <= date(?)\"); custParams.push(to); }",
  "  const newCustomers = db.prepare(`SELECT COUNT(*) count FROM customers c WHERE ${custCond.join(' AND ')}`).get(...custParams);",
  "",
  "  // Classement : uniquement les profils du périmètre",
  "  const byAgent = db.prepare(`",
  "    SELECT u.full_name AS agent, COUNT(p.id) AS payments, COALESCE(SUM(p.amount),0) AS total",
  "    FROM users u LEFT JOIN payments p ON p.agent_id = u.id",
  "    WHERE u.role IN (${scopePh}) GROUP BY u.id ORDER BY total DESC`).all(...roles);",
  "",
  "  res.json({ payments, byMethod, byAgent, installations: installations.count, newCustomers: newCustomers.count });",
  "});"
]);

fs.writeFileSync(p, s.join('\n'), 'utf8');
console.log(out.join('\n') + '\nsummary réécrit (lignes ' + (start + 1) + '-' + (end + 1) + ')');