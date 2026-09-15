// tests/perf-check.js — mesure de latence des endpoints critiques Takata Kwetu
// Usage : node tests/perf-check.js [url] [iterations] [outFile]
const BASE = process.argv[2] || 'http://localhost:8080';
const N = parseInt(process.argv[3] || '20', 10);
const OUT = process.argv[4] || 'tests/perf-baseline.json';

async function timeIt(fn) {
  const t0 = process.hrtime.bigint();
  const res = await fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ms, status: res && res.status };
}

function stats(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const p = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    min: +s[0].toFixed(2),
    median: +p(0.5).toFixed(2),
    p95: +p(0.95).toFixed(2),
    max: +s[s.length - 1].toFixed(2),
    avg: +(sum / s.length).toFixed(2),
  };
}

async function login(username, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, token: j.token, role: j.user && j.user.role };
}

async function main() {
  const admin = await login('admin', 'admin123');
  const agent = await login('agent1', 'agent123');
  const ha = { Authorization: `Bearer ${admin.token}` };
  const hg = { Authorization: `Bearer ${agent.token}` };

  const endpoints = [
    ['GET /api/health (public)', () => fetch(`${BASE}/api/health`)],
    ['POST /api/auth/login', () => login('agent2', 'agent123')],
    ['GET / (index.html statique)', () => fetch(`${BASE}/`)],
    ['GET /api/dashboard (agent)', () => fetch(`${BASE}/api/dashboard`, { headers: hg })],
    ['GET /api/customers (agent)', () => fetch(`${BASE}/api/customers`, { headers: hg })],
    ['GET /api/payments (agent)', () => fetch(`${BASE}/api/payments`, { headers: hg })],
    ['GET /api/installments (agent)', () => fetch(`${BASE}/api/installments`, { headers: hg })],
    ['GET /api/stock (agent)', () => fetch(`${BASE}/api/stock`, { headers: hg })],
    ['GET /api/admin/overview (admin)', () => fetch(`${BASE}/api/admin/overview`, { headers: ha })],
    ['GET /api/admin/agents (admin)', () => fetch(`${BASE}/api/admin/agents`, { headers: ha })],
  ];

  const results = {};
  for (const [name, fn] of endpoints) {
    const times = [];
    let ok = 0;
    for (let i = 0; i < N; i++) {
      const t = await timeIt(fn);
      times.push(t.ms);
      if (t.status === 200 || t.status === 201) ok++;
    }
    results[name] = { ...stats(times), ok, statusOkPct: Math.round((ok / N) * 100) };
  }

  const out = {
    base: BASE,
    iterations: N,
    generatedAt: new Date().toISOString(),
    results,
  };
  require('fs').writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error('PERF ERROR:', e.message); process.exit(1); });
