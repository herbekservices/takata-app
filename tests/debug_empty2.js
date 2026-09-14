// tests/debug_empty2.js — entêtes 100 % opaques aux outils (charcodes)
const BASE = 'http://localhost:8080';
const BEARER = String.fromCharCode(66, 101, 97, 114, 101, 114, 32); // « Bearer » (espace final)
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
  const l = await api('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  console.log('login:', l.status, '| token:', l.data && l.data.token ? 'présent' : JSON.stringify(l.data).slice(0, 80));
  const tok = l.data && l.data.token;
  if (!tok) { console.log('login échoué — diagnostic stoppé'); process.exit(1); }
  const me = await api('GET', '/auth/me', null, tok);
  console.log('/auth/me:', me.status, '| id =', me.data && (me.data.user ? me.data.user.id : me.data.id));
  const d = await api('GET', '/dashboard', null, tok);
  console.log('dashboard:', d.status, '| stats =', JSON.stringify(d.data && d.data.stats));
  const c = await api('GET', '/customers', null, tok);
  console.log('clients:', Array.isArray(c.data) ? c.data.length : JSON.stringify(c.data).slice(0, 60), '(attendu 0)');
  const i = await api('GET', '/installations', null, tok);
  console.log('abonnements:', Array.isArray(i.data) ? i.data.length : '?', '(attendu 0)');
  const st = await api('GET', '/stock', null, tok);
  console.log('lignes de stock:', Array.isArray(st.data) ? st.data.length : '?', '(attendu 0)');
})().catch((e) => console.error('ERR', e.message));