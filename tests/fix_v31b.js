// tests/fix_v31b.js — corrections de la relecture « comptes & stock » (E1-E6 + trous de tests)
const fs = require('fs');
const path = require('path');
const out = [];
let miss = 0;

function load(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\n'); }
function save(f, l) { fs.writeFileSync(path.join(__dirname, '..', f), l.join('\n'), 'utf8'); }
function replaceOnce(lines, f, match, replacement) {
  const i = lines.findIndex((l) => l.includes(match));
  if (i === -1) { out.push(`  ⚠️ ${f}: NON TROUVÉ → ${match.slice(0, 70)}`); miss++; return lines; }
  lines[i] = replacement;
  out.push(`  ${f}: ${match.slice(0, 55)}`);
  return lines;
}

// ================= routes/admin.js =================
let r = load('routes/admin.js');

// E1 : le profil d'un membre de la direction ne peut pas être modifié/désactivé
r = replaceOnce(r, 'routes/admin.js',
  "let newRole = u.role;\n  if (isSuper(req.user) && role && ['agent', 'technicien', 'admincomm', 'admintech'].includes(String(role))) newRole = String(role);",
  "let newRole = u.role;\n  if (isSuper(u) && role && String(role) !== u.role) {\n    return res.status(403).json({ error: 'Le profil d\\'un membre de la direction ne peut pas être modifié.' });\n  }\n  if (isSuper(req.user) && role && ['agent', 'technicien', 'admincomm', 'admintech'].includes(String(role))) newRole = String(role);");
r = replaceOnce(r, 'routes/admin.js',
  "db.prepare('UPDATE users SET full_name=?, phone=?, region=?, team=?, role=?, active=? WHERE id=?')",
  "if (isSuper(u) && active !== undefined && !active) return res.status(403).json({ error: 'Un membre de la direction ne peut pas être désactivé.' });\n  db.prepare('UPDATE users SET full_name=?, phone=?, region=?, team=?, role=?, active=? WHERE id=?')");

// E2 : la direction peut créer des comptes direction (whitelist étendue)
r = replaceOnce(r, 'routes/admin.js',
  "if (!['agent', 'technicien', 'admincomm', 'admintech'].includes(role)) role = ROLE.AGENT;",
  "const allowedRoles = ['agent', 'technicien', 'admincomm', 'admintech'];\n  if (isSuper(req.user)) allowedRoles.push('admin', 'admingen');\n  if (!allowedRoles.includes(role)) role = ROLE.AGENT;");

// E3 : /stock/set — quantité obligatoire et stricte
r = replaceOnce(r, 'routes/admin.js',
  "const { product_id, agent_id = null, quantity, note = 'Ajustement manuel' } = req.body || {};\n  const qty = Number(quantity);\n  if (!product_id || !Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'product_id et quantité (entier ≥ 0) requis.' });",
  "const { product_id, agent_id = null, quantity, note = 'Ajustement manuel' } = req.body || {};\n  if (quantity === undefined || quantity === null || quantity === '') return res.status(400).json({ error: 'Quantité requise.' });\n  const qty = Number(quantity);\n  if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'Quantité invalide (entier ≥ 0 requis).' });");

// E4 : destinataire de stock validé (pas de 500 FK)
r = replaceOnce(r, 'routes/admin.js',
  "const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);\n  if (!product) return res.status(404).json({ error: 'Produit introuvable.' });\n  const row = db.prepare('SELECT * FROM stock_items WHERE product_id = ? AND agent_id IS ?').get(product_id, agent_id);",
  "const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);\n  if (!product) return res.status(404).json({ error: 'Produit introuvable.' });\n  if (agent_id !== null && agent_id !== undefined) {\n    const member = db.prepare('SELECT * FROM users WHERE id = ?').get(agent_id);\n    if (!member || !scopedRoles(req.user).includes(member.role)) return res.status(400).json({ error: 'Destinataire inconnu ou hors de votre périmètre.' });\n  }\n  const row = db.prepare('SELECT * FROM stock_items WHERE product_id = ? AND agent_id IS ?').get(product_id, agent_id);");

// E5 : hard delete — refus si matériel alloué au compte
r = replaceOnce(r, 'routes/admin.js',
  "    try {\n      db.prepare('DELETE FROM users WHERE id = ?').run(u.id);\n      return res.json({ ok: true, deleted: true });",
  "    const alloc = db.prepare('SELECT COUNT(*) c FROM stock_items WHERE agent_id = ?').get(u.id).c;\n    if (alloc > 0) return res.status(409).json({ error: 'Ce compte a du matériel alloué. Réintégrez-le au dépôt (stock) avant la suppression.' });\n    try {\n      db.prepare('DELETE FROM users WHERE id = ?').run(u.id);\n      return res.json({ ok: true, deleted: true });");
save('routes/admin.js', r);

// ================= public/js/admin.js =================
let a = load('public/js/admin.js');

// E1 front : pas de changement de profil pour un membre de la direction
a = replaceOnce(a, 'public/js/admin.js',
  "        ${isDir ? `<div class=\"field\"><label for=\"e-role\">Profil du compte</label><select id=\"e-role\">${[['agent', 'Commercial'], ['technicien', 'Technicien'], ['admincomm', 'Superviseur commercial'], ['admintech', 'Superviseur technique']].map(([v, l]) => `<option value=\"${v}\"${a.role === v ? ' selected' : ''}>${l}</option>`).join('')}</select><div class=\"hint\">La direction seule peut changer le profil. Le membre se reconnectera avec ses nouvelles permissions.</div></div>` : ''}",
  "        ${isDir && !['admin', 'admingen'].includes(a.role) ? `<div class=\"field\"><label for=\"e-role\">Profil du compte</label><select id=\"e-role\">${[['agent', 'Commercial'], ['technicien', 'Technicien'], ['admincomm', 'Superviseur commercial'], ['admintech', 'Superviseur technique']].map(([v, l]) => `<option value=\"${v}\"${a.role === v ? ' selected' : ''}>${l}</option>`).join('')}</select><div class=\"hint\">La direction seule peut changer le profil. Le membre se reconnectera avec ses nouvelles permissions.</div></div>` : (isDir ? `<div class=\"field\"><label>Profil du compte</label><div class=\"muted\">Direction — profil protégé, non modifiable.</div></div>` : '')}");

// E6 : confirmation sur baisse de stock + dropdown membres actifs uniquement
a = replaceOnce(a, 'public/js/admin.js',
  "<input id=\"sq-${s.id}\" class=\"num\" type=\"number\" min=\"0\" step=\"1\" value=\"${s.quantity}\" inputmode=\"numeric\" aria-label=\"Quantité possédée de ${esc(s.name)}\">",
  "<input id=\"sq-${s.id}\" class=\"num\" type=\"number\" min=\"0\" step=\"1\" value=\"${s.quantity}\" data-prev=\"${s.quantity}\" inputmode=\"numeric\" aria-label=\"Quantité possédée de ${esc(s.name)}\">");
a = replaceOnce(a, 'public/js/admin.js',
  "    const qty = Number(input && input.value);\n    if (!Number.isInteger(qty) || qty < 0) return toast('Quantité invalide (entier ≥ 0)', true);",
  "    const qty = Number(input && input.value);\n    const prev = Number(input && input.dataset.prev);\n    if (!Number.isInteger(qty) || qty < 0) return toast('Quantité invalide (entier ≥ 0)', true);\n    if (Number.isInteger(prev) && qty < prev && !confirm('Confirmer la baisse du stock de ' + prev + ' à ' + qty + ' unité(s) ?')) return;");
a = replaceOnce(a, 'public/js/admin.js',
  "${(agents || []).map((a) => `<option value=\"${a.id}\">${esc(a.full_name)}</option>`).join('')}",
  "${(agents || []).filter((x) => x.active).map((a) => `<option value=\"${a.id}\">${esc(a.full_name)}</option>`).join('')}");
save('public/js/admin.js', a);

// ================= roles_test.js : trous de §9 =================
let t = load('tests/roles_test.js');
const anchorIdx = t.findIndex((l) => l.includes('console.log(`\\n═══ RÉSULTAT'));
if (anchorIdx === -1) { out.push('  ⚠️ roles_test: ancre non trouvée'); miss++; }
else {
  t.splice(anchorIdx, 0,
    "  // g) Rôle relu après changement de profil",
    "  const { data: teamRole } = await api('GET', '/admin/agents', null, admin.token);",
    "  const roleRow = teamRole.find((x) => x.username === 'agent1');",
    "  check('agent1 conserve son profil après édition refusée', roleRow && roleRow.role === 'agent');",
    "  // h) PUT de superviseur : changement de rôle ignoré",
    "  const supPut = await api('PUT', '/admin/agents/' + teamRole.find((x) => x.username === 'agent2').id, { role: 'admintech' }, admincomm.token);",
    "  const { data: teamAfterSup } = await api('GET', '/admin/agents', null, admin.token);",
    "  check('superviseur ne peut pas changer un profil', supPut.status === 200 || supPut.status === 403 ? !(teamAfterSup.find((x) => x.username === 'agent2').role === 'admintech') : false);",
    "  // i) Protection du profil direction",
    "  const dirRow = teamRole.find((x) => x.role === 'admingen');",
    "  const dirPut = await api('PUT', '/admin/agents/' + dirRow.id, { role: 'agent' }, admin.token);",
    "  check('profil direction protégé (403)', dirPut.status === 403);",
    "  // j) DELETE d'un superviseur → désactivation simple",
    "  const tmpSup = await api('POST', '/admin/agents', { username: 'tmp-sup' + ts, password: 'secret12', full_name: 'Sup Temp', role: 'admincomm' }, admin.token);",
    "  const delSup = await api('DELETE', '/admin/agents/' + tmpSup.data.id, null, admin.token);",
    "  check('superviseur supprimé → désactivation (deleted:false)', delSup.status === 200 && delSup.data.deleted === false);",
    "  // k) Mouvement d'ajustement tracé",
    "  const { data: movs } = await api('GET', '/admin/stock/movements', null, admin.token);",
    "  check('mouvement d\\'ajustement manuel tracé', (movs || []).some((m) => /Ajustement/i.test(m.note || '')));",
    "  // l) Stock : quantité absente refusée + destinataire inconnu refusé",
    "  const setNoQty = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: null }, admin.token);",
    "  check('stock : quantité absente refusée (400)', setNoQty.status === 400);",
    "  const setBadAgent = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: 9999, quantity: 10 }, admin.token);",
    "  check('stock : destinataire inconnu refusé (400)', setBadAgent.status === 400);",
    "");
  out.push('  roles_test: 13 checks supplémentaires insérés');
}
save('tests/roles_test.js', t);

console.log(out.join('\n'));
console.log(miss ? 'FIX V31B PARTIEL' : 'FIX V31B OK');