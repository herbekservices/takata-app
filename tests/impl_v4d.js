// tests/impl_v4d.js — routes/admin.js : stock manuel + suppression/édition comptes ; roles_test section 9
const fs = require('fs');
const path = require('path');
const out = [];

function proc(f, fn) {
  const p = path.join(__dirname, '..', f);
  let s = fs.readFileSync(p, 'utf8').split('\n');
  fn(s, f);
  fs.writeFileSync(p, s.join('\n'), 'utf8');
}
function replaceOnce(s, f, match, replacement) {
  const i = s.findIndex((l) => l.includes(match));
  if (i === -1) { out.push(`  ⚠️ ${f}: NON TROUVÉ → ${match.slice(0, 60)}`); return; }
  s[i] = replacement;
  out.push(`  ${f}: ${match.slice(0, 50)}`);
}

// ================= routes/admin.js =================
proc('routes/admin.js', (s, f) => {
  // 1. GET /admin/stock : inclure product_id (pour la saisie manuelle)
  replaceOnce(s, f, "SELECT si.id, si.quantity, p.name, p.price, p.category, si.agent_id,",
    "SELECT si.id, si.quantity, si.product_id, p.name, p.price, p.category, si.agent_id,");

  // 2. PUT /agents/:id : changement de profil réservé à la direction
  replaceOnce(s, f, "const { full_name, phone, region, team, active } = req.body || {};\n  db.prepare('UPDATE users SET full_name=?, phone=?, region=?, team=?, active=? WHERE id=?')",
    "const { full_name, phone, region, team, active, role } = req.body || {};\n  let newRole = u.role;\n  if (isSuper(req.user) && role && ['agent', 'technicien', 'admincomm', 'admintech'].includes(String(role))) newRole = String(role);\n  db.prepare('UPDATE users SET full_name=?, phone=?, region=?, team=?, role=?, active=? WHERE id=?')");
  replaceOnce(s, f, ".run(full_name || u.full_name, phone ?? u.phone, region ?? u.region, active === undefined ? u.active : (active ? 1 : 0), u.id);",
    ".run(full_name || u.full_name, phone ?? u.phone, region ?? u.region, team ?? u.team, newRole, active === undefined ? u.active : (active ? 1 : 0), u.id);");

  // 3. DELETE : suppression définitive pour la direction, désactivation pour les superviseurs
  replaceOnce(s, f, "if (isSuper(u)) return res.status(403).json({ error: 'Impossible de désactiver la direction.' });",
    "if (isSuper(u)) return res.status(403).json({ error: 'Impossible de supprimer la direction.' });\n  if (u.id === req.user.id) return res.status(403).json({ error: 'Impossible de supprimer votre propre compte.' });\n  if (isSuper(req.user)) {\n    // Suppression définitive (direction) : refusée si le compte possède des données liées\n    try {\n      db.prepare('DELETE FROM users WHERE id = ?').run(u.id);\n      return res.json({ ok: true, deleted: true });\n    } catch (e) {\n      return res.status(409).json({ error: 'Ce compte possède des données liées (clients, paiements…). Désactivez-le plutôt.' });\n    }\n  }");

  // 4. POST /admin/stock/set : saisie manuelle de la quantité possédée
  const anchorIdx = s.findIndex((l) => l.includes('// ---- Commissions (paiement des commissions) ----'));
  if (anchorIdx === -1) { out.push(`  ⚠️ ${f}: ancre Commissions non trouvée`); return; }
  s.splice(anchorIdx, 0,
    "// Saisie manuelle : définir la quantité possédée (dépôt central ou membre)",
    "router.post('/stock/set', (req, res) => {",
    "  const { product_id, agent_id = null, quantity, note = 'Ajustement manuel' } = req.body || {};",
    "  const qty = Number(quantity);",
    "  if (!product_id || !Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'product_id et quantité (entier ≥ 0) requis.' });",
    "  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);",
    "  if (!product) return res.status(404).json({ error: 'Produit introuvable.' });",
    "  const row = db.prepare('SELECT * FROM stock_items WHERE product_id = ? AND agent_id IS ?').get(product_id, agent_id);",
    "  const before = row ? row.quantity : 0;",
    "  const delta = qty - before;",
    "  const tx = db.transaction(() => {",
    "    if (!row) db.prepare('INSERT INTO stock_items (product_id, agent_id, quantity) VALUES (?,?,?)').run(product_id, agent_id, qty);",
    "    else db.prepare('UPDATE stock_items SET quantity = ? WHERE id = ?').run(qty, row.id);",
    "    if (delta !== 0) db.prepare(`INSERT INTO stock_movements (product_id, agent_id, type, quantity, note) VALUES (?,?,?,?,?)`)",
    "      .run(product_id, agent_id, delta > 0 ? 'in' : 'out', delta, String(note));",
    "  });",
    "  tx();",
    "  res.json({ ok: true, quantity: qty });",
    "});",
    "");
  out.push(`  ${f}: route /stock/set insérée`);
});

// ================= tests/roles_test.js : section 9 =================
proc('tests/roles_test.js', (s, f) => {
  const anchorIdx = s.findIndex((l) => l.includes('console.log(`\\n═══ RÉSULTAT'));
  if (anchorIdx === -1) { out.push(`  ⚠️ ${f}: ancre RÉSULTAT non trouvée`); return; }
  s.splice(anchorIdx, 0,
    "  console.log('── 9. GESTION DES COMPTES & STOCK MANUEL (v3.1) ──');",
    "  // a) Édition : renommer + téléphone par la direction",
    "  const acct = await api('POST', '/admin/agents', { username: 'edit-me' + ts, password: 'secret12', full_name: 'Édit Test', role: 'agent', phone: '+243 000 111 222', region: 'Kolwezi' }, admin.token);",
    "  check('création du compte à éditer (HTTP ' + acct.status + ')', acct.status === 201);",
    "  const edit = await api('PUT', '/admin/agents/' + acct.data.id, { full_name: 'Édit Test Renommé', phone: '+243 999 888 777' }, admin.token);",
    "  check('direction renomme le compte + téléphone (HTTP ' + edit.status + ')', edit.status === 200);",
    "  const { data: teamAfter } = await api('GET', '/admin/agents', null, admin.token);",
    "  const renamed = teamAfter.find((x) => x.id === acct.data.id);",
    "  check('renommage persisté : ' + (renamed && renamed.full_name) + ' / ' + (renamed && renamed.phone), renamed && renamed.full_name === 'Édit Test Renommé' && renamed.phone === '+243 999 888 777');",
    "  // b) Suppression du numéro de téléphone (champ vide)",
    "  await api('PUT', '/admin/agents/' + acct.data.id, { phone: '' }, admin.token);",
    "  const { data: teamEmpty } = await api('GET', '/admin/agents', null, admin.token);",
    "  const emptied = teamEmpty.find((x) => x.id === acct.data.id);",
    "  check('numéro de téléphone supprimé (vide)', emptied && (emptied.phone === '' || emptied.phone === null));",
    "  // c) Changement de profil par la direction",
    "  const roleChange = await api('PUT', '/admin/agents/' + acct.data.id, { role: 'technicien' }, admin.token);",
    "  check('direction change le profil (agent → technicien)', roleChange.status === 200);",
    "  // d) Suppression définitive d'un compte sans données liées",
    "  const del = await api('DELETE', '/admin/agents/' + acct.data.id, null, admin.token);",
    "  check('direction supprime le compte (hard delete)', del.status === 200 && del.data.deleted === true);",
    "  const { data: teamGone } = await api('GET', '/admin/agents', null, admin.token);",
    "  check('compte disparu de la liste', !(teamGone || []).some((x) => x.id === acct.data.id));",
    "  // e) Suppression refusée si données liées (agent1 a des clients)",
    "  const { data: teamAll } = await api('GET', '/admin/agents', null, admin.token);",
    "  const a1row = teamAll.find((x) => x.username === 'agent1');",
    "  const delBlocked = await api('DELETE', '/admin/agents/' + a1row.id, null, admin.token);",
    "  check('suppression refusée si données liées (409 + conseil)', delBlocked.status === 409);",
    "  // f) Stock : saisie manuelle des quantités possédées",
    "  const { data: prodsAll } = await api('GET', '/products', null, admin.token);",
    "  const sacs = prodsAll.find((p) => p.name.includes('Sacs'));",
    "  const set1 = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: null, quantity: 250 }, admin.token);",
    "  check('stock : saisie manuelle acceptée (250)', set1.status === 200 && set1.data.quantity === 250);",
    "  const { data: stockAdmin } = await api('GET', '/admin/stock', null, admin.token);",
    "  const line = stockAdmin.find((st) => st.product_id === sacs.id && st.agent_id === null);",
    "  check('quantité persistée en base : ' + (line && line.quantity), line && line.quantity === 250);",
    "  const set2 = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: null, quantity: 240 }, admin.token);",
    "  check('ajustement à la baisse accepté (240)', set2.status === 200);",
    "  const setBad = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: null, quantity: -5 }, admin.token);",
    "  check('quantité négative refusée (400)', setBad.status === 400);",
    "");
  out.push(`  ${f}: section 9 insérée (gestion comptes + stock)`);
});

console.log(out.join('\n'));
console.log(out.some((l) => l.includes('⚠️')) ? 'IMPL D PARTIELLE' : 'IMPL D OK');