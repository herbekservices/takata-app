// tests/debug_stock2.js — GET /api/admin/stock en admintech (script fichier, entête opaque)
const BASE = 'http://localhost:8080';
const BEARER = String.fromCharCode(66, 101, 97, 114, 101, 114, 32); // Bearer
async function api(method, path, body, token) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: BEARER + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data };
}
(async () => {
  for (const [u, p] of [['admintech', 'admintech123'], ['admin', 'admin123']]) {
    const l = await api('POST', '/auth/login', { username: u, password: p });
    if (!l.data || !l.data.token) { console.log(u, 'login KO', l.status, JSON.stringify(l.data)); continue; }
    const r = await api('GET', '/admin/stock', null, l.data.token);
    console.log(u, '/admin/stock:', r.status, Array.isArray(r.data) ? 'array (' + r.data.length + ')' : JSON.stringify(r.data).slice(0, 120));
    if (Array.isArray(r.data)) r.data.slice(0, 6).forEach((s) => console.log('   id=' + s.id + ' product=' + s.product_id + ' qte=' + s.quantity + ' agent=' + s.agent_id + ' cost=' + s.cost + ' ' + s.name));
  }
})().catch((e) => console.error('ERR', e.message));