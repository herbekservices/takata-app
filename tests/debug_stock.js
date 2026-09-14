// tests/debug_stock.js — diagnostic GET /api/admin/stock avec header Bearer correct
const BASE = 'http://localhost:8080';
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
  const login = await api('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  console.log('login:', login.status, '| token ok:', !!login.data.token);
  const r = await api('GET', '/admin/stock', null, login.data.token);
  console.log('GET /admin/stock:', r.status, '| type:', Array.isArray(r.data) ? 'array (' + r.data.length + ')' : typeof r.data);
  if (Array.isArray(r.data) && r.data[0]) console.log('1er élément:', JSON.stringify(r.data[0]).slice(0, 160));
  else if (r.data) console.log('corps:', JSON.stringify(r.data).slice(0, 200));
  const set = await api('POST', '/admin/stock/set', { product_id: 4, agent_id: null, quantity: 250 }, login.data.token);
  console.log('POST /stock/set:', set.status, JSON.stringify(set.data));
  const r2 = await api('GET', '/admin/stock', null, login.data.token);
  const line = Array.isArray(r2.data) ? r2.data.find((s) => s.product_id === 4 && s.agent_id === null) : null;
  console.log('après set → quantité sacs dépôt:', line && line.quantity);
})().catch((e) => console.error('ERR', e.message));