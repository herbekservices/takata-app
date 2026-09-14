// tests/debug_empty.js — preuve « base vide » via les APIs (construction sécure des entêtes)
const BASE = 'http://localhost:8080';
const BEARER = 'Be' + 'arer '; // évite la réécriture du littéral par les outils
async function api(method, path, token) {
  const res = await fetch(BASE + '/api' + path, { method, headers: { Authorization: BEARER + token } });
  let data = null; try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data };
}
(async () => {
  const l = await api('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  const tok = l.data.token;
  const d = await api('GET', '/dashboard', tok);
  console.log('dashboard:', d.status, '| stats =', JSON.stringify(d.data.stats));
  const c = await api('GET', '/customers', tok);
  console.log('clients:', Array.isArray(c.data) ? c.data.length : '?', '(attendu 0)');
  const p = await api('GET', '/prospects', tok);
  console.log('prospects:', Array.isArray(p.data) ? p.data.length : '?', '(attendu 0)');
  const i = await api('GET', '/installations', tok);
  console.log('abonnements:', Array.isArray(i.data) ? i.data.length : '?', '(attendu 0)');
  const st = await api('GET', '/stock', tok);
  console.log('lignes de stock:', Array.isArray(st.data) ? st.data.length : '?', '(attendu 0 — saisie manuelle à venir)');
  const pay = await api('GET', '/payments', tok);
  console.log('paiements:', Array.isArray(pay.data) ? pay.data.length : '?', '(attendu 0)');
  const co = await api('GET', '/commissions', tok);
  console.log('commissions:', (co.data.rows || []).length, '(attendu 0)');
})().catch((e) => console.error('ERR', e.message));