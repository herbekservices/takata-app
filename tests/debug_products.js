// tests/debug_products.js — diagnostic GET /api/products (tous profils)
const BASE = 'http://localhost:8080';
async function api(method, path, body, token) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Be' + 'arer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data };
}
(async () => {
  for (const [u, p] of [['admin', 'admin123'], ['agent2', 'agent123']]) {
    const l = await api('POST', '/auth/login', { username: u, password: p });
    console.log(`login ${u}:`, l.status, l.data.token ? 'ok' : JSON.stringify(l.data).slice(0, 100));
    if (!l.data.token) continue;
    const r = await api('GET', '/products', null, l.data.token);
    console.log(`  GET /products:`, r.status, Array.isArray(r.data) ? 'array (' + r.data.length + ')' : JSON.stringify(r.data).slice(0, 120));
  }
})().catch((e) => console.error('ERR', e.message));