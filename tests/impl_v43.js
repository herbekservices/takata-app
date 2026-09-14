// tests/impl_v43.js — backend : permissions direction-only + tournées + demandes matériel + intrants non vendables
const fs = require('fs');
const path = require('path');
const out = [];
let miss = 0;

function load(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); }
function save(f, s) { fs.writeFileSync(path.join(__dirname, '..', f), s, 'utf8'); }
function rep(f, match, replacement) {
  const p = path.join(__dirname, '..', f);
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes(match)) { out.push(`  ⚠️ ${f}: NON TROUVÉ → ${match.slice(0, 70)}`); miss++; return; }
  s = s.replace(match, replacement);
  save(f, s);
  out.push(`  ${f}: ${match.slice(0, 55)}`);
}

// ============ 1. db.js : tables tournees + tech_demandes ============
rep('db.js',
  "CREATE TABLE IF NOT EXISTS sync_queue (",
  [
    "CREATE TABLE IF NOT EXISTS tournees (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  technicien_id INTEGER NOT NULL REFERENCES users(id),",
    "  assignee_par INTEGER NOT NULL REFERENCES users(id),",
    "  date TEXT NOT NULL DEFAULT (date('now','localtime')),",
    "  zone TEXT DEFAULT '',",
    "  menages_prevus INTEGER NOT NULL DEFAULT 0,",
    "  statut TEXT NOT NULL DEFAULT 'assignee', /* assignee | validee */",
    "  menages_servis INTEGER NOT NULL DEFAULT 0,",
    "  observations TEXT DEFAULT '',",
    "  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))",
    ");",
    "",
    "CREATE TABLE IF NOT EXISTS tech_demandes (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  user_id INTEGER NOT NULL REFERENCES users(id),",
    "  product_id INTEGER NOT NULL REFERENCES products(id),",
    "  quantite REAL NOT NULL DEFAULT 0,",
    "  motif TEXT DEFAULT '',",
    "  statut TEXT NOT NULL DEFAULT 'ouverte', /* ouverte | traitee */",
    "  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))",
    ");",
    "",
    "CREATE TABLE IF NOT EXISTS sync_queue ("
  ].join('\n')
);

// ============ 2. seed.js : purge des nouvelles tables ============
rep('seed.js',
  "const tables = ['tech_report_items', 'tech_reports', 'notifications', 'commissions', 'installments', 'payments', 'installations',\n    'prospects', 'customers', 'stock_movements', 'stock_items', 'products', 'tokens', 'sync_queue', 'users'];",
  "const tables = ['tech_demandes', 'tournees', 'tech_report_items', 'tech_reports', 'notifications', 'commissions', 'installments', 'payments', 'installations',\n    'prospects', 'customers', 'stock_movements', 'stock_items', 'products', 'tokens', 'sync_queue', 'users'];"
);

// ============ 3. routes/admin.js : direction-only pour comptes + stock ============
let ad = load('routes/admin.js');
// POST /agents : direction seule
ad = ad.replace(
  "router.post('/agents', (req, res) => {\n  const { username, password, full_name, phone = '', region = '', team = '' } = req.body || {};",
  "router.post('/agents', (req, res) => {\n  if (!isSuper(req.user)) return res.status(403).json({ error: 'La création de comptes est réservée à la direction (adminGEN).' });\n  const { username, password, full_name, phone = '', region = '', team = '' } = req.body || {};"
);
// PUT /agents/:id : direction seule (après le contrôle d'existence)
ad = ad.replace(
  "  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);\n  if (!u || !scopedRoles(req.user).includes(u.role)) return res.status(404).json({ error: 'Membre d\\'équipe introuvable.' });\n  const { full_name, phone, region, team, active, role } = req.body || {};",
  "  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);\n  if (!u || !scopedRoles(req.user).includes(u.role)) return res.status(404).json({ error: 'Membre d\\'équipe introuvable.' });\n  if (!isSuper(req.user)) return res.status(403).json({ error: 'La modification de comptes est réservée à la direction.' });\n  const { full_name, phone, region, team, active, role } = req.body || {};"
);
// DELETE /agents/:id : direction seule
ad = ad.replace(
  "  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);\n  if (!u || !scopedRoles(req.user).includes(u.role)) return res.status(404).json({ error: 'Membre d\\'équipe introuvable.' });\n  if (isSuper(u)) return res.status(403).json({ error: 'Impossible de supprimer la direction.' });",
  "  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);\n  if (!u || !scopedRoles(req.user).includes(u.role)) return res.status(404).json({ error: 'Membre d\\'équipe introuvable.' });\n  if (!isSuper(req.user)) return res.status(403).json({ error: 'La gestion des comptes est réservée à la direction.' });\n  if (isSuper(u)) return res.status(403).json({ error: 'Impossible de supprimer la direction.' });"
);
// POST /stock/set : direction seule
ad = ad.replace(
  "router.post('/stock/set', (req, res) => {\n  const { product_id, agent_id = null, quantity, note = 'Ajustement manuel' } = req.body || {};",
  "router.post('/stock/set', (req, res) => {\n  if (!isSuper(req.user)) return res.status(403).json({ error: 'La saisie du stock est réservée à la direction.' });\n  const { product_id, agent_id = null, quantity, note = 'Ajustement manuel' } = req.body || {};"
);
// POST /stock/move : direction seule
ad = ad.replace(
  "router.post('/stock/move', (req, res) => {",
  "router.post('/stock/move', (req, res) => {\n  if (!isSuper(req.user)) return res.status(403).json({ error: 'La gestion du stock est réservée à la direction.' });"
);
// GET /admin/stock : les superviseurs voient sans le coût (les quantités restent visibles pour la gestion d'équipe)
ad = ad.replace(
  "    SELECT si.id, si.quantity, si.product_id, p.name, p.price, p.category, si.agent_id, COALESCE(u.full_name,'Dépôt central') AS agent",
  "    SELECT si.id, si.quantity, si.product_id, p.name, ${isSuper(req.user) ? 'p.price, p.cost,' : ''} p.category, si.agent_id, COALESCE(u.full_name,'Dépôt central') AS agent"
);
save('routes/admin.js', ad);
out.push('  routes/admin.js: permissions direction-only + stock sans coût pour superviseurs');

// ============ 4. routes/agent.js : intrants non vendables + produits sans coût (super only) + dispo technicien ============
let ag = load('routes/agent.js');
// POST /installations : refuser les intrants
ag = ag.replace(
  "router.post('/installations', guardCommercial, (req, res) => {",
  "router.post('/installations', guardCommercial, (req, res) => {\n  const catCheck = db.prepare('SELECT category FROM products WHERE id = ?').get(Number(req.body.product_id));\n  if (catCheck && catCheck.category !== 'Formule collecte') {\n    return res.status(400).json({ error: 'Cet article n\\'est pas à la vente (intrant de service, géré par la direction).' });\n  }"
);
// GET /products : le coût reste à la direction uniquement
ag = ag.replace(
  "  const wide = isSuper(req.user) || req.user.role === 'admincomm' || req.user.role === 'admintech';",
  "  const wide = isSuper(req.user);"
);
// GET /stock (technicien) : disponibilité sans quantités précises
ag = ag.replace(
  "  // Technicien : matériel terrain partagé (intrants utiles aux tournées)\n  if (isTechnician(req.user)) {\n    return res.json(db.prepare(`\n      SELECT si.id, si.quantity, p.name, p.price, p.category, COALESCE(u.full_name,'Dépôt central') AS agent\n      FROM stock_items si JOIN products p ON p.id = si.product_id LEFT JOIN users u ON u.id = si.agent_id\n      WHERE p.category = 'Intrant' OR si.agent_id = ?\n      ORDER BY si.agent_id IS NOT NULL, p.name`).all(req.user.id));\n  }",
  "  // Technicien : la DISPONIBILITÉ du matériel (pas les quantités précises ni les coûts)\n  if (isTechnician(req.user)) {\n    const rows = db.prepare(`\n      SELECT p.id AS product_id, p.name, p.category,\n        CASE WHEN COALESCE((SELECT SUM(quantity) FROM stock_items si WHERE si.product_id = p.id), 0) > 0 THEN 1 ELSE 0 END AS disponible\n      FROM products p WHERE p.category = 'Intrant' ORDER BY p.name`).all();\n    return res.json(rows);\n  }"
);
save('routes/agent.js', ag);
out.push('  routes/agent.js: intrants non vendables + dispo technicien');

// ============ 5. routes/tech.js : tournées + demandes ============
let t = load('routes/tech.js');
const extra = [
  "",
  "// ============ TOURNÉES : le superviseur technique / la direction assignent, le technicien valide ============",
  "// POST /api/tech/tournees — assigner une tournée (admintech / direction)",
  "router.post('/tournees', (req, res) => {",
  "  if (!isSuper(req.user) && req.user.role !== 'admintech') return res.status(403).json({ error: 'Réservé au superviseur technique et à la direction.' });",
  "  const { technicien_id, date, zone = '', menages_prevus = 0 } = req.body || {};",
  "  const tech = db.prepare(\"SELECT id FROM users WHERE id = ? AND role = 'technicien' AND active = 1\").get(Number(technicien_id));",
  "  if (!tech) return res.status(404).json({ error: 'Technicien introuvable ou inactif.' });",
  "  const day = date || new Date().toISOString().slice(0, 10);",
  "  const id = db.prepare(`INSERT INTO tournees (technicien_id, assignee_par, date, zone, menages_prevus) VALUES (?,?,?,?,?)`)",
  "    .run(tech.id, req.user.id, day, String(zone || '').slice(0, 200), Math.max(0, Number(menages_prevus) || 0)).lastInsertRowid;",
  "  res.status(201).json({ id, date: day, technicien_id: tech.id });",
  "});",
  "",
  "// GET /api/tech/tournees — les tournées (le technicien : les siennes ; admintech : son équipe ; direction : tout)",
  "router.get('/tournees', (req, res) => {",
  "  const roles = scopedRoles(req.user);",
  "  const rolePh = roles.map(() => '?').join(',');",
  "  const rows = db.prepare(`",
  "    SELECT tr.*, u.full_name AS technicien, a.full_name AS assigne_par",
  "    FROM tournees tr JOIN users u ON u.id = tr.technicien_id JOIN users a ON a.id = tr.assignee_par",
  "    WHERE tr.technicien_id IN (SELECT id FROM users WHERE role IN (${rolePh}) AND active = 1)",
  "    ORDER BY tr.date DESC, tr.id DESC LIMIT 200`).all(...roles);",
  "  res.json(rows);",
  "});",
  "",
  "// POST /api/tech/tournees/:id/valider — le technicien valide SA tournée faite",
  "router.post('/tournees/:id/valider', (req, res) => {",
  "  const tour = db.prepare('SELECT * FROM tournees WHERE id = ?').get(Number(req.params.id));",
  "  if (!tour) return res.status(404).json({ error: 'Tournée introuvable.' });",
  "  if (tour.technicien_id !== req.user.id) return res.status(403).json({ error: 'Vous ne pouvez valider que vos propres tournées.' });",
  "  if (tour.statut === 'validee') return res.status(400).json({ error: 'Cette tournée est déjà validée.' });",
  "  const { menages_servis = 0, observations = '' } = req.body || {};",
  "  db.prepare(`UPDATE tournees SET statut = 'validee', menages_servis = ?, observations = ? WHERE id = ?`)",
  "    .run(Math.max(0, Number(menages_servis) || 0), String(observations || '').slice(0, 2000), tour.id);",
  "  res.json({ ok: true, id: tour.id, statut: 'validee' });",
  "});",
  "",
  "// ============ DEMANDES DE MATÉRIEL : le technicien signale, le superviseur traite ============",
  "// POST /api/tech/demandes — le technicien signale un besoin",
  "router.post('/demandes', (req, res) => {",
  "  if (!isTechnician(req.user)) return res.status(403).json({ error: 'Réservé aux techniciens.' });",
  "  const { product_id, quantite = 1, motif = '' } = req.body || {};",
  "  const product = db.prepare(\"SELECT id FROM products WHERE id = ? AND category = 'Intrant'\").get(Number(product_id));",
  "  if (!product) return res.status(404).json({ error: 'Intrant introuvable.' });",
  "  const q = Number(quantite);",
  "  if (!Number.isFinite(q) || q <= 0) return res.status(400).json({ error: 'Quantité invalide.' });",
  "  const id = db.prepare(`INSERT INTO tech_demandes (user_id, product_id, quantite, motif) VALUES (?,?,?,?)`)",
  "    .run(req.user.id, product.id, q, String(motif || '').slice(0, 1000)).lastInsertRowid;",
  "  res.status(201).json({ id });",
  "});",
  "",
  "// GET /api/tech/demandes — les demandes (le technicien : les siennes ; superviseur technique/direction : de l'équipe/tout)",
  "router.get('/demandes', (req, res) => {",
  "  if (req.user.role === 'admincomm') return res.status(403).json({ error: 'Demandes de matériel : hors de votre périmètre.' });",
  "  const roles = scopedRoles(req.user);",
  "  const rolePh = roles.map(() => '?').join(',');",
  "  const rows = db.prepare(`",
  "    SELECT d.*, u.full_name AS technicien, p.name AS produit",
  "    FROM tech_demandes d JOIN users u ON u.id = d.user_id JOIN products p ON p.id = d.product_id",
  "    WHERE d.user_id IN (SELECT id FROM users WHERE role IN (${rolePh}))",
  "    ORDER BY (d.statut = 'ouverte') DESC, d.id DESC LIMIT 200`).all(...roles);",
  "  res.json(rows);",
  "});",
  "",
  "// POST /api/tech/demandes/:id/traiter — le superviseur technique / la direction marque traitée",
  "router.post('/demandes/:id/traiter', (req, res) => {",
  "  if (!isSuper(req.user) && req.user.role !== 'admintech') return res.status(403).json({ error: 'Réservé au superviseur technique et à la direction.' });",
  "  const d = db.prepare('SELECT * FROM tech_demandes WHERE id = ?').get(Number(req.params.id));",
  "  if (!d) return res.status(404).json({ error: 'Demande introuvable.' });",
  "  db.prepare(\"UPDATE tech_demandes SET statut = 'traitee' WHERE id = ?\").run(d.id);",
  "  res.json({ ok: true, id: d.id });",
  "});",
  "",
  "module.exports = router;"
].join('\n');
t = t.replace("\nmodule.exports = router;", extra);
save('routes/tech.js', t);
out.push('  routes/tech.js: tournées + demandes ajoutées');

console.log(out.join('\n'));
console.log(miss ? 'IMPL V43 PARTIELLE' : 'IMPL V43 OK');