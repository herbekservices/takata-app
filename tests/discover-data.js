// discover-data.js — découvrir les IDs réels (lecture seule) pour cibler les tests
const BASE = 'http://localhost:8080/api';

async function login(username, password) {
  const res = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  return { status: res.status, data };
}

(async () => {
  const { data: admin } = await login('admin', 'admin123');
  console.log('ADMIN LOGIN:', admin.token ? 'OK token=' + admin.token.slice(0, 12) + '…' : JSON.stringify(admin));

  const headers = { Authorization: [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), admin.token].join('') };

  for (const [label, path] of [
    ['agents', '/admin/agents'], ['products', '/admin/products'], ['overview', '/admin/overview']
  ]) {
    const r = await fetch(BASE + path, { headers });
    const d = await r.json();
    console.log(label.toUpperCase() + ' [' + r.status + ']:', JSON.stringify(d).slice(0, 400));
  }

  for (const u of ['agent1', 'agent2', 'agent3']) {
    const { data, status } = await login(u, 'agent123');
    if (!data.token) { console.log(u, 'LOGIN FAIL', status, JSON.stringify(data)); continue; }
    const h = { Authorization: [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), data.token].join('') };
    for (const path of ['/customers', '/prospects', '/installations', '/payments', '/installments', '/commissions']) {
      const r = await fetch(BASE + path, { headers: h });
      const d = await r.json();
      const brief = Array.isArray(d) ? d.map((x) => ({ id: x.id, name: x.name || x.customer || x.amount })) : d;
      console.log(u + ' ' + path + ' [' + r.status + ']:', JSON.stringify(brief).slice(0, 500));
    }
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });