// tests/fix_v31d.js — déplace la validation du destinataire de /stock/move vers /stock/set
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'routes', 'admin.js');
let s = fs.readFileSync(p, 'utf8').split('\n');
const out = [];

const checkBlock = [
  "  if (agent_id !== null && agent_id !== undefined) {",
  "    const member = db.prepare('SELECT * FROM users WHERE id = ?').get(agent_id);",
  "    if (!member || !scopedRoles(req.user).includes(member.role)) return res.status(400).json({ error: 'Destinataire inconnu ou hors de votre périmètre.' });",
  "  }"
];

// 1. Retirer le bloc mal placé dans /stock/move
const inMove = s.findIndex((l) => l.includes('Destinataire inconnu ou hors de votre périmètre.'));
if (inMove === -1) { console.log('⚠️ bloc non trouvé dans /stock/move'); process.exit(1); }
// vérifier que le bloc (3 lignes avant) correspond bien
const start = inMove - 2;
if (!s[start].includes('if (agent_id !== null && agent_id !== undefined) {')) { console.log('⚠️ structure inattendue'); process.exit(1); }
s.splice(start, checkBlock.length);
out.push('bloc retiré de /stock/move (lignes ' + (start + 1) + '-' + (inMove) + ')');

// 2. Insérer dans /stock/set avant le const row
const setIdx = s.findIndex((l) => l.includes("router.post('/stock/set'"));
const rowIdx = s.findIndex((l, i) => i > setIdx && l.includes("const row = db.prepare('SELECT * FROM stock_items WHERE product_id = ? AND agent_id IS ?')"));
if (rowIdx === -1) { console.log('⚠️ /stock/set : ancre row non trouvée'); process.exit(1); }
s.splice(rowIdx, 0, ...checkBlock);
out.push('bloc inséré dans /stock/set (ligne ' + (rowIdx + 1) + ')');

fs.writeFileSync(p, s.join('\n'), 'utf8');
console.log(out.join('\n'));