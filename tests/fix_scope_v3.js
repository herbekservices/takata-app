// tests/fix_scope_v3.js — Corrections issues de la revue indépendante (subagent_1 + subagent_2)
// F1 sync garde technicien/admintech · F2 commissions hors-ligne · F3 périmètre admintech
// F4 exports scopés par équipe · libellés & design · captures re-render · seed renouvellement
const fs = require('fs');
const path = require('path');
const P = (f) => path.join(__dirname, '..', f);
const out = [];

function readLines(f) { return fs.readFileSync(P(f), 'utf8').split('\n'); }
function writeLines(f, lines) { fs.writeFileSync(P(f), lines.join('\n'), 'utf8'); }

function replaceOnce(f, lines, match, replacement) {
  const i = lines.findIndex((l) => l.includes(match));
  if (i === -1) { out.push(`  ⚠️ ${f}: MOTIF NON TROUVÉ → ${match}`); return lines; }
  lines[i] = replacement;
  out.push(`  ${f}: ligne remplacée (${match})`);
  return lines;
}
function replaceNth(f, lines, match, occurrence, replacement) {
  const idxs = lines.map((l, i) => (l.includes(match) ? i : -1)).filter((i) => i >= 0);
  if (idxs.length < occurrence) { out.push(`  ⚠️ ${f}: occurrence ${occurrence} absente → ${match}`); return lines; }
  lines[idxs[occurrence - 1]] = replacement;
  out.push(`  ${f}: ligne ${idxs[occurrence - 1] + 1} remplacée (occ. ${occurrence} de ${match})`);
  return lines;
}
function insertAfter(f, lines, match, insertion) {
  const i = lines.findIndex((l) => l.includes(match));
  if (i === -1) { out.push(`  ⚠️ ${f}: MOTIF NON TROUVÉ → ${match}`); return lines; }
  lines.splice(i + 1, 0, ...insertion.split('\n'));
  out.push(`  ${f}: insertion après (${match})`);
  return lines;
}

// ============ 1. routes/agent.js : périmètres conformes à la demande ============
let agent = readLines('routes/agent.js');
agent = replaceOnce('routes/agent.js', agent,
  "const { requireAuth, isAdminLike, isTechnician, isCommercial } = require('../auth');",
  "const { requireAuth, isAdminLike, isTechnician, isCommercial, isSuper } = require('../auth');");
agent = replaceOnce('routes/agent.js', agent,
  "const guardCommercial = (req, res, next) => {",
  [
    "// Périmètres : données commerciales = direction + superviseur commercial ;",
    "// données techniques = superviseur technique + techniciens.",
    "const isCommercialScope = (u) => isSuper(u) || u.role === 'admincomm';",
    "const isTechScope = (u) => u.role === 'admintech' || isTechnician(u);",
    "const guardCommercial = (req, res, next) => {"
  ].join(' '));
agent = replaceOnce('routes/agent.js', agent,
  "if (isTechnician(req.user)) return res.status(403).json({ error: 'Action réservée aux équipes commerciales.' });",
  "if (isTechScope(req.user)) return res.status(403).json({ error: 'Action réservée aux équipes commerciales.' });");
agent = replaceOnce('routes/agent.js', agent,
  "return !!customer && (isAdmin(user) || customer.agent_id === user.id);",
  "return !!customer && (isCommercialScope(user) || customer.agent_id === user.id);");
agent = replaceOnce('routes/agent.js', agent,
  "const where = isAdmin(req.user) ? '1=1' : 'agent_id = ?';",
  "const where = isCommercialScope(req.user) ? '1=1' : 'agent_id = ?';");
agent = replaceNth('routes/agent.js', agent, "const rows = isAdmin(req.user)", 1,
  "  const rows = isCommercialScope(req.user)");
agent = replaceOnce('routes/agent.js', agent,
  "if (!isAdmin(req.user) && p.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });",
  "if (!isCommercialScope(req.user) && p.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });");
agent = replaceOnce('routes/agent.js', agent,
  "const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all();\n  res.json(rows);",
  [
    "  const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all();",
    "  // Le coût (marge) reste interne : caché aux profils de terrain",
    "  const wide = isSuper(req.user) || req.user.role === 'admincomm' || req.user.role === 'admintech';",
    "  res.json(wide ? rows : rows.map(({ cost, ...rest }) => rest));"
  ].join('\n'));
agent = replaceOnce('routes/agent.js', agent,
  "const wide = isAdmin(req.user) || isTechnician(req.user);",
  "const wide = isCommercialScope(req.user) || isTechScope(req.user);");
// installations/:id : première des 2 lignes identiques (i.agent_id) → lecture large (tournées)
agent = replaceNth('routes/agent.js', agent,
  "if (!isAdmin(req.user) && i.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });", 1,
  "  if (!isCommercialScope(req.user) && !isTechScope(req.user) && i.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });");
// remind : deuxième occurrence → périmètre commercial
agent = replaceNth('routes/agent.js', agent,
  "if (!isAdmin(req.user) && i.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });", 1,
  "  if (!isCommercialScope(req.user) && i.agent_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé.' });");
agent = replaceOnce('routes/agent.js', agent,
  "if (!isAdmin(req.user)) { cond.push('p.agent_id = ?'); params.push(uid); }",
  "if (!isCommercialScope(req.user)) { cond.push('p.agent_id = ?'); params.push(uid); }");
agent = replaceOnce('routes/agent.js', agent,
  "const cond = [isAdmin(req.user) ? '1=1' : 'i.agent_id = ?'];",
  "const cond = [isCommercialScope(req.user) ? '1=1' : 'i.agent_id = ?'];");
agent = replaceOnce('routes/agent.js', agent,
  "const params = isAdmin(req.user) ? [] : [uid];",
  "const params = isCommercialScope(req.user) ? [] : [uid];");
// commissions GET : where scoping (la garde admintech est déjà assurée par guardCommercial)
agent = replaceOnce('routes/agent.js', agent,
  "const where = isAdmin(req.user) ? '' : 'WHERE c.agent_id = ?';",
  "const where = isCommercialScope(req.user) ? '' : 'WHERE c.agent_id = ?';");
agent = replaceOnce('routes/agent.js', agent,
  "const params = isAdmin(req.user) ? [] : [uid];",
  "const params = isCommercialScope(req.user) ? [] : [uid];");
writeLines('routes/agent.js', agent);

// ============ 2. routes/sync.js : garde équipes techniques + commissions hors-ligne ============
let sync = readLines('routes/sync.js');
sync = replaceOnce('routes/sync.js', sync,
  "const { requireAuth, isAdminLike } = require('../auth');",
  "const { requireAuth, isAdminLike, isTechnician } = require('../auth');");
sync = replaceOnce('routes/sync.js', sync,
  "const isAdmin = isAdminLike;",
  [
    "const isAdmin = isAdminLike;",
    "",
    "// Les équipes techniques (techniciens, admintech) n'utilisent pas la vente hors-ligne",
    "const COMMERCIAL_OPS = ['create_customer', 'update_customer', 'create_prospect', 'update_prospect', 'create_installation', 'record_payment'];",
    "const isTechBlocked = (u) => isTechnician(u) || u.role === 'admintech';"
  ].join('\n'));
sync = replaceOnce('routes/sync.js', sync,
  "function applyOp(user, op, payload) {\n  switch (op) {",
  "function applyOp(user, op, payload) {\n  if (isTechBlocked(user) && COMMERCIAL_OPS.includes(op)) throw new Error('Opération réservée aux équipes commerciales.');\n  switch (op) {");
const payIdx = sync.findIndex((l) => l.includes("if (installment && installment.status === 'pending' && finalAmount >= installment.amount) {"));
if (payIdx === -1) out.push('  ⚠️ sync.js: bloc paiement non trouvé');
else {
  sync.splice(payIdx, 3,
    "    if (installment && installment.status === 'pending' && finalAmount >= installment.amount) {",
    "      db.prepare(`UPDATE installments SET status='paid', paid_date=date('now','localtime'), payment_id=? WHERE id=? AND status='pending'`)",
    "        .run(info.lastInsertRowid, installment.id);",
    "    }",
    "    // Commission TAKATA sur encaissement hors-ligne (identique au chemin en ligne) :",
    "    // renouvellement d'abonnement = 5 % ; séance à la carte = commission_rate (20 % → 500 FC)",
    "    const productRow = installation_id",
    "      ? db.prepare(`SELECT p.* FROM installations i JOIN products p ON p.id = i.product_id WHERE i.id = ?`).get(installation_id)",
    "      : db.prepare(`SELECT p.* FROM installations i JOIN products p ON p.id = i.product_id WHERE i.customer_id = ? ORDER BY i.id DESC LIMIT 1`).get(customer.id);",
    "    const rate = productRow ? (productRow.payg ? 5 : productRow.commission_rate) : 5;",
    "    const comm = Math.round(finalAmount * (rate / 100) * 100) / 100;",
    "    if (comm > 0) db.prepare(`INSERT INTO commissions (agent_id, payment_id, installation_id, amount) VALUES (?,?,?,?)`)",
    "      .run(user.id, info.lastInsertRowid, installation_id || null, comm);");
  out.push('  routes/sync.js: commission hors-ligne ajoutée (record_payment)');
}
writeLines('routes/sync.js', sync);

// ============ 3. routes/reports.js : exports scopés par équipe + anti-injection '-' ============
let rep = readLines('routes/reports.js');
rep = replaceOnce('routes/reports.js', rep,
  "const { requireAuth, requireRole } = require('../auth');",
  "const { requireAuth, requireRole, isSuper } = require('../auth');");
rep = replaceOnce('routes/reports.js', rep,
  "if (/^[=+@\t]/.test(s)) s = \"'\" + s;",
  "if (/^[=+@\t-]/.test(s)) s = \"'\" + s;");
const startIdx = rep.findIndex((l) => l.includes('Les agents exportent leurs propres données'));
if (startIdx === -1) out.push('  ⚠️ reports.js: bloc export non trouvé');
else {
  let endIdx = startIdx;
  while (endIdx < rep.length && rep[endIdx].trim() !== '}') endIdx++;
  const newBlock = [
    "  // Périmètre d'export : direction = tout ; admincomm = équipes commerciales ; admintech = équipes techniques",
    "  let sql = def.sql;",
    "  const params = [];",
    "  if (req.user && !isSuper(req.user)) {",
    "    const teamRole = req.user.role === 'admintech' ? 'technicien' : 'agent';",
    "    const orderCol = type === 'installments' ? 'i.due_date' : (type === 'agents' ? 'u.id' : (type === 'prospects' || type === 'payments') ? 'p.id' : type === 'installations' ? 'i.id' : 'c.id');",
    "    const anchor = 'ORDER BY ' + orderCol;",
    "    if (!sql.includes(anchor)) return res.status(403).json({ error: 'Export non scopé pour ce profil.' });",
    "    const table = orderCol.split('.')[0];",
    "    sql = sql.replace(anchor, `WHERE ${table}.agent_id IN (SELECT id FROM users WHERE role = '${teamRole}') ${anchor}`);",
    "  }"
  ];
  rep.splice(startIdx, endIdx - startIdx + 1, ...newBlock);
  out.push('  routes/reports.js: bloc export scopé remplacé');
}
writeLines('routes/reports.js', rep);

// ============ 4. routes/admin.js : paiement de commissions refusé à l'admintech ============
let adm = readLines('routes/admin.js');
const payRouteIdx = adm.findIndex((l) => l.includes("router.post('/admin/commissions/pay'") || l.includes("router.post('/commissions/pay'"));
if (payRouteIdx === -1) out.push('  ⚠️ admin.js: route commissions/pay non trouvée');
else {
  adm.splice(payRouteIdx + 1, 0,
    "  if (req.user.role === ROLE.ADMINTECH) return res.status(403).json({ error: 'Réservé aux équipes commerciales et à la direction.' });");
  out.push('  routes/admin.js: garde admintech ajoutée sur commissions/pay');
}
writeLines('routes/admin.js', adm);

// ============ 5. seed.js : renouvellement sur une échéance en attente ============
let seed = readLines('seed.js');
seed = replaceOnce('seed.js', seed,
  "SELECT id FROM installments WHERE installation_id = ? AND due_date >= date('now','localtime') ORDER BY due_date LIMIT 1",
  "SELECT id FROM installments WHERE installation_id = ? AND status = 'pending' AND due_date >= date('now','localtime') ORDER BY due_date LIMIT 1");
writeLines('seed.js', seed);

// ============ 6. Front : libellés, design, captures ============
let views = readLines('public/js/views.js');
views = replaceOnce('public/js/views.js', views,
  "toast('Installation enregistrée ✅');",
  "toast('Abonnement souscrit ✅');");
views = replaceOnce('public/js/views.js', views,
  "return emptyState('🔧', 'Installation introuvable');",
  "return emptyState('♻️', 'Abonnement introuvable');");
views = views.map((l) => l.replace(/font-weight:800/g, 'font-weight:600').replace(/font-weight:700/g, 'font-weight:600'));
writeLines('public/js/views.js', views);
out.push('  public/js/views.js: libellés + graisses 600');

let admjs = readLines('public/js/admin.js');
admjs = admjs.map((l) => l.replace(/font-weight:800/g, 'font-weight:600').replace(/font-weight:700/g, 'font-weight:600'));
writeLines('public/js/admin.js', admjs);
out.push('  public/js/admin.js: graisses 600');

let css = readLines('public/css/takata.css');
css = replaceOnce('public/css/takata.css', css,
  "  --green-soft: #F0F7F2;",
  "  --green-soft: #F0F7F2;\n  --green-light: #D5E5DA;");
writeLines('public/css/takata.css', css);

// captures & render-check : forcer le re-rendu après chaque connexion
let snap = readLines('tests/snap_roles.js');
snap = snap.map((l) => {
  if (/location\.hash = '#\/';\s*$/.test(l.trim()) || /location\.hash = '#\/';$/.test(l.trim())) return l + ' if (typeof renderRoute === \'function\') renderRoute();';
  if (l.includes("location.hash = '#/admin';")) return l + ' if (typeof renderRoute === \'function\') renderRoute();';
  if (l.includes("location.hash = '#/admin/agents';")) return l + ' if (typeof renderRoute === \'function\') renderRoute();';
  return l;
});
writeLines('tests/snap_roles.js', snap);
out.push('  tests/snap_roles.js: re-rendu forcé après connexion');

let rc = readLines('tests/render-check.js');
rc = replaceOnce('tests/render-check.js', rc,
  "try { await TAKATA.login(u, p); location.hash = '#/'; }",
  "try { await TAKATA.login(u, p); location.hash = '#/'; if (typeof renderRoute === 'function') renderRoute(); }");
writeLines('tests/render-check.js', rc);

// analyze_snap.py : dénominateur exact
let py = readLines('tests/analyze_snap.py');
py = replaceOnce('tests/analyze_snap.py', py,
  "tot = ((W // 2) + 1) * ((H // 2) + 1)",
  "tot = len(range(0, W, 2)) * len(range(0, H, 2))");
writeLines('tests/analyze_snap.py', py);

console.log(out.join('\n'));
console.log(out.some((l) => l.includes('⚠️')) ? 'PATCH PARTIEL — vérifier les motifs non trouvés' : 'PATCH v3 OK (tous les motifs appliqués)');