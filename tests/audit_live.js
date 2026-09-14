// tests/audit_live.js — Vérification en direct des suspicions du security-test
const BASE = 'http://localhost:8080';
async function api(method, path, body, token) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), token].join('') } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let d = null; try { d = await res.json(); } catch (e) { /* vide */ }
  return { status: res.status, data: d };
}
(async () => {
  const login = async (u, p) => (await api('POST', '/auth/login', { username: u, password: p })).data;
  const a1 = await login('agent1', 'agent123');
  const admin = await login('admin', 'admin123');

  console.log('-- GET /payments (agent1) : lignes et agent_id');
  const pays = (await api('GET', '/payments', null, a1.token)).data;
  pays.forEach((p) => console.log('  pay id=' + p.id, 'agent_id=' + p.agent_id, p.customer, p.amount));
  const horsPay = pays.filter((p) => p.agent_id !== 4);
  console.log('  → hors périmètre :', horsPay.length);

  console.log('-- GET /installments (agent1) : fuite ?');
  const insts = (await api('GET', '/installments', null, a1.token)).data;
  const horsInst = insts.filter((i) => i.agent_id !== 4);
  console.log('  total vues :', insts.length, '| hors périmètre (agent_id !== 4) :', horsInst.length, horsInst.slice(0, 3).map((i) => 'id=' + i.id + '/a' + i.agent_id).join(', '));

  console.log('-- GET /commissions (agent1)');
  const comms = (await api('GET', '/commissions', null, a1.token)).data;
  const rows = Array.isArray(comms) ? comms : (comms.rows || []);
  console.log('  lignes :', rows.length, '| hors périmètre :', rows.filter((c) => c.agent_id !== 4).length);

  console.log('-- POST /installments/1/remind (échéance d\'un autre agent)');
  const rem = await api('POST', '/installments/1/remind', {}, a1.token);
  console.log('  status :', rem.status, JSON.stringify(rem.data));

  console.log('-- GET /sync/pending (agent1)');
  const sync = await api('GET', '/sync/pending', null, a1.token);
  const srows = (sync.data && sync.data.queue) || (Array.isArray(sync.data) ? sync.data : []);
  console.log('  status :', sync.status, '| agent_id présents :', [...new Set(srows.map((s) => s.agent_id))].join(','), '| nb :', srows.length);

  console.log('-- GET /manifest.json (sans auth)');
  const m = await fetch(BASE + '/manifest.json');
  console.log('  status :', m.status, '| content-type :', m.headers.get('content-type'));

  console.log('-- Artefacts SQLi/XSS résiduels en base (admin)');
  const all = (await api('GET', '/customers?search=', null, admin.token)).data || [];
  const suspects = all.filter((c) => /sql|xss|test-uuid|payload|temporaire/i.test(c.name + ' ' + (c.notes || '')));
  console.log('  clients suspects :', suspects.length, suspects.map((c) => c.id + ':' + c.name).join(' | '));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });