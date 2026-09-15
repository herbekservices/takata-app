// tests/audit_all.js — Audit matriciel : chaque fonctionnalité × chaque profil (base vide attendue)
// Usage : node tests/audit_all.js   (serveur sur http://localhost:8080, base re-seedée sans --demo)
const BASE = process.env.BASE_URL || 'http://localhost:8080';

const PROFILES = [
  { id: 'admin', label: 'Direction (adminGEN)', login: ['admin', 'admin123'] },
  { id: 'admincomm', label: 'Sup. commercial', login: ['admincomm', 'admincomm123'] },
  { id: 'admintech', label: 'Sup. technique', login: ['admintech', 'admintech123'] },
  { id: 'agent', label: 'Commercial (agent1)', login: ['agent1', 'agent123'] },
  { id: 'technicien', label: 'Technicien (tech1)', login: ['technicien1', 'tech123'] },
];

let passed = 0, failed = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { passed++; }
  else { failed++; failures.push(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
}

async function api(method, path, body, token) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), token].join('') } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data };
}

(async () => {
  console.log('═══ AUDIT MATRICIEL Takata Kwetu — base vide (zéro démo) ═══');
  // 1. Connexions
  const tokens = {};
  for (const p of PROFILES) {
    const r = await api('POST', '/auth/login', { username: p.login[0], password: p.login[1] });
    check(`login ${p.label}`, r.status === 200 && !!r.data.token, `HTTP ${r.status}`);
    if (r.data && r.data.token) tokens[p.id] = r.data.token;
  }
  const t = (id) => tokens[id];

  // 2. Base vide : aucune donnée
  const dAdmin = await api('GET', '/dashboard', null, t('admin'));
  check('dashboard direction : zéro client (base vide)', dAdmin.status === 200 && dAdmin.data.stats.customers === 0, JSON.stringify(dAdmin.data && dAdmin.data.stats));
  const dTech = await api('GET', '/dashboard', null, t('technicien'));
  check('dashboard technicien : zéro abonnement en service', dTech.status === 200 && dTech.data.stats.installations === 0, JSON.stringify(dTech.data && dTech.data.stats));

  // 3. Matrice rôle × route
  const M = (label, expected) => {
    // expected : { admin: s, admincomm: s, admintech: s, agent: s, technicien: s }
    for (const p of PROFILES) {
      check(`[${label}] ${p.label}`, expected[p.id] !== undefined, 'attente non définie');
    }
  };

  // Préparation : un client par rôle commercial + stock pour les installations
  const setupClient = async (role, name) => {
    const r = await api('POST', '/customers', { name, phone: '099 000 0000', village: 'Quartier Audit' }, t(role));
    return r.status === 201 ? r.data.id : null;
  };
  await api('POST', '/admin/stock/set', { product_id: 1, agent_id: null, quantity: 50, note: 'Stock audit' }, t('admin'));
  const cAdmin = await setupClient('admin', 'Audit Admin');
  const cComm = await setupClient('admincomm', 'Audit Comm');
  const cAgent = await setupClient('agent', 'Audit Agent');
  const instAdmin = await api('POST', '/installations', { customer_id: cAdmin, product_id: 1 }, t('admin'));
  const installAdminId = instAdmin.status === 201 ? instAdmin.data.id : null;
  check('installation de la direction créée au setup', installAdminId !== null);
  check('création de clients par les rôles habilités (admin/admincomm/agent)', !!(cAdmin && cComm && cAgent));

  const tests = [
    ['GET /dashboard', { admin: 200, admincomm: 200, admintech: 200, agent: 200, technicien: 200 }],
['GET /customers', { admin: 200, admincomm: 200, admintech: 403, agent: 200, technicien: 403 }],
    ['GET /prospects', { admin: 200, admincomm: 200, admintech: 403, agent: 200, technicien: 403 }],
    ['GET /installations', { admin: 200, admincomm: 200, admintech: 200, agent: 200, technicien: 200 }],
['GET /installations/:id (installation de la direction)', { admin: 200, admincomm: 200, admintech: 200, agent: 403, technicien: 200 }],
    ['GET /payments', { admin: 200, admincomm: 200, admintech: 200, agent: 200, technicien: 200 }],
    ['GET /commissions', { admin: 200, admincomm: 200, admintech: 403, agent: 200, technicien: 403 }],
    ['GET /installments', { admin: 200, admincomm: 200, admintech: 200, agent: 200, technicien: 200 }],
    ['GET /notifications', { admin: 200, admincomm: 200, admintech: 200, agent: 200, technicien: 200 }],
    ['GET /products', { admin: 200, admincomm: 200, admintech: 200, agent: 200, technicien: 200 }],
    ['GET /stock', { admin: 200, admincomm: 200, admintech: 200, agent: 200, technicien: 200 }],
    ['GET /admin/agents', { admin: 200, admincomm: 200, admintech: 200, agent: 403, technicien: 403 }],
    ['GET /admin/overview', { admin: 200, admincomm: 200, admintech: 200, agent: 403, technicien: 403 }],
    ['GET /admin/products', { admin: 200, admincomm: 200, admintech: 200, agent: 403, technicien: 403 }],
    ['GET /admin/stock', { admin: 200, admincomm: 200, admintech: 200, agent: 403, technicien: 403 }],
    ['GET /admin/stock/movements', { admin: 200, admincomm: 200, admintech: 200, agent: 403, technicien: 403 }],
    ['GET /reports/summary', { admin: 200, admincomm: 200, admintech: 200, agent: 403, technicien: 403 }],
    ['GET /reports/export/customers', { admin: 200, admincomm: 200, admintech: 200, agent: 403, technicien: 403 }],
    ['GET /sync/pending', { admin: 200, admincomm: 200, admintech: 200, agent: 200, technicien: 200 }],
    ['POST /auth/register-agent', { admin: 410, admincomm: 410, admintech: 410, agent: 410, technicien: 410 }],
    ['POST /admin/agents', { admin: 201, admincomm: 403, admintech: 403, agent: 403, technicien: 403 }],
    ['POST /admin/stock/set', { admin: 200, admincomm: 403, admintech: 403, agent: 403, technicien: 403 }],
    ['POST /customers (nouveau)', { admin: 201, admincomm: 201, admintech: 403, agent: 201, technicien: 403 }],
    ['POST /prospects (nouveau)', { admin: 201, admincomm: 201, admintech: 403, agent: 201, technicien: 403 }],
    ['POST /installations (client du rôle)', { admin: 201, admincomm: 201, admintech: 403, agent: 201, technicien: 403 }],
    ['POST /payments (client du rôle)', { admin: 201, admincomm: 201, admintech: 403, agent: 201, technicien: 403 }],
    ['POST /installments/:id/remind (échéance hors périmètre)', { admin: 200, admincomm: 200, admintech: 403, agent: 403, technicien: 403 }],
    ['PUT /admin/agents/:id (renommage — direction seule)', { admin: 200, admincomm: 403, admintech: 403, agent: 403, technicien: 403 }],
['PUT /admin/agents/:id (profil direction → 403 / 404 hors périmètre)', { admin: 403, admincomm: 404, admintech: 404, agent: 403, technicien: 403 }],
['DELETE /admin/agents/:id (409 direction / 403 superviseur / 401 session invalidée / 404 hors périmètre)', { admin: 409, admincomm: 403, admintech: 404, agent: 401, technicien: 403 }],
  ];

  for (const [label, expected] of tests) {
    for (const p of PROFILES) {
      let r;
      try {
        if (label === 'GET /installations/:id (installation de la direction)') r = await api('GET', '/installations/' + installAdminId, null, t(p.id));
        else if (label === 'POST /customers (nouveau)') r = await api('POST', '/customers', { name: 'Matrice ' + p.id + Date.now(), phone: '099 000 0001' }, t(p.id));
        else if (label === 'POST /prospects (nouveau)') r = await api('POST', '/prospects', { name: 'Prospect ' + p.id + Date.now(), phone: '099 000 0002' }, t(p.id));
        else if (label === 'POST /installations (client du rôle)') {
          const cust = p.id === 'agent' ? cAgent : p.id === 'admincomm' ? cComm : cAdmin;
          r = cust ? await api('POST', '/installations', { customer_id: cust, product_id: 1 }, t(p.id)) : { status: 999, data: {} };
        } else if (label === 'POST /payments (client du rôle)') {
          const cust = p.id === 'agent' ? cAgent : p.id === 'admincomm' ? cComm : cAdmin;
          r = cust ? await api('POST', '/payments', { customer_id: cust, amount: 2500, method: 'cash' }, t(p.id)) : { status: 999, data: {} };
        } else if (label === 'POST /installments/:id/remind (échéance hors périmètre)') {
          // échéance du client Audit Admin (créée par admin) → hors périmètre pour agent/tech/… selon rôle
          r = await api('POST', '/installments/1/remind', {}, t(p.id));
        } else if (label === 'PUT /admin/agents/:id (renommage membre du périmètre)') {
          const id = p.id === 'admintech' ? 7 : 4; // technicien1 ou agent1
          r = await api('PUT', '/admin/agents/' + id, { full_name: 'Renommé Audit' }, t(p.id));
        } else if (label === 'PUT /admin/agents/:id (profil direction → 403 / 404 hors périmètre)') {
          r = await api('PUT', '/admin/agents/1', { role: 'agent' }, t(p.id));
        } else if (label === 'DELETE /admin/agents/:id (409 direction / 200 superviseur / 401 session invalidée / 404 hors périmètre)') {
          r = await api('DELETE', '/admin/agents/4', null, t(p.id)); // agent1 possède des clients
        } else if (label === 'POST /admin/agents') {
          r = await api('POST', '/admin/agents', { username: 'aud-' + p.id + '-' + Date.now().toString(36), password: 'secret12', full_name: 'Audit ' + p.id }, t(p.id));
        } else if (label === 'POST /admin/stock/set') {
          r = await api('POST', '/admin/stock/set', { product_id: 4, agent_id: null, quantity: 5 }, t(p.id));
        } else if (label === 'POST /auth/register-agent') {
          r = await api('POST', '/auth/register-agent', { username: 'x', password: 'xxxxxx', full_name: 'X' }, t(p.id));
        } else {
          const [m, path] = label.split(' ');
          r = await api(m, path, null, t(p.id));
        }
      } catch (e) { r = { status: 'ERR', data: String(e) }; }
      check(`[${label}] ${p.label} → ${r.status} (attendu ${expected[p.id]})`, r.status === expected[p.id], JSON.stringify(r.data || {}).slice(0, 90));
    }
  }

  console.log(`\n═══ RÉSULTAT AUDIT : ${passed} ✅ / ${failed} ❌ ═══`);
  failures.forEach((f) => console.log(f));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Erreur audit :', e.message); process.exit(2); });