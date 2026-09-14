// tests/fix_stock_route.js — restaure la branche isTechnician du GET /stock (retire le bloc dashboard collé)
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'routes', 'agent.js');
let lines = fs.readFileSync(p, 'utf8').split('\n');
const out = [];

const routeIdx = lines.findIndex((l) => l.includes("router.get('/stock', (req, res) => {"));
if (routeIdx === -1) { console.log('⚠️ route /stock non trouvée'); process.exit(1); }

// borne début : le commentaire de la branche collée (après router.get)
let start = routeIdx;
while (start < lines.length && !lines[start].includes('// Vue opérationnelle technique')) start++;
if (start >= lines.length) { console.log('⚠️ début du bloc collé non trouvé'); process.exit(1); }
// borne fin : la ligne '  }' qui ferme le if isTechScope (la première '  }' exacte après le start)
let end = start;
while (end < lines.length && lines[end].trim() !== '}') end++;
if (end >= lines.length) { console.log('⚠️ fin du bloc non trouvée'); process.exit(1); }

const replacement = [
  "  // Technicien : matériel terrain partagé (intrants utiles aux tournées)",
  "  if (isTechnician(req.user)) {",
  "    return res.json(db.prepare(`",
  "      SELECT si.id, si.quantity, p.name, p.price, p.category, COALESCE(u.full_name,'Dépôt central') AS agent",
  "      FROM stock_items si JOIN products p ON p.id = si.product_id LEFT JOIN users u ON u.id = si.agent_id",
  "      WHERE p.category = 'Intrant' OR si.agent_id = ?",
  "      ORDER BY si.agent_id IS NOT NULL, p.name`).all(req.user.id));",
  "  }"
];
lines.splice(start, end - start + 1, ...replacement);
out.push('GET /stock : branche technicien restaurée (bloc dashboard retiré)');

fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log(out.join('\n'));