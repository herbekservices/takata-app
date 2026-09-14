// tests/debug_synccheck.js — reproduction exacte du check /sync/pending du security-test
const BASE = 'http://localhost:8080';
async function req(method, p, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), token].join('');
  const res = await fetch(BASE + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data };
}
(async () => {
  const a1 = await req('POST', '/api/auth/login', { body: { username: 'agent1', password: 'agent123' } });
  console.log('login.status =', a1.status, '| data =', JSON.stringify(a1.data).slice(0, 120));
  const tok = a1.data && a1.data.token;
  const t1 = { token: tok };
  const meSelf = await req('GET', '/api/auth/me', t1);
  const selfId = meSelf.data && meSelf.data.id;
  console.log('meSelf.status =', meSelf.status, '| selfId =', selfId, '| me.data =', JSON.stringify(meSelf.data).slice(0, 100));
  const syncPend = await req('GET', '/api/sync/pending', t1);
  console.log('syncPend.status =', syncPend.status, '| type =', Array.isArray(syncPend.data) ? 'array' : typeof syncPend.data);
  const ids = [...new Set(Array.isArray(syncPend.data) ? syncPend.data.map((o) => o.agent_id) : [])];
  console.log('agent_ids dans la liste =', ids.join(',') || 'vide', '| nb ops =', Array.isArray(syncPend.data) ? syncPend.data.length : '-');
  console.log('every(agent_id === selfId) =', Array.isArray(syncPend.data) ? syncPend.data.every((o) => String(o.agent_id) === String(selfId)) : 'n/a');
})().catch((e) => console.error('ERR', e.message));