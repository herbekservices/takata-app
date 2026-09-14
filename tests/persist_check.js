// tests/persist_check.js — Preuve de persistance SQLite à travers un redémarrage
// Usage : node tests/persist_check.js --mark   (crée le repère côté agent1)
//         node tests/persist_check.js --verify (vérifie que le repère existe encore)
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const MARK = 'Repère Persistance ' + new Date().toISOString().slice(0, 10);
const MODE = process.argv[2] || '--verify';

async function api(method, path, body, token) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), token].join('') } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch (e) { /* vide */ }
  return { status: res.status, data };
}
async function login(username, password) {
  const r = await api('POST', '/auth/login', { username, password });
  if (r.status !== 200) throw new Error('login ' + username + ' → ' + r.status);
  return r.data;
}

(async () => {
  if (MODE === '--mark') {
    const a1 = await login('agent1', 'agent123');
    const r = await api('POST', '/customers', { name: MARK, phone: '099 000 1111', village: 'Dilala', address: 'Av. Persistance 7' }, a1.token);
    console.log(r.status === 201
      ? 'REPÈRE CRÉÉ : id=' + r.data.id + ' — "' + MARK + '"'
      : 'ÉCHEC création repère : ' + JSON.stringify(r.data));
    process.exit(r.status === 201 ? 0 : 1);
  }
  // --verify
  const admin = await login('admin', 'admin123');
  const rows = await api('GET', '/customers?search=' + encodeURIComponent(MARK), null, admin.token);
  const found = (rows.data || []).find((c) => c.name === MARK);
  console.log(found
    ? 'PERSISTANCE CONFIRMÉE après redémarrage du serveur : "' + found.name + '" (id=' + found.id + ', agent=' + found.agent + ', créé ' + found.created_at + ')'
    : 'PERSISTANCE ÉCHOUÉE : le repère "' + MARK + '" a disparu après redémarrage.');
  process.exit(found ? 0 : 1);
})().catch((e) => { console.error(e.message); process.exit(2); });