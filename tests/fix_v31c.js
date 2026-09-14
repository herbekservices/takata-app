// tests/fix_v31c.js — applique E1/E3/E4/E5 malgré les fins de ligne CRLF (regex tolérante)
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'routes', 'admin.js');
let s = fs.readFileSync(p, 'utf8');
const out = [];
let miss = 0;

const NL = '(?:\\r?\\n)';
function re(esc) { return new RegExp(esc, ''); }

// E1 : garde de profil direction + active protégé
if (!/Le profil d'une membre|Le profil d'un membre de la direction/.test(s)) {
  const e1 = new RegExp(
    "(  let newRole = u\\.role;" + NL +
    "  if \\(isSuper\\(req\\.user\\) && role && \\['agent', 'technicien', 'admincomm', 'admintech'\\]\\.includes\\(String\\(role\\)\\)\\) newRole = String\\(role\\);)"
  );
  if (!e1.test(s)) { out.push('  ⚠️ E1 : bloc newRole non trouvé'); miss++; }
  else {
    s = s.replace(e1,
      "$1\n  if (isSuper(u) && role && String(role) !== u.role) {\n    return res.status(403).json({ error: 'Le profil d\\'un membre de la direction ne peut pas être modifié.' });\n  }");
    out.push('  E1 : garde 403 sur changement de profil direction insérée');
  }
} else out.push('  E1 : déjà appliqué');

if (!/Un membre de la direction ne peut pas être désactivé/.test(s)) {
  const e1b = new RegExp(
    "(  db\\.prepare\\('UPDATE users SET full_name=\\?, phone=\\?, region=\\?, team=\\?, role=\\?, active=\\? WHERE id=\\?'\\))"
  );
  if (!e1b.test(s)) { out.push('  ⚠️ E1b : UPDATE non trouvé'); miss++; }
  else {
    s = s.replace(e1b, "  if (isSuper(u) && active !== undefined && !active) return res.status(403).json({ error: 'Un membre de la direction ne peut pas être désactivé.' });\n$1");
    out.push('  E1b : désactivation de la direction bloquée');
  }
} else out.push('  E1b : déjà appliqué');

// E3 : /stock/set — quantité requise
if (!/Quantité requise\./.test(s)) {
  const e3 = new RegExp(
    "(  const \\{ product_id, agent_id = null, quantity, note = 'Ajustement manuel' \\} = req\\.body \\|\\| \\{\\};" + NL +
    "  const qty = Number\\(quantity\\);" + NL +
    "  if \\(!product_id \\|\\| !Number\\.isInteger\\(qty\\) \\|\\| qty < 0\\) return res\\.status\\(400\\)\\.json\\(\\{ error: 'product_id et quantité \\(entier ≥ 0\\) requis\\.' \\}\\);)"
  );
  if (!e3.test(s)) { out.push('  ⚠️ E3 : bloc /stock/set non trouvé'); miss++; }
  else {
    s = s.replace(e3,
      "  const { product_id, agent_id = null, quantity, note = 'Ajustement manuel' } = req.body || {};\n  if (quantity === undefined || quantity === null || quantity === '') return res.status(400).json({ error: 'Quantité requise.' });\n  const qty = Number(quantity);\n  if (!product_id || !Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'product_id et quantité (entier ≥ 0) requis.' });");
    out.push('  E3 : quantité requise insérée');
  }
} else out.push('  E3 : déjà appliqué');

// E4 : destinataire validé
if (!/Destinataire inconnu ou hors de votre périmètre/.test(s)) {
  const e4 = new RegExp(
    "(  const row = db\\.prepare\\('SELECT \\* FROM stock_items WHERE product_id = \\? AND agent_id IS \\?'\\)\\.get\\(product_id, agent_id\\);)"
  );
  if (!e4.test(s)) { out.push('  ⚠️ E4 : ancre row non trouvée'); miss++; }
  else {
    s = s.replace(e4,
      "  if (agent_id !== null && agent_id !== undefined) {\n    const member = db.prepare('SELECT * FROM users WHERE id = ?').get(agent_id);\n    if (!member || !scopedRoles(req.user).includes(member.role)) return res.status(400).json({ error: 'Destinataire inconnu ou hors de votre périmètre.' });\n  }\n$1");
    out.push('  E4 : validation du destinataire insérée');
  }
} else out.push('  E4 : déjà appliqué');

// E5 : hard delete — refus si matériel alloué
if (!/matériel alloué/.test(s)) {
  const e5 = new RegExp(
    "(    try {" + NL +
    "      db\\.prepare\\('DELETE FROM users WHERE id = \\?'\\)\\.run\\(u\\.id\\);)"
  );
  if (!e5.test(s)) { out.push('  ⚠️ E5 : bloc delete non trouvé'); miss++; }
  else {
    s = s.replace(e5,
      "    const alloc = db.prepare('SELECT COUNT(*) c FROM stock_items WHERE agent_id = ?').get(u.id).c;\n    if (alloc > 0) return res.status(409).json({ error: 'Ce compte a du matériel alloué. Réintégrez-le au dépôt (stock) avant la suppression.' });\n$1");
    out.push('  E5 : contrôle de matériel alloué inséré');
  }
} else out.push('  E5 : déjà appliqué');

fs.writeFileSync(p, s.replace(/\r\n/g, '\n'), 'utf8');
console.log(out.join('\n'));
console.log(miss ? 'FIX V31C PARTIEL' : 'FIX V31C OK');

// ---- correction du test (j) : la direction supprime (hard delete) un superviseur ----
const tp = path.join(__dirname, '..', 'tests', 'roles_test.js');
let t = fs.readFileSync(tp, 'utf8');
t = t.replace(
  "check('superviseur supprimé → désactivation (deleted:false)', delSup.status === 200 && delSup.data.deleted === false);",
  "check('direction supprime un superviseur (hard delete)', delSup.status === 200 && delSup.data.deleted === true);"
);
fs.writeFileSync(tp, t, 'utf8');
console.log('test (j) aligné sur le design (direction → hard delete)');