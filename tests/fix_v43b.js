// tests/fix_v43b.js — gardes restantes : DELETE direction-only + coût masqué dans /admin/stock
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'routes', 'admin.js');
let s = fs.readFileSync(p, 'utf8').split('\n');
const out = [];
let miss = 0;

function replaceOnce(match, replacement) {
  const i = s.findIndex((l) => l.includes(match));
  if (i === -1) { out.push(`  ⚠️ admin: NON TROUVÉ → ${match.slice(0, 70)}`); miss++; return; }
  s[i] = replacement;
  out.push(`  admin: ligne ${i + 1} corrigée`);
}

replaceOnce(
  "if (isSuper(u)) return res.status(403).json({ error: 'Impossible de supprimer la direction.' });",
  "if (!isSuper(req.user)) return res.status(403).json({ error: 'La gestion des comptes est réservée à la direction.' });\n  if (isSuper(u)) return res.status(403).json({ error: 'Impossible de supprimer la direction.' });"
);
replaceOnce(
  "SELECT si.id, si.quantity, si.product_id, p.name, p.price, p.category, si.agent_id, COALESCE(u.full_name,'Dépôt central') AS agent",
  "SELECT si.id, si.quantity, si.product_id, p.name, ${isSuper(req.user) ? 'p.price, p.cost,' : ''} p.category, si.agent_id, COALESCE(u.full_name,'Dépôt central') AS agent"
);
fs.writeFileSync(p, s.join('\n'), 'utf8');
console.log(out.join('\n'));
console.log(miss ? 'PARTIEL' : 'OK');