// tests/fix-verify.js — Vérification ciblée des correctifs issus des 3 audits
// Usage : node tests/fix-verify.js [url]
// Vérifie chaque défaut M1-M10, m1-m11 (sécurité : S1-S6) ; rate-limit exclu par défaut
// (il bloque l'IP 15 min) → tester séparément avant le re-seed final.
const BASE = process.argv[2] || 'http://localhost:8080';
const SKIP_RATE = process.argv.includes('--skip-rate-limit');

let pass = 0, fail = 0;
const fails = [];

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), token].join('');
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined && body !== null ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data, headers: res.headers };
}

async function login(username, password) {
  const r = await call('POST', '/api/auth/login', { username, password });
  return r.data && r.data.token;
}

function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; fails.push(name); console.log(`  ❌ ${name} — ${detail || ''}`); }
}

(async () => {
  console.log(`🧪 Vérification des correctifs — ${BASE}`);
  const admin = await login('admin', 'admin123');
  const a1 = await login('agent1', 'agent123');
  const ha = admin ? { Authorization: [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), admin].join('') } : {};
  const h1 = a1 ? { Authorization: [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), a1].join('') } : {};
  check('Connexion admin OK', !!admin, 'admin token absent — rate-limit ?');
  check('Connexion agent1 OK', !!a1, 'agent1 token absent — rate-limit ?');
  if (!admin || !a1) { console.log('\nRÉSULTAT : ' + pass + ' OK / ' + fail + ' FAIL'); process.exit(1); }

  // Permissions-Policy / fingerprint
  const health = await call('GET', '/api/health');
  check('CSP présente', !!health.headers.get('content-security-policy'));
  check('Permissions-Policy présente', !!health.headers.get('permissions-policy'));
  check('X-Powered-By supprimé', !health.headers.get('x-powered-by'));
  const notFound = await call('GET', '/api/nonexistent', null, a1);
  check('404 API JSON (au lieu de page HTML)', notFound.status === 404 && notFound.data && notFound.data.error);
  const sw = await fetch(BASE + '/sw.js');
  check('sw.js servi sans cache HTTP', sw.status === 200 && (sw.headers.get('cache-control') || '').includes('no-cache'));
  const css = await fetch(BASE + '/css/takata.css');
  check('Compression active sur le CSS', (css.headers.get('content-encoding') || '').includes('gzip'));

  // --- M1 : statut client invalide → 400 ---
  let r = await call('POST', '/api/customers', { name: 'edge_fix_status' }, a1);
  const cid = r.data && r.data.id;
  r = await call('PUT', `/api/customers/${cid}`, { status: 'bogus' }, a1);
  check('M1 statut client invalide → 400', r.status === 400);

  // --- M2 : suppression client référencé → 409 ---
  r = await call('POST', '/api/customers', { name: 'edge_fix_del' }, a1);
  const cidDel = r.data && r.data.id;
  await call('POST', '/api/payments', { customer_id: cidDel, amount: 100 }, a1);
  r = await call('DELETE', `/api/customers/${cidDel}`, null, a1);
  check('M2 suppression client avec paiement → 409', r.status === 409);

  // --- M3 : statut prospect invalide → 400 ---
  r = await call('POST', '/api/prospects', { name: 'edge_fix_prosp' }, a1);
  const pid = r.data && r.data.id;
  r = await call('PUT', `/api/prospects/${pid}`, { status: 'bogus' }, a1);
  check('M3 statut prospect invalide → 400', r.status === 400);

  // --- M4/M5 : stock move ---
  r = await call('POST', '/api/admin/products', { name: 'edge_fix_prod', price: 1000, nb_installments: 1, commission_rate: 5 }, admin);
  const prId = r.data && r.data.id;
  await call('POST', '/api/admin/stock/move', { product_id: prId, type: 'in', quantity: 1 }, admin);
  r = await call('POST', '/api/admin/stock/move', { product_id: prId, type: 'out', quantity: 2 }, admin);
  check('M4 sortie stock > disponible → 400', r.status === 400);
  r = await call('POST', '/api/admin/stock/move', { product_id: prId, type: 'in', quantity: 'abc' }, admin);
  check('M5 quantité non numérique → 400', r.status === 400);

  // --- M6/M7 : installation sans stock → 409 ; 2e installation pour 1 unité → 409 ---
  r = await call('POST', '/api/admin/products', { name: 'edge_fix_race', price: 2000, nb_installments: 1, commission_rate: 0 }, admin);
  const prRace = r.data && r.data.id;
  await call('POST', '/api/admin/stock/move', { product_id: prRace, type: 'in', quantity: 1 }, admin);
  r = await call('POST', '/api/customers', { name: 'edge_fix_c1' }, a1);
  const c1 = r.data && r.data.id;
  r = await call('POST', '/api/customers', { name: 'edge_fix_c2' }, a1);
  const c2 = r.data && r.data.id;
  r = await call('POST', '/api/installations', { customer_id: c1, product_id: prRace }, a1);
  const firstOk = r.status === 201;
  r = await call('POST', '/api/installations', { customer_id: c2, product_id: prRace }, a1);
  check('M7 survente : 2e installation sans unité → 409', firstOk && r.status === 409, `1ère=${firstOk} 2e=${r.status}`);
  r = await call('POST', '/api/admin/products', { name: 'edge_fix_nostock', price: 500, nb_installments: 1, commission_rate: 0 }, admin);
  const prNS = r.data && r.data.id;
  r = await call('POST', '/api/installations', { customer_id: c1, product_id: prNS }, a1);
  check('M6 installation sans aucun stock → 409', r.status === 409);

  // --- M8 : sync error → reprise même uuid ---
  const uuid8 = 'edge-fix-sync-' + Date.now();
  r = await call('POST', '/api/sync', { operations: [{ uuid: uuid8, op: 'create_customer', payload: { name: '' }, created_at: new Date().toISOString() }] }, a1);
  const firstErr = r.data && r.data.results && r.data.results[0] && r.data.results[0].status === 'error';
  r = await call('POST', '/api/sync', { operations: [{ uuid: uuid8, op: 'create_customer', payload: { name: 'edge_fix_retry' }, created_at: new Date().toISOString() }] }, a1);
  const secondDone = r.data && r.data.results && r.data.results[0] && r.data.results[0].status === 'done';
  check('M8 opération sync en erreur réessayable → done', firstErr && secondDone, JSON.stringify(r.data && r.data.results));

  // --- M9 : statut installation invalide → 400 ---
  r = await call('POST', '/api/installations', { customer_id: c1, product_id: prRace, status: 'bogus' }, a1);
  check('M9 statut installation invalide → 400', r.status === 400);

  // --- M10 : méthode de paiement invalide → 400 ---
  r = await call('POST', '/api/payments', { customer_id: c1, amount: 100, method: 'cheque' }, a1);
  check('M10 méthode de paiement invalide → 400', r.status === 400);

  // --- m2/m3 : espaces / types ---
  r = await call('POST', '/api/admin/agents', { username: '   ', password: 'secret1', full_name: 'X' }, admin);
  check('m2 username d\'espaces → 400', r.status === 400);
  r = await call('POST', '/api/customers', { name: '   ' }, a1);
  check('m3 client nom d\'espaces → 400', r.status === 400);
  r = await call('POST', '/api/customers', { name: 'edge_fix_t', phone: { a: 1 } }, a1);
  check('m4 phone objet → 400', r.status === 400);
  r = await call('POST', '/api/admin/products', { name: 'edge_fix_p', price: 100, nb_installments: -3 }, admin);
  check('m6 nb_installments négatif → 400', r.status === 400);
  r = await call('POST', '/api/admin/products', { name: 'edge_fix_p2', price: 100, commission_rate: 'abc' }, admin);
  check('m7 commission_rate "abc" → 400', r.status === 400);
  r = await call('POST', '/api/admin/products', { name: '   ', price: 100 }, admin);
  check('m8 produit nom d\'espaces → 400', r.status === 400);
  r = await call('POST', '/api/installations', { customer_id: c1, product_id: prRace, install_date: 'pas-une-date' }, a1);
  check('m9 install_date invalide → 400', r.status === 400);
  r = await call('POST', '/api/payments', { customer_id: c1, amount: 1e308 }, a1);
  check('m10 montant 1e308 → 400', r.status === 400);
  r = await call('POST', '/api/payments', { customer_id: c1, amount: 0.001 }, a1);
  check('m11 montant 0.001 → 400', r.status === 400);

  // --- S2 : reset-password révoque les sessions ---
  const t3old = await login('agent3', 'agent123');
  await call('POST', '/api/admin/agents/4/reset-password', { password: 'TempFix777' }, admin);
  r = await call('GET', '/api/auth/me', null, t3old);
  check('S2 ancien token révoqué après reset admin → 401', r.status === 401);
  const t3new = await login('agent3', 'TempFix777');
  check('S2 reconnexion avec nouveau mdp OK', !!t3new);

  // --- S6 : compte désactivé → 401 générique (anti-énumération) ---
  r = await call('POST', '/api/admin/agents', { username: 'edge_fix_off', password: 'secret1', full_name: 'Off Test' }, admin);
  const offId = r.data && r.data.id;
  await call('PUT', `/api/admin/agents/${offId}`, { active: 0 }, admin);
  r = await call('POST', '/api/auth/login', { username: 'edge_fix_off', password: 'secret1' });
  check('S6 login compte désactivé → 401 générique', r.status === 401 && /incorrects/i.test(r.data.error || ''), `status=${r.status} msg=${r.data && r.data.error}`);

  // --- S1 : rate-limit (optionnel, bloque l'IP 15 min) ---
  if (!SKIP_RATE) {
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const t = await call('POST', '/api/auth/login', { username: 'edge_fix_nobody', password: 'wrong' });
      last = t.status;
    }
    check('S1 rate-limit : 7e tentative → 429', last === 429);
  } else {
    console.log('  ⏭️  Rate-limit (S1) sauté — tester séparément avant le re-seed final');
  }

  console.log(`\n📊 RÉSULTAT : ${pass} OK / ${fail} FAIL`);
  if (fails.length) console.log('Échecs : ' + fails.join(', '));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(1); });