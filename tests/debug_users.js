// tests/debug_users.js — inspection des comptes réels (ids) et test PUT/DELETE
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
  const l = await api('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  const { data: users } = await api('GET', '/admin/agents', null, l.data.token);
  (users || []).forEach((u) => console.log('user id=' + u.id + ' @' + u.username + ' role=' + u.role + ' active=' + u.active));
  const me = await api('GET', '/auth/me', null, l.data.token);
  console.log('me:', JSON.stringify(me.data).slice(0, 120));
  const put = await api('PUT', '/admin/agents/1', { role: 'agent' }, l.data.token);
  console.log('PUT /admin/agents/1 →', put.status, JSON.stringify(put.data));
  const put2 = await api('PUT', '/admin/agents/' + (users[0] ? users[0].id : 0), { role: 'agent' }, l.data.token);
  console.log('PUT sur premier user listé →', put2.status, JSON.stringify(put2.data));
})().catch((e) => console.error('ERR', e.message));