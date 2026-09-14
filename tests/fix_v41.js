// tests/fix_v41.js — Durcissement sécurité + périmètres manquants (demande « inviolable »)
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

// ============ 1. server.js : payload 64kb + contrôle d'origine des mutations ============
let sv = load('server.js');
sv = replaceOnce(sv, 'server.js',
  "app.use(express.json({ limit: '2mb' }));",
  "app.use(express.json({ limit: '64kb' })); // borne anti-abus (les lots de sync tiennent largement)");
const secIdx = sv.findIndex((l) => l.includes('frame-ancestors'));
if (secIdx === -1) { out.push('  ⚠️ server: ancre CSP non trouvée'); miss++; }
else {
  // insérer après la fermeture du middleware de sécurité (}); suivant)
  let insertAt = secIdx + 1;
  while (insertAt < sv.length && sv[insertAt].trim() !== '});') insertAt++;
  const csrf = [
    "",
    "// Anti-CSRF : les mutations doivent provenir de la même origine (aucun CORS ouvert)",
    "app.use((req, res, next) => {",
    "  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {",
    "    const origin = String(req.headers.origin || req.headers.referer || '');",
    "    const host = String(req.headers.host || '');",
    "    if (origin && host && !origin.includes(host)) {",
    "      return res.status(403).json({ error: 'Origine non autorisée.' });",
    "    }",
    "  }",
    "  next();",
    "});"
  ];
  sv.splice(insertAt + 1, 0, ...csrf);
  out.push('  server: contrôle d\'origine des mutations inséré');
}
save('server.js', sv);

// ============ 2. routes/auth.js : verrou username systématique + register-agent retiré ============
let au = load('routes/auth.js');
au = replaceOnce(au, 'routes/auth.js',
  "if (isRateLimited(ipKey) || (userKey.length > 5 && isRateLimited(userKey))) {",
  "if (isRateLimited(ipKey) || isRateLimited(userKey)) {");
au = replaceOnce(au, 'routes/auth.js',
  "    registerFailure(ipKey);\n    if (userKey.length > 5) registerFailure(userKey);",
  "    registerFailure(ipKey);\n    registerFailure(userKey);");

// register-agent → 410 (consolidé : la création passe par POST /api/admin/agents)
const regStart = au.findIndex((l) => l.includes("router.post('/register-agent'"));
if (regStart === -1) { out.push('  ⚠️ auth: register-agent non trouvé'); miss++; }
else {
  let regEnd = regStart;
  while (regEnd < au.length && au[regEnd].trim() !== '});') regEnd++;
  au.splice(regStart, regEnd - regStart + 1,
    "// Route retirée : la création de comptes est consolidée dans POST /api/admin/agents",
    "router.post('/register-agent', requireAuth, (req, res) => {",
    "  res.status(410).json({ error: 'Route retirée : créez les comptes via Supervision → Équipes (POST /api/admin/agents).' });",
    "});");
  out.push('  auth: register-agent remplacé par 410 (consolidation)');
}
save('routes/auth.js', au);

// ============ 3. routes/reports.js : summary scopé par équipe ============
let rp = load('routes/reports.js');
const sumStart = rp.findIndex((l) => l.includes("router.get('/summary'"));
if (sumStart === -1) { out.push('  ⚠️ reports: summary non trouvé'); miss++; }
else {
  let sumEnd = sumStart;
  while (sumEnd < rp.length && rp[sumEnd].trim() !== '});') sumEnd++;
  const newSummary = [
    "router.get('/summary', requireSupervision, (req, res) => {",
    "  const { from = '', to = '' } = req.query;",
    "  const roles = scopedRoles(req.user);",
    "  const scopePh = roles.map(() => '?').join(',');",
    "  const scopeSql = `agent_id IN (SELECT id FROM users WHERE role IN (${scopePh}))`;",
    "",
    "  // Encaissements du périmètre (+ filtre de dates optionnel)",
    "  const cond = [`${scopeSql.replace('agent_id', 'p.agent_id')}`];",
    "  const params = [];",
    "  if (from) { cond.push(\"date(p.created_at) >= date(?)\"); params.push(from); }",
    "  if (to) { cond.push(\"date(p.created_at) <= date(?)\"); params.push(to); }",
    "  const where = `WHERE ${cond.join(' AND ')}`;",
    "  const payments = db.prepare(`SELECT COALESCE(SUM(p.amount),0) total, COUNT(*) count FROM payments p ${where}`).get(...params);",
    "  const byMethod = db.prepare(`SELECT p.method, COUNT(*) count, COALESCE(SUM(p.amount),0) total FROM payments p ${where} GROUP BY p.method`).all(...params);",
    "",
    "  // Abonnements et nouveaux abonnés du périmètre",
    "  const instCond = [scopeSql.replace('agent_id', 'i.agent_id')];",
    "  const instParams = [];",
    "  if (from) { instCond.push(\"date(i.created_at) >= date(?)\"); instParams.push(from); }",
    "  if (to) { instCond.push(\"date(i.created_at) <= date(?)\"); instParams.push(to); }",
    "  const installations = db.prepare(`SELECT COUNT(*) count FROM installations i WHERE ${instCond.join(' AND ')}`).get(...instParams);",
    "  const custCond = [scopeSql.replace('agent_id', 'c.agent_id')];",
    "  const custParams = [];",
    "  if (from) { custCond.push(\"date(c.created_at) >= date(?)\"); custParams.push(from); }",
    "  if (to) { custCond.push(\"date(c.created_at) <= date(?)\"); custParams.push(to); }",
    "  const newCustomers = db.prepare(`SELECT COUNT(*) count FROM customers c WHERE ${custCond.join(' AND ')}`).get(...custParams);",
    "",
    "  // Classement : uniquement les profils du périmètre",
    "  const byAgent = db.prepare(`",
    "    SELECT u.full_name AS agent, COUNT(p.id) AS payments, COALESCE(SUM(p.amount),0) AS total",
    "    FROM users u LEFT JOIN payments p ON p.agent_id = u.id",
    "    WHERE u.role IN (${scopePh}) GROUP BY u.id ORDER BY total DESC`).all(...roles);",
    "",
    "  res.json({ payments, byMethod, byAgent, installations: installations.count, newCustomers: newCustomers.count });",
    "});"
  ];
  rp.splice(sumStart, sumEnd - sumStart + 1, ...newSummary);
  out.push('  reports: summary scopé par équipe réécrit');
}
save('routes/reports.js', rp);

// ============ 4. routes/sync.js : /pending scopé par équipe ============
let sy = load('routes/sync.js');
sy = replaceOnce(sy, 'routes/sync.js',
  "const { requireAuth, isAdminLike, isTechnician } = require('../auth');",
  "const { requireAuth, isAdminLike, isTechnician, scopedRoles } = require('../auth');");
const pendStart = sy.findIndex((l) => l.includes("router.get('/pending'"));
if (pendStart === -1) { out.push('  ⚠️ sync: /pending non trouvé'); miss++; }
else {
  let pendEnd = pendStart;
  while (pendEnd < sy.length && sy[pendEnd].trim() !== '});') pendEnd++;
  const newPending = [
    "router.get('/pending', (req, res) => {",
    "  const roles = scopedRoles(req.user);",
    "  let rows;",
    "  if (isAdminLike(req.user)) {",
    "    // Supervision : opérations de l'équipe (commerciaux ou techniciens selon le profil)",
    "    const rolePh = roles.map(() => '?').join(',');",
    "    rows = db.prepare(`SELECT id, agent_id, op, client_uuid, status, error, created_at FROM sync_queue WHERE agent_id IN (SELECT id FROM users WHERE role IN (${rolePh})) ORDER BY id DESC LIMIT 100`).all(...roles);",
    "  } else {",
    "    rows = db.prepare('SELECT id, agent_id, op, client_uuid, status, error, created_at FROM sync_queue WHERE agent_id = ? ORDER BY id DESC LIMIT 100').all(req.user.id);",
    "  }",
    "  res.json(rows);",
    "});"
  ];
  sy.splice(pendStart, pendEnd - pendStart + 1, ...newPending);
  out.push('  sync: /pending scopé par équipe');
}
save('routes/sync.js', sy);

// ============ 5. routes/admin.js : mouvements de stock scopés ============
let ad = load('routes/admin.js');
const movStart = ad.findIndex((l) => l.includes("router.get('/stock/movements'"));
if (movStart === -1) { out.push('  ⚠️ admin: stock/movements non trouvé'); miss++; }
else {
  let movEnd = movStart;
  while (movEnd < ad.length && ad[movEnd].trim() !== '});') movEnd++;
  const newMov = [
    "router.get('/stock/movements', (req, res) => {",
    "  const roles = scopedRoles(req.user);",
    "  const rolePh = roles.map(() => '?').join(',');",
    "  const rows = db.prepare(`",
    "    SELECT m.*, p.name AS product, COALESCE(u.full_name,'—') AS agent",
    "    FROM stock_movements m JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.agent_id",
    "    WHERE m.agent_id IS NULL OR m.agent_id IN (SELECT id FROM users WHERE role IN (${rolePh}))",
    "    ORDER BY m.id DESC LIMIT 100`).all(...roles);",
    "  res.json(rows);",
    "});"
  ];
  ad.splice(movStart, movEnd - movStart + 1, ...newMov);
  out.push('  admin: mouvements de stock scopés par équipe');
}
save('routes/admin.js', ad);

console.log(out.join('\n'));
console.log(miss ? 'FIX V41 PARTIEL' : 'FIX V41 OK');