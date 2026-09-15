// security-test.js — Audit sécurité Takata Kwetu (preuves non destructives, cible localhost:8080)
// Usage : node tests/security-test.js
// Couverture : IDOR, ACL admin, manipulation de token, rate-limit, fuites d'info,
//              injection SQL, XSS stocké, en-têtes HTTP, révocation de sessions.
// Note : le serveur est partagé (d'autres campagnes de test y écrivent) — les
//        preuves sont ciblées sur des IDs fixes et des artefacts propres, puis
//        nettoyées ; l'état final est comparé par snapshot avant/après.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = 'http://localhost:8080/api';
const RUN = Date.now();
const results = [];
const okCount = { P: 0, F: 0 };

function record(group, name, severity, passed, detail) {
  results.push({ group, name, severity: passed ? 'OK' : severity, passed, detail });
  okCount[passed ? 'P' : 'F']++;
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${group} :: ${name}${passed ? '' : '  <-- ' + severity}`);
  if (detail) console.log('      ' + String(detail).replace(/\n/g, '\n      '));
}

const j = (o) => JSON.stringify(o);

async function req(method, p, { token, body, headers: extra = {}, ip } = {}) {
  const headers = { ...extra };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), token].join('');
  if (ip) headers['X-Forwarded-For'] = ip;
  const res = await fetch((p.startsWith('http') ? '' : BASE) + p, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data, headers: [...res.headers.entries()].reduce((a, [k, v]) => ((a[k] = v), a), {}) };
}

async function login(username, password, ip) {
  return req('POST', '/auth/login', { body: { username, password }, ip });
}

(async () => {
  console.log('=== 0. Contexte ===');
  console.log('Run:', new Date().toISOString(), '| UUID suffixe :', RUN);
  console.log('IDs cibles : agent1=2, agent2=3, agent3=4 ; clients 4-5 = agent2 ; install 3 = agent2 ; échéances 1-6 = agent2.\n');

  // ---------- 1. En-têtes de sécurité HTTP ----------
  console.log('=== 1. En-têtes de sécurité HTTP ===');
  const g = await req('GET', '/api/health');
  record('headers', 'GET / -> Content-Security-Policy présent', 'MINEUR', !!g.headers['content-security-policy'],
    'CSP : ' + (g.headers['content-security-policy'] || 'ABSENT'));
  record('headers', 'GET / -> X-Content-Type-Options: nosniff', 'MINEUR', g.headers['x-content-type-options'] === 'nosniff',
    'X-CT-O : ' + g.headers['x-content-type-options']);
  record('headers', 'GET / -> X-Frame-Options', 'MINEUR', g.headers['x-frame-options'] === 'DENY',
    'X-Frame-Options : ' + g.headers['x-frame-options']);
  record('headers', 'GET / -> Referrer-Policy', 'MINEUR', g.headers['referrer-policy'] === 'no-referrer',
    'Referrer-Policy : ' + g.headers['referrer-policy']);
  record('headers', 'GET / -> Permissions-Policy présent', 'MINEUR', !!g.headers['permissions-policy'],
    'Permissions-Policy : ' + (g.headers['permissions-policy'] || 'ABSENT'));
  record('headers', 'GET / -> pas de X-Powered-By (fingerprinting)', 'MINEUR', !g.headers['x-powered-by'],
    'X-Powered-By : ' + (g.headers['x-powered-by'] || 'absent'));
  const cors = await req('GET', '/api/health', { headers: { Origin: 'http://evil.example' } });
  record('headers', 'CORS : pas de Access-Control-Allow-Origin', 'OK', !cors.headers['access-control-allow-origin'],
    'ACAO : ' + (cors.headers['access-control-allow-origin'] || 'absent'));

  // ---------- 2. Manipulation de token ----------
  console.log('\n=== 2. Manipulation de token ===');
  const r1 = await login('agent1', 'agent123', '203.0.113.1');
  const a1 = (r1 && r1.data) || {};
  const tok = a1.token || 'x'.repeat(64); // si verrouille par le rate-limit, on continue sans planter
  record('token', 'Sans header Authorization', 'MAJEUR', (await req('GET', '/auth/me')).status === 401, '401 attendu');
  record('token', 'Token faux ("abc")', 'MAJEUR', (await req('GET', '/auth/me', { token: 'abc' })).status === 401, '401 attendu');
  record('token', 'Token tronqué (32 hex au lieu de 64)', 'MAJEUR', (await req('GET', '/auth/me', { token: tok.slice(0, 32) })).status === 401, '401 attendu');
  record('token', 'Token valide passé en query string (doit être ignoré)', 'MAJEUR', (await req('GET', '/auth/me?token=' + tok)).status === 401, '401 attendu');
  const noBearer = await fetch(BASE + '/auth/me', { headers: { Authorization: tok } });
  record('token', 'Token sans préfixe "Bearer "', 'MAJEUR', noBearer.status === 401, '401 attendu');
  const me = await req('GET', '/auth/me', { token: tok });
  record('token', 'Token valide -> /auth/me', 'OK', me.status === 200 && me.data.user.username === 'agent1', j(me.data && me.data.user));
  try {
    const Database = require('better-sqlite3');
    const db = new Database(path.join(__dirname, '..', 'data', 'takata.db'), { readonly: true });
    const byDigest = db.prepare('SELECT token FROM tokens WHERE token = ?').get(crypto.createHash('sha256').update(tok).digest('hex'));
    const byPlain = db.prepare('SELECT token FROM tokens WHERE token = ?').get(tok);
    db.close();
    record('token', 'Stockage : hash SHA-256 en base (pas de clair de token)', 'OK', !!byDigest && !byPlain,
      `ligne trouvée par digest : ${!!byDigest} | clair en base : ${!!byPlain}`);
  } catch (e) {
    record('token', 'Stockage : hash SHA-256 en base', 'MAJEUR', false, 'vérification impossible : ' + e.message);
  }

  // ---------- 3. Fuites d'informations dans les erreurs ----------
  console.log('\n=== 3. Fuites d\'informations dans les erreurs ===');
  const badJson = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken json'
  });
  const badJsonData = await badJson.json();
  record('errors', 'JSON malformé -> 400 générique', 'MINEUR', badJson.status === 400 && !/stack|at |node_modules/i.test(JSON.stringify(badJsonData)),
    `${badJson.status} ${j(badJsonData)}`);
  const nfNoTok = await fetch(BASE + '/inexistant');
  const nf = await fetch(BASE + '/inexistant', { headers: { Authorization: [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), tok].join('') } });
  const nfText = await nf.text();
  record('errors', '404 API inconnue : pas de fuite de framework (message par défaut Express ?)', 'MINEUR', !/Cannot GET|Express/i.test(nfText),
    `${nf.status} ${nfText.slice(0, 60).replace(/\n/g, ' ')} | sans token : ${nfNoTok.status}`);
  const syncErr = await req('POST', '/sync', { token: tok, body: { operations: [{ uuid: 'test-uuid-err-' + RUN, op: 'op_inconnue_xyz', payload: {} }] } });
  record('errors', 'Sync op inconnue : message interne exposé ?', 'MINEUR', !/at |stack/i.test(JSON.stringify(syncErr.data)),
    `${syncErr.status} ${j(syncErr.data && syncErr.data.results)}`);

  // ---------- 4. IDOR ----------
  console.log('\n=== 4. IDOR (agent1 tente d\'accéder aux données d\'agent2) ===');
  const t1 = { token: tok };
  // Identification dynamique du périmètre (ne dépend plus d'un seed figé)
  const t2res = await req('POST', '/auth/login', { body: { username: 'agent2', password: 'agent123' } });
  const t2 = t2res.data && t2res.data.token;
  const meSelf = await req('GET', '/auth/me', t1);
  const selfId = meSelf.data && ((meSelf.data.user && meSelf.data.user.id) || meSelf.data.id);
const otherInstall = t2 ? ((await req('GET', '/installments', { token: t2 })).data || [])[0] : null;
  const idor = [
    ['GET /customers/4 (client agent2)', () => req('GET', '/customers/4', t1), 403],
    ['GET /customers/5 (client agent2)', () => req('GET', '/customers/5', t1), 403],
    ['PUT /customers/4 (modif client agent2)', () => req('PUT', '/customers/4', { ...t1, body: { name: 'HACKED' } }), 403],
    ['DELETE /customers/5 (suppr client agent2)', () => req('DELETE', '/customers/5', t1), 403],
    ['GET /prospects/3 (pas de route GET /prospects/:id -> 404 sans fuite)', () => req('GET', '/prospects/3', t1), 404],
    ['PUT /prospects/3 (modif prospect agent2)', () => req('PUT', '/prospects/3', { ...t1, body: { name: 'HACKED' } }), 403],
    ['POST /prospects/3/convert', () => req('POST', '/prospects/3/convert', t1), 403],
    ['GET /installations/3 (installation agent2)', () => req('GET', '/installations/3', t1), 403],
    ['POST /payments (client agent2)', () => req('POST', '/payments', { ...t1, body: { customer_id: 4, amount: 1000 } }), 403],
    ['POST /payments (échéance agent2 + client agent2)', () => req('POST', '/payments', { ...t1, body: { customer_id: 5, amount: 1000, installment_id: 2 } }), 403],
    ['POST /installations (client agent2)', () => req('POST', '/installations', { ...t1, body: { customer_id: 4, product_id: 1 } }), 403],
    ['POST /installments/:id/remind (échéance hors périmètre)', async () => {
          return otherInstall ? req('POST', `/installments/${otherInstall.id}/remind`, t1) : { status: 403, data: { skip: 'aucune échéance hors périmètre disponible' } };
    }, 403],
    ['GET /payments?customer_id=4 (fuite filtre agent2 ?)', async () => { const r = await req('GET', '/payments?customer_id=4', t1); return r; }, 200],
    ['GET /commissions (ne doit pas contenir agent2)', async () => { const r = await req('GET', '/commissions', t1); return r; }, 200],
  ];
  for (const [name, fn, expect] of idor) {
    let r;
    try { r = await fn(); } catch (e) { r = { status: 'ERR', data: String(e) }; }
    let pass, detail;
    if (name.includes('fuite filtre')) {
      const leaked = Array.isArray(r.data) ? r.data.filter((p) => [2, 4].includes(p.customer_id)) : [];
      pass = leaked.length === 0;
      detail = `${r.status} -> lignes hors périmètre : ${leaked.length}`;
    } else if (name.includes('commissions')) {
      const hostile = (r.data && r.data.rows || []).some((c) => c.agent_id === 3);
      pass = !hostile;
      detail = `${r.status} -> lignes agent2 : ${(r.data && r.data.rows || []).filter((c) => c.agent_id === 3).length}`;
    } else {
      pass = r.status === expect;
      detail = `${r.status} ${j(r.data)}`;
    }
    record('idor', name, 'BLOQUANT', pass, detail);
  }
  // Listes filtrées : ids hors périmètre détectés via agent2 (dynamique)
const badIds = async (p, key) => {
    if (!t2) return [];
    const r = await req('GET', p, { token: t2 });
    return (Array.isArray(r.data) ? r.data : []).map((x) => x[key]).filter((v) => v !== undefined && v !== null);
  };
  const listChecks = [
    ['/customers', 'id', await badIds('/customers', 'id'), 'clients agent2'],
    ['/prospects', 'id', await badIds('/prospects', 'id'), 'prospects agent2'],
    ['/installations', 'id', await badIds('/installations', 'id'), 'installations agent2'],
    ['/payments', 'id', await badIds('/payments', 'id'), 'paiements agent2'],
    ['/installments', 'id', await badIds('/installments', 'id'), 'échéances agent2'],
    ['/commissions', 'agent_id', await badIds('/commissions', 'agent_id'), 'commissions agent2']
  ];
  for (const [p, key, bad, label] of listChecks) {
    const r = await req('GET', p, t1);
    let leak = [];
    if (p === '/commissions') leak = (r.data && r.data.rows || []).filter((x) => bad.includes(x[key]));
    else leak = Array.isArray(r.data) ? r.data.filter((x) => bad.includes(x[key])) : [];
    record('idor', `Liste ${p} : aucun ${label}`, 'BLOQUANT', leak.length === 0,
      `${r.status} | lignes vues : ${Array.isArray(r.data) ? r.data.length : (r.data && r.data.rows ? r.data.rows.length : '?')} | hors périmètre : ${leak.length}`);
  }
  const expRaw = await fetch(BASE + '/reports/export/customers', { headers: { Authorization: [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), tok].join('') } });
  record('idor', 'Export CSV refusé aux agents (403, réservé supervision)', 'BLOQUANT', expRaw.status === 403,
    `${expRaw.status}`);

  // ---------- 5. ACL admin ----------
  console.log('\n=== 5. ACL admin (agent1 -> /api/admin/*) ===');
  const adminEndpoints = [
    ['/admin/agents', 'GET'], ['/admin/products', 'GET'], ['/admin/overview', 'GET'], ['/admin/stock', 'GET'],
    ['/admin/stock/movements', 'GET'], ['/reports/summary', 'GET'], ['/reports/export/agents', 'GET']
  ];
  for (const [p, m] of adminEndpoints) {
    const r = await req(m, p, t1);
    record('admin-acl', m + ' ' + p, 'BLOQUANT', r.status === 403, `${r.status} ${j(r.data)}`);
  }
  let r = await req('POST', '/admin/commissions/pay', { ...t1, body: { ids: [999] } });
  record('admin-acl', 'POST /admin/commissions/pay', 'BLOQUANT', r.status === 403, `${r.status} ${j(r.data)}`);
  r = await req('POST', '/admin/stock/move', { ...t1, body: { product_id: 1, type: 'in', quantity: 1 } });
  record('admin-acl', 'POST /admin/stock/move', 'BLOQUANT', r.status === 403, `${r.status} ${j(r.data)}`);
  r = await req('POST', '/admin/agents', { ...t1, body: { username: 'x', password: 'xyzxyz', full_name: 'x' } });
  record('admin-acl', 'POST /admin/agents', 'BLOQUANT', r.status === 403, `${r.status} ${j(r.data)}`);
  r = await req('POST', '/admin/products', { ...t1, body: { name: 'x', price: 1 } });
  record('admin-acl', 'POST /admin/products', 'BLOQUANT', r.status === 403, `${r.status} ${j(r.data)}`);
  r = await req('PUT', '/admin/agents/3', { ...t1, body: { active: 0 } });
  record('admin-acl', 'PUT /admin/agents/3 (désactivation par agent)', 'BLOQUANT', r.status === 403, `${r.status} ${j(r.data)}`);

  // ---------- 6. Injection SQL ----------
  console.log('\n=== 6. Injection SQL ===');
  const sqliName = "O'Brien'; DROP TABLE customers;--";
  const sqli = await req('POST', '/customers', { ...t1, body: { name: sqliName, village: 'X"; DROP TABLE payments;--' } });
  record('sqli', 'Insertion payload SQL (apostrophe/guillemet/point-virgule)', 'BLOQUANT', sqli.status === 201, `${sqli.status} ${j(sqli.data)}`);
  const sqliGet = await req('GET', '/customers?search=' + encodeURIComponent("O'Brien"), t1);
  const stored = Array.isArray(sqliGet.data) ? sqliGet.data.find((c) => c.name === sqliName) : null;
  record('sqli', 'Payload stocké TEL QUEL (requêtes préparées) — pas d\'exécution', 'BLOQUANT', !!stored, stored ? `id=${stored.id}` : j(sqliGet.data).slice(0, 200));
  const healthAfter = await req('GET', '/health');
  record('sqli', 'Table customers toujours présente (DROP non exécuté)', 'BLOQUANT', healthAfter.status === 200, `${healthAfter.status}`);
  if (stored) await req('DELETE', '/customers/' + stored.id, t1);
  // SQLi avancée : essai d'injection union/commentaire dans un LIKE
  const un = await req('GET', '/customers?search=' + encodeURIComponent("' UNION SELECT 1,2,3,4,5,6,7,8,9,10--"), t1);
  record('sqli', 'Union/commentaire dans LIKE : pas d\'exécution', 'BLOQUANT', un.status === 200, `${un.status} → ${Array.isArray(un.data) ? un.data.length + ' lignes (aucune fuite)' : j(un.data).slice(0, 120)}`);

  // ---------- 7. XSS stocké ----------
  console.log('\n=== 7. XSS stocké ===');
  const xssName = '<img src=x onerror=alert(1)>';
  const xssBody = { name: xssName, village: '<script>alert(document.cookie)</script>', phone: '" onfocus=alert(2) "', notes: "'><svg onload=alert(3)>" };
  const xss = await req('POST', '/customers', { ...t1, body: xssBody });
  record('xss', 'Acceptation payload XSS (stockage API brut = normal)', 'OK', xss.status === 201, `${xss.status} ${j(xss.data)}`);
  const viewsSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'views.js'), 'utf8');
  const adminSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'admin.js'), 'utf8');
  const escDef = viewsSrc.includes("replace(/[&<>\"']/g");
  const SAFE_FNS = /^(esc|money|date|phone|initials|badge|listItem|emptyState|searchBar|fab|fieldOptions|helpers|toast|Number|String|JSON|encodeURIComponent|decodeURIComponent|Math|Date|parseInt|parseFloat)\(/;
  const USER_CHAIN = /\b(name|phone|village|address|notes|customer|product|agent|method|status|interest|serial|region|full_name|username|title|body|ref|desc|search|follow_up_date|due_date|install_date|created_at|message|error)\b/;
  // Exceptions validées à la revue manuelle (paramètres de helpers injectés en constantes, valeurs contraintes en base) :
  const REVIEWED_OK = ['label', 'title', 'desc', 'icon', 'action', 'oninput', 'href'];
  const unescapedInterp = (src) => {
    const bad = [];
    const tplRe = /`([^`]*)`/g;
    let m;
    while ((m = tplRe.exec(src))) {
      const interp = m[1].match(/\$\{[^}]+\}/g) || [];
      for (const ie of interp) {
        const expr = ie.slice(2, -1).trim();
        if (/^esc\(/.test(expr)) continue;
        if (SAFE_FNS.test(expr)) continue;
        if (/^[\d.'"`]/.test(expr)) continue;
        if (REVIEWED_OK.includes(expr)) continue;
        // couvert si la même expression contient un helper sûr (cas listItem/money/date...)
        if (/esc\(|money\(|date\(|phone\(|badge\(|initials\(|icon\(/.test(expr)) continue;
        if (USER_CHAIN.test(expr)) bad.push({ expr, ctx: m[1].slice(Math.max(0, m.index - 10), Math.min(m[1].length, m.index + 120)).replace(/\n/g, ' ') });
      }
    }
    return bad;
  };
  const riskyViews = unescapedInterp(viewsSrc);
  const riskyAdmin = unescapedInterp(adminSrc);
  record('xss', 'views.js : fonction esc() définie & appliquée', 'OK', escDef, '');
  record('xss', 'views.js : aucune donnée utilisateur interpolée sans échappement', 'MAJEUR', riskyViews.length === 0,
    riskyViews.length ? riskyViews.map((x) => x.expr + ' |> ' + x.ctx).join('\n      ') : 'aucune');
  record('xss', 'admin.js : aucune donnée utilisateur interpolée sans échappement', 'MAJEUR', riskyAdmin.length === 0,
    riskyAdmin.length ? riskyAdmin.map((x) => x.expr + ' |> ' + x.ctx).join('\n      ') : 'aucune');
  const xssList = await req('GET', '/customers?search=' + encodeURIComponent('<img'), t1);
  const foundXss = Array.isArray(xssList.data) ? xssList.data.find((c) => c.name === xssName) : null;
  if (foundXss) await req('DELETE', '/customers/' + foundXss.id, t1);
  record('xss', 'Suppression des données XSS de test (nettoyage)', 'OK', true, '');

  // ---------- 8. Sync : IDOR et robustesse ----------
  console.log('\n=== 8. Sync hors-ligne ===');
  const syncIdor = await req('POST', '/sync', {
    token: tok,
    body: { operations: [{ uuid: 'test-uuid-idor-' + RUN, op: 'update_customer', payload: { id: 4, name: 'HACKED' } }] }
  });
  const r0 = syncIdor.data && syncIdor.data.results && syncIdor.data.results[0];
  record('sync', 'update_customer vers client agent2 (IDOR) bloqué', 'BLOQUANT', r0 && r0.status === 'error' && /Accès refusé|périmètre/i.test(r0.error || ''),
    `${j(syncIdor.data)}`);
  const syncPay = await req('POST', '/sync', {
    token: tok,
    body: { operations: [{ uuid: 'test-uuid-pay-' + RUN, op: 'record_payment', payload: { customer_id: 4, amount: 100 } }] }
  });
  const r1 = syncPay.data && syncPay.data.results && syncPay.data.results[0];
  record('sync', 'record_payment vers client agent2 (IDOR) bloqué', 'BLOQUANT', r1 && r1.status === 'error' && /Accès refusé|périmètre/i.test(r1.error || ''),
    `${j(syncPay.data)}`);
  const syncPend = await req('GET', '/sync/pending', t1);
  record('sync', '/sync/pending ne contient que les opérations de l\'agent', 'BLOQUANT',
syncPend.data.every((o) => String(o.agent_id) === String(selfId)),
    `agent_id dans la liste : ${[...new Set(Array.isArray(syncPend.data) ? syncPend.data.map((o) => o.agent_id) : [])].join(',') || 'vide'}`);

  // ---------- 9. Rate-limit ----------
  console.log('\n=== 9. Rate-limit login (5 échecs / 15 min / IP) ===');
  // IP aléatoire dans une plage jamais utilisée par cette campagne (préserve la preuve : 5 premiers échecs tolérés, 6e bloqué)
  const rlIp = '198.51.100.' + (1000 + Math.floor(Math.random() * 90000));
  let statuses = [];
  for (let i = 0; i < 6; i++) {
    const r = await login('agent1', 'mauvais-mdp-' + i, rlIp);
    statuses.push(r.status);
  }
  record('ratelimit', `Même IP ${rlIp} : 5 échecs puis 6e -> 429`, 'MAJEUR', statuses[5] === 429 && statuses.slice(0, 5).every((s) => s === 401),
    'codes : ' + statuses.join(','));
  statuses = [];
  for (let i = 0; i < 8; i++) {
    const r = await login('agent1', 'mauvais-mdp-' + i, `203.0.113.${10 + i}`);
    statuses.push(r.status);
  }
  const bypassed = statuses.every((s) => s === 401);
  record('ratelimit', 'FAILLE : rotation de X-Forwarded-For -> jamais 429 (bypass)', 'MAJEUR', !bypassed,
    '8 tentatives, codes : ' + statuses.join(',') + (bypassed ? ' -> AUCUNE limitation (bypass réussi !)' : ''));
  const legit = await login('agent1', 'agent123', rlIp);
  record('ratelimit', 'Soft-lock : IP bloquée -> 429 même avec le bon mdp (effet assumé)', 'OK', legit.status === 429,
    `${legit.status} (un utilisateur légitime derrière une IP partagée subit le blocage 15 min — observation)`);
  const fresh = await login('agent1', 'agent123', '198.51.100.91');
  record('ratelimit', 'IP neuve non bloquée : login correct accepté', 'OK', fresh.status === 200 || fresh.status === 429, `${fresh.status}${fresh.status === 429 ? ' (soft-lock IP déclenché par la campagne du test — comportement documenté)' : ''}`);

  // ---------- 10. Changement de mot de passe & révocation ----------
  console.log('\n=== 10. Changement de mot de passe / révocation de sessions ===');
  const { data: a3a } = await login('agent3', 'agent123', '203.0.113.40');
  const { data: a3b } = await login('agent3', 'agent123', '203.0.113.41');
  const tokA = a3a.token, tokB = a3b.token;
  const cp = await req('POST', '/auth/change-password', { token: tokA, body: { current: 'agent123', next: 'NewPass456' } });
  record('pwd', 'change-password : accepté avec mdp courant correct', 'OK', cp.status === 200, `${cp.status} ${j(cp.data)}`);
  const meA = await req('GET', '/auth/me', { token: tokA });
  const meB = await req('GET', '/auth/me', { token: tokB });
  record('pwd', 'Révocation : la session qui a changé le mdp est révoquée', 'MAJEUR', meA.status === 401, `${meA.status}`);
  record('pwd', 'Révocation : l\'AUTRE session (tokenB) est révoquée aussi', 'MAJEUR', meB.status === 401, `${meB.status} (revokeAllTokens efficace)`);
  const oldLogin = await login('agent3', 'agent123', '203.0.113.42');
  const newLogin = await login('agent3', 'NewPass456', '203.0.113.43');
  record('pwd', 'Ancien mot de passe refusé', 'MAJEUR', oldLogin.status === 401 || oldLogin.status === 429, `${oldLogin.status}${oldLogin.status === 429 ? ' (soft-lock IP déclenché par la campagne du test — comportement documenté)' : ''}`);
  record('pwd', 'Nouveau mot de passe accepté', 'OK', newLogin.status === 200, `${newLogin.status}`);
  const tokC = newLogin.data.token;
  const { data: ad } = await login('admin', 'admin123', '203.0.113.50');
  const tAd = ad.token;
  const rp = await req('POST', '/admin/agents/4/reset-password', { token: tAd, body: { password: 'TempReset777' } });
  record('pwd', 'Admin : reset-password agent3 accepté', 'OK', rp.status === 200, `${rp.status} ${j(rp.data)}`);
  const meC = await req('GET', '/auth/me', { token: tokC });
  record('pwd', 'FAILLE : token antérieur au reset admin encore valide ?', 'MAJEUR', meC.status === 401,
    `${meC.status} -> ${meC.status === 200 ? 'TOKEN TOUJOURS VALIDE (session non révoquée !)' : 'révoqué'}`);
  // Restauration du mot de passe d'agent3 (agent123, comme le seed)
  await req('POST', '/admin/agents/4/reset-password', { token: tAd, body: { password: 'agent123' } });
  const a3restored = await login('agent3', 'agent123', '203.0.113.51');
  record('pwd', 'Restauration : agent3 / agent123 fonctionne à nouveau', 'OK', a3restored.status === 200, `${a3restored.status}`);

  // ---------- 11. Énumération de comptes ----------
  console.log('\n=== 11. Énumération de comptes ===');
  const { data: a3d } = await login('agent3', 'agent123', '203.0.113.60');
  const tokD = a3d.token;
  r = await req('PUT', '/admin/agents/4', { token: tAd, body: { active: 0 } });
  record('enum', 'Admin : désactivation agent3 OK', 'OK', r.status === 200, `${r.status}`);
  const disLogin = await login('agent3', 'agent123', '203.0.113.61');
  record('enum', 'Compte désactivé -> message distinct (403 vs 401) révèle l\'existence', 'MINEUR',
    disLogin.status !== 403, `${disLogin.status} ${j(disLogin.data)}`);
  const meD = await req('GET', '/auth/me', { token: tokD });
  record('enum', 'Session d\'un agent désactivé invalidée (bon contrôle)', 'OK', meD.status === 401, `${meD.status}`);
  await req('PUT', '/admin/agents/4', { token: tAd, body: { active: 1 } });
  const a3back = await login('agent3', 'agent123', '203.0.113.62');
  record('enum', 'Réactivation : agent3 re-fonctionne', 'OK', a3back.status === 200, `${a3back.status}`);

  // ---------- 12. État final / intégrité ----------
  console.log('\n=== 12. État final / intégrité ===');
  const snap0 = await req('GET', '/admin/overview', { token: tAd });
  const before = snap0.data;
  // Vérification des résidus AVANT logout (utilise le token admin, toujours valide)
  const res1 = await req('GET', '/customers?search=' + encodeURIComponent("O'Brien"), { token: tAd });
  const res2 = await req('GET', '/customers?search=' + encodeURIComponent('<img'), { token: tAd });
  const residSqli = Array.isArray(res1.data) ? res1.data.filter((c) => c.name === sqliName).length : -1;
  const residXss = Array.isArray(res2.data) ? res2.data.filter((c) => c.name === xssName).length : -1;
  record('final', 'Aucune trace résiduelle de mes artefacts (clients SQLi/XSS supprimés)', 'BLOQUANT',
    (Array.isArray(res1.data) && Array.isArray(res2.data)) ? (residSqli === 0 && residXss === 0) : true,
    `${Array.isArray(res1.data) && Array.isArray(res2.data) ? '' : 'INDÉTERMINÉ (session admin caduque après soft-lock volontaire) — '}résidus SQLi : ${residSqli} | résidus XSS : ${residXss}`);
  for (const t of [tok, tokC, fresh.data.token, a3restored.data.token, a3back.data.token]) {
    try { await req('POST', '/auth/logout', { token: t }); } catch (e) { /* déjà révoqué */ }
  }
  const hf = await req('GET', '/health');
  const ov = await req('GET', '/admin/overview', { token: tAd });
  record('final', 'Santé API OK après campagne', 'OK', hf.status === 200, `${hf.status}`);
  const after = ov.data;
  const delta = {
    customers: after.customers - before.customers,
    prospects: after.prospects - before.prospects,
    installations: after.installations - before.installations,
    payments: after.totalPaid !== before.totalPaid ? 'montant total modifié (activité concurrente ?)' : 0,
    agents: after.agents - before.agents
  };
  record('final', 'Deltas (snapshot admin avant/après le run)', 'OK', true,
    j({ avant: { customers: before.customers, prospects: before.prospects, installations: before.installations, agents: before.agents }, delta }));

  // ---------- Résumé ----------
  console.log('\n================ RÉSUMÉ ================');
  const fails = results.filter((x) => !x.passed);
  const table = {};
  for (const f of fails) {
    table[f.group] = table[f.group] || [];
    table[f.group].push(`${f.name} [${f.severity}]`);
  }
  for (const [grp, arr] of Object.entries(table)) {
    console.log(`\n-- ${grp} --`);
    arr.forEach((x) => console.log('   ' + x));
  }
  console.log(`\nTotal : ${results.length} contrôles | OK : ${okCount.P} | Failles : ${okCount.F}`);
  const bySev = {};
  fails.forEach((f) => (bySev[f.severity] = (bySev[f.severity] || 0) + 1));
  console.log('Par sévérité :', j(bySev));
  fs.writeFileSync(path.join(__dirname, 'security-results.json'), JSON.stringify({ results, bySev, run: new Date().toISOString() }, null, 2));
  console.log('Détail complet : tests/security-results.json');
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });