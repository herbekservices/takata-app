// tests/fix_techdash.js — dashboard : stats du métier technique (jour + cumul)
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'routes', 'agent.js');
let lines = fs.readFileSync(p, 'utf8').split('\n');
const out = [];

const branchIdx = lines.findIndex((l) => l.includes('if (isTechnician(req.user)) {'));
if (branchIdx === -1) { console.log('⚠️ branche technicien non trouvée'); process.exit(1); }
let end = branchIdx;
while (end < lines.length && lines[end].trim() !== '}') end++;
if (end >= lines.length) { console.log('⚠️ fin de branche non trouvée'); process.exit(1); }

const newBranch = [
  "  // Vue opérationnelle technique : tournées, stock matériel + stats du métier (évacuations, désinfections)",
  "  if (isTechScope(req.user)) {",
  "    const liveInstallations = db.prepare(`SELECT COUNT(*) c FROM installations WHERE status='installé'`).get().c;",
  "    const planned = db.prepare(`SELECT COUNT(*) c FROM installations WHERE status='planifiée'`).get().c;",
  "    const activeCustomers = db.prepare(`SELECT COUNT(*) c FROM customers WHERE status='installé'`).get().c;",
  "    const stock = db.prepare(`SELECT si.product_id, si.quantity, p.name, p.category FROM stock_items si JOIN products p ON p.id=si.product_id WHERE si.quantity <= 10 ORDER BY si.quantity ASC LIMIT 5`).all();",
  "    const stockAlerts = db.prepare(`SELECT COUNT(*) c FROM stock_items WHERE quantity <= 10`).get().c;",
  "    // Stats du métier : le technicien voit les siennes, l'admintech la compilation de son équipe",
  "    const techScope = isTechnician(req.user)",
  "      ? `r.user_id = ${Number(req.user.id)}`",
  "      : \"r.user_id IN (SELECT id FROM users WHERE role = 'technicien' AND active = 1)\";",
  "    const techAgg = (where) => db.prepare(`",
  "      SELECT COALESCE(SUM(menages_servis),0) menages, COALESCE(SUM(poubelles_evacuees),0) poubelles,",
  "        COALESCE(SUM(courses_camion),0) courses, COALESCE(SUM(desinfections),0) desinfections,",
  "        COALESCE(SUM(maisons_desinfectees),0) maisons",
  "      FROM tech_reports WHERE ${where}`).get();",
  "    const jour = techAgg(`${techScope} AND date = date('now','localtime')`);",
  "    const cumul = techAgg(techScope);",
  "    return res.json({",
  "      stats: { customers: activeCustomers, prospects: 0, installations: liveInstallations, planned,",
  "               paidMonth: 0, totalPaid: 0, overdue: 0, upcoming: 0, stockAlerts, pendingCommissions: 0, liveInstallations,",
  "               menagesJour: jour.menages, poubellesJour: jour.poubelles, coursesJour: jour.courses,",
  "               desinfectionsJour: jour.desinfections, maisonsJour: jour.maisons,",
  "               menagesTotal: cumul.menages, poubellesTotal: cumul.poubelles, coursesTotal: cumul.courses,",
  "               desinfectionsTotal: cumul.desinfections, maisonsTotal: cumul.maisons },",
  "      lowStock: stock, recentPayments: []",
  "    });",
  "  }"
];
lines.splice(branchIdx, end - branchIdx + 1, ...newBranch);
out.push('branche dashboard technique réécrite (' + newBranch.length + ' lignes)');

fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log(out.join('\n'));