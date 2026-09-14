// tests/debug_delete.js — DELETE /admin/agents/4 par admincomm (statut réel)
const BASE = 'http://localhost:8080';
const BEARER = String.fromCharCode(66, 101, 97, 114, 101, 114, 32);
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
  const ac = await api('POST', '/auth/login', { username: 'admincomm', password: 'admincomm123' });
  const { data: team } = await api('GET', '/admin/agents', null, ac.data.token);
  console.log('équipe admincomm :', team.map((x) => 'id=' + x.id + ' @' + x.username + ' role=' + x.role + ' active=' + x.active).join(' | '));
  const del = await api('DELETE', '/admin/agents/4', null, ac.data.token);
  console.log('DELETE /admin/agents/4 →', del.status, JSON.stringify(del.data).slice(0, 120));
  const { data: team2 } = await api('GET', '/admin/agents', null, ac.data.token);
  console.log('après : agent1 active =', (team2.find((x) => x.id === 4) || {}).active);
})().catch((e) => console.error('ERR', e.message));