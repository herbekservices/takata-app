// tests/fix_v43c.js — /stock/set : admintech dote ses techniciens ; le dépôt central = direction seule
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'routes', 'admin.js');
let s = fs.readFileSync(p, 'utf8').split('\n');
const out = [];
let miss = 0;

const oldHead = [
  "  if (!isSuper(req.user)) return res.status(403).json({ error: 'La saisie du stock est réservée à la direction.' });",
  "  const { product_id, agent_id = null, quantity, note = 'Ajustement manuel' } = req.body || {};",
  "  if (quantity === undefined || quantity === null || quantity === '') return res.status(400).json({ error: 'Quantité requise.' });"
].join('\n');
const newHead = [
  "  const { product_id, agent_id = null, quantity, note = 'Ajustement manuel' } = req.body || {};",
  "  if (quantity === undefined || quantity === null || quantity === '') return res.status(400).json({ error: 'Quantité requise.' });"
].join('\n');
if (!s.includes(oldHead)) { out.push('  ⚠️ en-tête /stock/set non trouvé'); miss++; }
else s = s.replace(oldHead, newHead);

// La logique fine de la destination (remplace le bloc destinataire existant)
const oldDest = [
  "  if (agent_id !== null && agent_id !== undefined) {\n    const member = db.prepare('SELECT * FROM users WHERE id = ?').get(agent_id);",
    "    if (!member || !scopedRoles(req.user).includes(member.role)) return res.status(400).json({ error: 'Destinataire inconnu ou hors de votre périmètre.' });\n  }"
].join('\n');
const newDest = [
  "  if (agent_id !== null && agent_id !== undefined) {\n    const member = db.prepare('SELECT * FROM users WHERE id = ?').get(agent_id);",
  "    if (!member || !scopedRoles(req.user).includes(member.role)) return res.status(400).json({ error: 'Destinataire inconnu ou hors de votre périmètre.' });",
  "    if (!isSuper(req.user)) {",
  "      if (req.user.role !== 'admintech' || member.role !== 'technicien') return res.status(403).json({ error: 'Le superviseur technique dote uniquement ses techniciens (le dépôt central est géré par la direction).' });",
  "    }",
  "  } else if (!isSuper(req.user)) {",
  "    return res.status(403).json({ error: 'La saisie du stock central est réservée à la direction.' });",
  "  }"
].join('\n');
if (s.includes(oldDest)) { s = s.replace(oldDest, newDest); out.push('  admin: logique de destination fine insérée'); }
else { out.push('  ⚠️ admin: bloc destinataire non trouvé'); miss++; }

fs.writeFileSync(p, s.join('\n'), 'utf8');
console.log(out.join('\n'));
console.log(miss ? 'PARTIEL' : 'OK');