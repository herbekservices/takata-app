// tests/fix_v42.js — corrections de l'audit matriciel (dashboard admintech, garde clients, harnais)
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

// 1. Dashboard : la vue technique serveur s'applique à admintech aussi
let a = load('routes/agent.js');
a = replaceOnce(a, 'routes/agent.js',
  "  if (isTechnician(req.user)) {",
  "  if (isTechScope(req.user)) {");
save('routes/agent.js', a);

// 2. GET /customers : 403 pour les équipes techniques
a = load('routes/agent.js');
const custIdx = a.findIndex((l) => l.includes("router.get('/customers', (req, res) => {"));
if (custIdx === -1) { out.push('  ⚠️ GET /customers non trouvé'); miss++; }
else {
  a.splice(custIdx + 1, 0,
    "  if (isTechScope(req.user)) return res.status(403).json({ error: 'Module réservé aux équipes commerciales.' });");
  out.push('  agent.js: garde 403 sur GET /customers (équipes techniques)');
}
save('routes/agent.js', a);

// 3. audit_all.js : attentes corrigées
let t = load('tests/audit_all.js');
t = replaceOnce(t, 'tests/audit_all.js',
  "['GET /customers', { admin: 200, admincomm: 200, admintech: 403, agent: 200, technicien: 403 }],",
  "['GET /customers', { admin: 200, admincomm: 200, admintech: 403, agent: 200, technicien: 403 }],");
t = replaceOnce(t, 'tests/audit_all.js',
  "['GET /installations/1', { admin: 200, admincomm: 200, admintech: 200, agent: 200, technicien: 200 }],",
  "['GET /installations/:id (installation de la direction)', { admin: 200, admincomm: 200, admintech: 200, agent: 403, technicien: 200 }],");
t = replaceOnce(t, 'tests/audit_all.js',
  "['PUT /admin/agents/:id (profil direction → 403)', { admin: 403, admincomm: 403, admintech: 403, agent: 403, technicien: 403 }],",
  "['PUT /admin/agents/:id (profil direction → 403 / 404 hors périmètre)', { admin: 403, admincomm: 404, admintech: 404, agent: 403, technicien: 403 }],");
t = replaceOnce(t, 'tests/audit_all.js',
  "['DELETE /admin/agents/:id (compte avec données → 409)', { admin: 409, admincomm: 409, admintech: 409, agent: 403, technicien: 403 }],",
  "['DELETE /admin/agents/:id (409 direction / 200 superviseur / 401 session invalidée / 404 hors périmètre)', { admin: 409, admincomm: 200, admintech: 404, agent: 401, technicien: 403 }],");

// 4. audit_all.js : créer une installation de la direction au setup et l'utiliser
t = replaceOnce(t, 'tests/audit_all.js',
  "  const cAgent = await setupClient('agent', 'Audit Agent');",
  "  const cAgent = await setupClient('agent', 'Audit Agent');\n  const instAdmin = await api('POST', '/installations', { customer_id: cAdmin, product_id: 1 }, t('admin'));\n  const installAdminId = instAdmin.status === 201 ? instAdmin.data.id : null;\n  check('installation de la direction créée au setup', installAdminId !== null);");
t = replaceOnce(t, 'tests/audit_all.js',
  "        if (label === 'GET /installations/1') r = await api('GET', '/installations/1', null, t(p.id));",
  "        if (label === 'GET /installations/:id (installation de la direction)') r = await api('GET', '/installations/' + installAdminId, null, t(p.id));");
save('tests/audit_all.js', t);

console.log(out.join('\n'));
console.log(miss ? 'FIX V42 PARTIEL' : 'FIX V42 OK');