// tests/debug_set_tech.js — teste POST /admin/stock/set vers un technicien (entête opaque)
const BASE = 'http://localhost:8080';
const BEARER = String.fromCharCode(66, 101, 97, 114, 101, 114, 32);
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
  const l = await api('POST', '/auth/login', { username: 'admintech', password: 'admintech123' });
  const { data: team } = await api('GET', '/admin/agents', null, l.data.token);
  team.forEach((x) => console.log('team: id=' + x.id + ' @' + x.username + ' role=' + x.role + ' active=' + x.active));
  const tech1 = team.find((x) => x.username === 'technicien1');
  if (!tech1) { console.log('⚠️ technicien1 introuvable dans le périmètre admintech'); process.exit(1); }
  const set = await api('POST', '/admin/stock/set', { product_id: 4, agent_id: tech1.id, quantity: 60 }, l.data.token);
  console.log('set sacs tech1 →', set.status, JSON.stringify(set.data).slice(0, 120));
  const r = await api('GET', '/admin/stock', null, l.data.token);
  (r.data || []).forEach((s) => console.log('stock: product=' + s.product_id + ' agent_id=' + s.agent_id + ' qte=' + s.quantity + ' ' + s.name));
})().catch((e) => console.error('ERR', e.message));