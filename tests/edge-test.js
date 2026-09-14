// edge-test.js — Tests fonctionnels adversariaux TAKATA (logique métier & validations)
// Usage : node tests/edge-test.js   (serveur attendu sur http://localhost:8080)
// Données créées préfixées "edge_" pour nettoyage. Ne touche ni routes/ ni public/.
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const OUT_JSON = path.join(__dirname, '..', '..', '..', '.openclaw', 'tmp', 'edge-results.json');
const RUN = Date.now().toString(36).slice(-6); // suffixe d'exécution → noms edge_ uniques entre relances
const UU = (s) => 'edge-' + RUN + '-uuid-' + s;   // uuid de sync uniques par exécution

const results = [];   // checks PASS/FAIL
const defects = [];   // défauts trouvés {sev,title,endpoint,repro,expected,observed}
const notes = [];     // comportements constatés "OK mais à connaître"

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
function defect(sev, title, endpoint, repro, expected, observed) {
  defects.push({ sev, title, endpoint, repro, expected, observed });
  console.log(`\n⚠️  [${sev}] ${title} (${endpoint})\n    attendu: ${expected}\n    observé: ${observed}`);
}
function note(msg) { notes.push(msg); console.log(`   · note: ${msg}`); }

async function req(method, p, { token, body, raw, headers = {}, timeout = 15000, maxText = 400 } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers: h, signal: AbortSignal.timeout(timeout) };
  if (raw !== undefined) opts.body = raw;
  else if (body !== undefined) opts.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(BASE + p, opts);
  } catch (e) {
    return { status: 0, json: null, text: String(e.message) };
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  const headersObj = {};
  res.headers.forEach((v, k) => { headersObj[k] = v; });
  return { status: res.status, json, text: text.slice(0, maxText), fullText: text, headers: headersObj };
}
// Lecture du stock par NOM de produit (GET /api/stock agent): renvoie {quantity} ou null
async function stockByName(name, token) {
  const r = await req('GET', '/api/stock', { token });
  const row = (r.json || []).find((s) => s.name === name);
  return row || null;
}
const J = (r) => JSON.stringify(r);

async function login(username, password, xff) {
  const r = await req('POST', '/api/auth/login', { body: { username, password }, headers: xff ? { 'X-Forwarded-For': xff } : {} });
  return r;
}

(async () => {
  const started = Date.now();
  console.log(`=== TAKATA edge tests @ ${BASE} — ${new Date().toISOString()} ===\n`);

  // ---- Connexions de base ----
  const adminLogin = await login('admin', 'admin123');
  check('A1 login admin', adminLogin.status === 200 && !!adminLogin.json?.token, J(adminLogin.json?.user?.username));
  const agent1Login = await login('agent1', 'agent123');
  check('A2 login agent1', agent1Login.status === 200 && !!agent1Login.json?.token);
  const agent2Login = await login('agent2', 'agent123');
  check('A3 login agent2', agent2Login.status === 200 && !!agent2Login.json?.token);
  const adminTok = adminLogin.json.token, a1 = agent1Login.json.token, a2 = agent2Login.json.token;

  // ================= AUTH =================
  let r;
  r = await req('POST', '/api/auth/login', { body: {} });
  check('A4 login champs vides → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/auth/login', { body: { username: 'agent1' } });
  check('A5 login sans password → 400', r.status === 400, J(r.json));
  r = await login('agent1', 'mauvais-mot-de-passe');
  check('A6 login mauvais password → 401', r.status === 401, J(r.json));
  // Bypass rate-limit via X-Forwarded-For (6 échecs sur IP A → 429 ; IP B → re-essai autorisé)
  const fakeIP = '203.0.113.77';
  let last = null;
  for (let i = 0; i < 6; i++) last = await login('admin', 'tropFaux', fakeIP);
  check('A7 rate-limit: 6e échec même IP → 429', last.status === 429, J(last.json));
  const bypass = await login('admin', 'tropFaux', '203.0.113.78');
  check('A8 rate-limit contournable en changeant X-Forwarded-For (attendu: 401, pas 429)', bypass.status === 401, J(bypass.json));
  if (bypass.status === 401) { /* bypass prouvé: le contrôle ne freine pas l'attaquant qui change l'en-tête */
    defect('Mineur', 'Rate-limit login contournable via en-tête X-Forwarded-For forgé', 'POST /api/auth/login',
      `6 échecs avec X-Forwarded-For: ${fakeIP} puis un échec avec X-Forwarded-For: 203.0.113.78`,
      'Le 7e échec devrait être bloqué (429), quelle que soit l\'IP annoncée',
      `429 sur la même IP ${fakeIP}, mais 401 (nouvelle tentative acceptée) avec un autre X-Forwarded-For. Le limiteur fait confiance à un en-tête contrôlable par le client.`);
  } else { check('A8 rate-limit', true); }

  // Logout + token invalidé
  r = await req('POST', '/api/auth/logout', { token: a2 });
  check('A9 logout → 200', r.status === 200, J(r.json));
  r = await req('GET', '/api/auth/me', { token: a2 });
  check('A10 token après logout → 401', r.status === 401, J(r.json));
  // re-login agent2
  const a2b = await login('agent2', 'agent123');
  const a2t = a2b.json.token;
  check('A11 re-login agent2', a2b.status === 200);
  r = await req('GET', '/api/auth/me', {});
  check('A12 /me sans token → 401', r.status === 401);
  r = await req('POST', '/api/auth/register-agent', { token: a1, body: { username: 'edge_x', password: '123456', full_name: 'X' } });
  check('A13 register-agent par agent → 403', r.status === 403, J(r.json));

  // Change-password (agent jetable)
  const pwUser = 'edge_pw' + RUN;
  r = await req('POST', '/api/admin/agents', { token: adminTok, body: { username: pwUser, password: 'edge000', full_name: 'Edge PW' } });
  check('A14 création agent ' + pwUser, r.status === 201, J(r.json));
  const edgePwLogin = await login(pwUser, 'edge000');
  const edgePwTok = edgePwLogin.json?.token;
  check('A15 login ' + pwUser, edgePwLogin.status === 200);
  r = await req('POST', '/api/auth/change-password', { token: edgePwTok, body: { current: 'edge000', next: 'edge456' } });
  check('A16 change-password OK → 200', r.status === 200, J(r.json));
  r = await req('GET', '/api/auth/me', { token: edgePwTok });
  check('A17 ancien token révoqué → 401', r.status === 401, J(r.json));
  r = await login(pwUser, 'edge456');
  check('A18 login nouveau password → 200', r.status === 200);
  r = await login(pwUser, 'edge000');
  check('A19 login ancien password → 401', r.status === 401);
  r = await req('POST', '/api/auth/change-password', { token: (await login(pwUser, 'edge456')).json.token, body: { current: 'edge456', next: 'abc' } });
  check('A20 nouveau mdp trop court → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/admin/agents', { token: adminTok, body: { username: pwUser, password: 'edge000', full_name: 'Dup' } });
  check('A21 doublon username agent → 409', r.status === 409, J(r.json));
  r = await req('POST', '/api/admin/agents', { token: adminTok, body: { username: '   ', password: 'edge000', full_name: 'Espaces' } });
  const a22Created = r.status === 201;
  check('A22 username blanc → 201', a22Created || r.status === 409, J(r.json));
  if (a22Created || r.status === 409) {
    const lu = await login('   ', 'edge000');
    check('A23 login avec les espaces fonctionne mais identité vide', lu.status === 200 && lu.json?.user?.username === '', J(lu.json));
    defect('Mineur', 'Username composé d\'espaces accepté → compte dont le username effectif est la chaîne vide', 'POST /api/admin/agents',
      'Créer un agent avec username: "   " (espaces seuls)',
      '400 — username requis après trim (identifiants d\'authentification ambigus)',
      `201 — l'agent est créé (ou existait déjà d'une exécution précédente) avec username="" ; login avec "   " (ou tout texte dont le trim est vide) → 200. Le champ username sert d'identifiant : un compte sans identifiant distinct est un risque d'usurpation/confusion.`);
  } else { check('A23 username blanc', true); }
  r = await req('POST', '/api/admin/agents', { token: adminTok, body: { username: 'edge_short', password: '123', full_name: 'Court' } });
  check('A24 password < 6 → 400', r.status === 400, J(r.json));

  // ================= CUSTOMERS =================
  let edgeCustId = null;
  r = await req('POST', '/api/customers', { token: a1, body: {} });
  check('B1 customer {} → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/customers', { token: a1, body: { name: '' } });
  check('B2 customer name="" → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/customers', { token: a1, body: { name: '   ' } });
  check('B3 customer name="   " → 201? (nom vide en base)', r.status === 201, J(r.json));
  if (r.status === 201) {
    const idBlank = r.json.id;
    const g = await req('GET', `/api/customers/${idBlank}`, { token: a1 });
    defect('Mineur', 'Nom de client composé d\'espaces accepté → client sans nom en base', 'POST /api/customers',
      `POST /api/customers avec name: "   " (3 espaces)`,
      '400 — le nom doit être non vide après trim (les espaces seuls ne sont pas un nom)',
      `201 {id:${idBlank}} ; GET /api/customers/${idBlank} renvoie un client avec name: "" (vide) — fiche inexploitable.`);
  }
  r = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_Client Normal', phone: '099 000 111', village: 'EdgeVille' } });
  check('B4 customer valide → 201', r.status === 201, J(r.json));
  edgeCustId = r.json.id;
  r = await req('POST', '/api/customers', { token: a1, body: { name: 12345 } });
  check('B5 name numérique → 201 (tolérance)', r.status === 201, J(r.json));
  if (r.status === 201) {
    const g = await req('GET', `/api/customers/${r.json.id}`, { token: a1 });
    note(`name numérique stocké comme "${g.json?.name}"`);
  }
  r = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_Obj', phone: { a: 1 } } });
  check('B6 phone objet → 201 (coercition "[object Object]")', r.status === 201, J(r.json));
  if (r.status === 201) {
    defect('Mineur', 'Types non validés: un objet passé en phone est stocké "[object Object]"', 'POST /api/customers',
      `POST /api/customers { name:"edge_Obj", phone:{a:1} }`,
      '400 — phone doit être une chaîne (ou null), pas un objet',
      `201 ; GET /api/customers/${r.json.id} → phone: "[object Object]" (coercition String() silencieuse).`);
  }
  r = await req('GET', '/api/customers/99999999', { token: a1 });
  check('B7 GET customer inconnu → 404', r.status === 404, J(r.json));
  r = await req('GET', '/api/customers/abc', { token: a1 });
  check('B8 GET customer id="abc" → 404 (pas de crash)', r.status === 404, J(r.json));
  r = await req('PUT', `/api/customers/${edgeCustId}`, { token: a1, body: { status: 'bogus' } });
  check('B9 PUT statut invalide → 400 attendu / observé ' + r.status, r.status === 400, J(r.text));
  if (r.status !== 400) {
    defect('Majeur', 'Statut client non validé: valeur hors enum → erreur 500 interne (CHECK SQLite non gérée)', 'PUT /api/customers/:id',
      `PUT /api/customers/${edgeCustId} avec body { status: "bogus" }`,
      '400 — statut invalide rejeté proprement (valeurs: actif/installé/en attente/inactif)',
      `${r.status} ${r.text} — la violation de contrainte CHECK remonte jusqu'au handler d'erreur générique ("Erreur interne du serveur.").`);
  }
  r = await req('PUT', `/api/customers/${edgeCustId}`, { token: a1, body: { name: '   ' } });
  const nameAfterPut = (await req('GET', `/api/customers/${edgeCustId}`, { token: a1 })).json?.name;
  check('B10 PUT name espaces → appliqué sans trim?', r.status === 200, `name après: "${nameAfterPut}"`);
  if (nameAfterPut === '   ') {
    defect('Mineur', 'PUT customer ne trime pas le nom (espaces stockés tels quels)', 'PUT /api/customers/:id',
      `PUT /api/customers/${edgeCustId} { name: "   " } puis GET`,
      'name stocké trimmed ("" ou valeur précédente conservée)',
      `200 mais name = "   " (3 espaces) en base.`);
  }
  // Double création identique (pas d'unicité)
  const dup1 = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_Doublon', phone: '099 999 999' } });
  const dup2 = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_Doublon', phone: '099 999 999' } });
  check('B11 doublons identiques → 2 lignes (pas de contrainte d\'unicité)', dup1.status === 201 && dup2.status === 201, `${dup1.json?.id}, ${dup2.json?.id}`);
  note('B11: aucune contrainte d\'unicité sur (name, phone) — volontaire probablement, mais les doublons ne sont jamais signalés ni fusionnés.');
  // Ownership
  r = await req('GET', `/api/customers/${edgeCustId}`, { token: a2t });
  check('B12 agent2 lit client agent1 → 403', r.status === 403, J(r.json));
  r = await req('DELETE', `/api/customers/${edgeCustId}`, { token: a2t });
  check('B13 agent2 supprime client agent1 → 403', r.status === 403, J(r.json));
  // Suppression d'un client AVEC enfants (paiements/échéances)
  const withPay = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_SupAvecPaiement', phone: '' } });
  const withPayId = withPay.json.id;
  await req('POST', '/api/payments', { token: a1, body: { customer_id: withPayId, amount: 100 } });
  r = await req('DELETE', `/api/customers/${withPayId}`, { token: a1 });
  check('B14 DELETE client avec paiement → 409 attendu / observé ' + r.status, r.status === 409, J(r.text));
  if (r.status !== 409) {
    defect('Majeur', 'Suppression d\'un client ayant des paiements → erreur 500 interne (FK SQLite non gérée)', 'DELETE /api/customers/:id',
      `1) POST /api/customers {name:"edge_SupAvecPaiement"}  2) POST /api/payments {customer_id, amount:100}  3) DELETE /api/customers/${withPayId} (token agent1)`,
      '409 "Client référencé, suppression impossible" ou suppression en cascade propre',
      `${r.status} ${r.text} — violation de clé étrangère (payments.customer_id) non capturée → "Erreur interne du serveur."`);
  }
  // client SANS enfants → suppression OK
  const noChild = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_SansEnfant' } });
  r = await req('DELETE', `/api/customers/${noChild.json.id}`, { token: a1 });
  check('B15 DELETE client sans enfant → 200', r.status === 200, J(r.json));

  // ================= PROSPECTS =================
  r = await req('POST', '/api/prospects', { token: a1, body: {} });
  check('C1 prospect {} → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/prospects', { token: a1, body: { name: 'edge_Prospect Conv', phone: '099 111 222', village: 'EdgeVille' } });
  check('C2 prospect valide → 201', r.status === 201, J(r.json));
  const prospId = r.json.id;
  r = await req('POST', `/api/prospects/${prospId}/convert`, { token: a1 });
  check('C3 conversion prospect → 201 + customerId', r.status === 201 && r.json?.customerId, J(r.json));
  const convCustId = r.json.customerId;
  r = await req('POST', `/api/prospects/${prospId}/convert`, { token: a1 });
  check('C4 double conversion → 409', r.status === 409, J(r.json));
  r = await req('POST', '/api/prospects/99999999/convert', { token: a1 });
  check('C5 conversion prospect inconnu → 404', r.status === 404, J(r.json));
  r = await req('POST', `/api/prospects/${prospId}/convert`, { token: a2t });
  check('C6 conversion prospect d\'un autre agent → 403', r.status === 403, J(r.json));
  // statut invalide
  r = await req('PUT', `/api/prospects/${prospId}`, { token: a1, body: { status: 'bogus' } });
  check('C7 PUT prospect statut invalide → 400 attendu / observé ' + r.status, r.status === 400, J(r.text));
  if (r.status !== 400) {
    defect('Majeur', 'Statut prospect non validé → 500 interne (même famille que B9)', 'PUT /api/prospects/:id',
      `PUT /api/prospects/${prospId} { status: "bogus" }`,
      '400 — statut invalide (nouveau/contacté/converti/perdu)',
      `${r.status} ${r.text} — CHECK contrainte non gérée → 500 "Erreur interne du serveur."`);
  }
  // Prospect perdu convertible ? (comportement)
  const lostPros = await req('POST', '/api/prospects', { token: a1, body: { name: 'edge_Prospect Perdu', phone: '' } });
  await req('PUT', `/api/prospects/${lostPros.json.id}`, { token: a1, body: { status: 'perdu' } });
  r = await req('POST', `/api/prospects/${lostPros.json.id}/convert`, { token: a1 });
  check('C8 conversion d\'un prospect "perdu" → 201 (comportement discutable)', r.status === 201, J(r.json));
  if (r.status === 201) note('C8: un prospect marqué "perdu" reste convertible → le statut "perdu" n\'est pas exclusif. À confirmer comme choix métier.');
  r = await req('GET', '/api/prospects?status=bogus', { token: a1 });
  check('C9 filtre statut "bogus" → 200 [] (aucune validation du filtre)', r.status === 200 && Array.isArray(r.json) && r.json.length === 0, J(r.json.length));

  // ================= PRODUITS / ADMIN =================
  r = await req('POST', '/api/admin/products', { token: a1, body: { name: 'edge_x', price: 100 } });
  check('D0 agent crée produit → 403', r.status === 403, J(r.json));
  r = await req('POST', '/api/admin/products', { token: adminTok, body: { name: 'edge_Kit PAYG ' + RUN, price: 100000, commission_rate: 5, payg: 1, nb_installments: 6 } });
  check('D1 création produit PAYG → 201', r.status === 201, J(r.json));
  const paygProdId = r.json.id;
  const paygName = 'edge_Kit PAYG ' + RUN;
  r = await req('POST', '/api/admin/products', { token: adminTok, body: { name: 'edge_Lampe Cash ' + RUN, price: 25000, payg: 0, nb_installments: 1 } });
  const cashProdId = r.json.id;
  check('D2 création produit cash → 201', r.status === 201, J(r.json));
  r = await req('POST', '/api/admin/products', { token: adminTok, body: { name: 'edge_PasDePrix', price: 0 } });
  check('D3 produit price 0 → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/admin/products', { token: adminTok, body: { name: 'edge_Neg', price: 100, payg: 1, nb_installments: -3 } });
  check('D4 nb_installments négatif → 400 attendu / observé ' + r.status, r.status === 400, J(r.json));
  if (r.status === 201) {
    const negProdId = r.json.id;
    const negCust = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_C Neg' } });
    const negIns = await req('POST', '/api/installations', { token: a1, body: { customer_id: negCust.json.id, product_id: negProdId } });
    const negDetail = await req('GET', `/api/customers/${negCust.json.id}`, { token: a1 });
    defect('Mineur', 'nb_installments négatif accepté à la création produit → échéancier vide', 'POST /api/admin/products',
      `Créer un produit { payg:1, nb_installments: -3 } puis installer ce produit`,
      '400 — nb_installments doit être un entier >= 1 pour un produit PAYG',
      `201 à la création ; l'installation (201) ne génère AUCUNE échéance alors que le produit est PAYG (${J(negDetail.json.installments.length)} échéances).`);
  }
  r = await req('POST', '/api/admin/products', { token: adminTok, body: { name: 'edge_CRA', price: 100, commission_rate: 'abc' } });
  check('D5 commission_rate "abc" → 400 attendu / observé ' + r.status, r.status === 400, J(r.text));
  if (r.status === 201) {
    defect('Mineur', 'commission_rate non numérique converti silencieusement en 0', 'POST /api/admin/products',
      `Créer un produit { commission_rate: "abc" }`,
      '400 — commission_rate invalide',
      `201 ; commission_rate en base = 0 (Number("abc")||0), l'erreur est masquée.`);
  }
  r = await req('POST', '/api/admin/products', { token: adminTok, body: { name: '   ', price: 100 } });
  check('D6 nom produit espaces → 201?', r.status === 201, J(r.json));
  if (r.status === 201) defect('Mineur', 'Nom de produit composé d\'espaces accepté (produit sans nom)', 'POST /api/admin/products',
    `POST /api/admin/products { name: "   ", price: 100 }`,
    '400 — nom requis après trim',
    `201 — produit stocké avec name: "".`);

  // ================= STOCK =================
  r = await req('POST', '/api/admin/stock/move', { token: adminTok, body: { product_id: paygProdId, type: 'in', quantity: 2 } });
  check('E1 entrée stock dépôt central → 200', r.status === 200, J(r.json));
  let stRow = await stockByName(paygName, adminTok);
  check('E2 stock visible après entrée (qty=2)', stRow?.quantity === 2, J(stRow));
  r = await req('POST', '/api/admin/stock/move', { token: adminTok, body: { product_id: paygProdId, type: 'out', quantity: 1 } });
  stRow = await stockByName(paygName, adminTok);
  check('E3 sortie 1 sur qty 2 → 200, qty=1', r.status === 200 && stRow?.quantity === 1, `qty=${stRow?.quantity}`);
  r = await req('POST', '/api/admin/stock/move', { token: adminTok, body: { product_id: paygProdId, type: 'out', quantity: 2 } });
  stRow = await stockByName(paygName, adminTok);
  check('E4 sortie 2 sur qty 1 → 400 attendu / observé ' + r.status, r.status === 400, J(r.text));
  if (r.status !== 400) {
    defect('Majeur', 'Sortie de stock supérieure au stock disponible: écrêtée silencieusement (pas de refus)', 'POST /api/admin/stock/move',
      `1) stock/move in qty 2 (dépôt central)  2) stock/move out qty 1 (→ qty 1)  3) stock/move out qty 2 alors que qty=1`,
      '400 "Stock insuffisant" — aucune sortie partielle, l\'opérateur doit être informé',
      `200 {"ok":true} — la quantité demandée (2) est écrêtée : le stock passe de 1 à ${stRow?.quantity ?? '?'} alors que le mouvement tracé n'est que de -1. L'opérateur croit avoir sorti 2 unités, mais seule 1 a été retirée (risque d'inventaire faux).`);
  }
  r = await req('POST', '/api/admin/stock/move', { token: adminTok, body: { product_id: 99999999, type: 'in', quantity: 1 } });
  check('E5 move produit inconnu → 404', r.status === 404, J(r.json));
  r = await req('POST', '/api/admin/stock/move', { token: adminTok, body: { product_id: paygProdId, type: 'fly', quantity: 1 } });
  check('E6 move type inconnu → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/admin/stock/move', { token: adminTok, body: { product_id: paygProdId, type: 'in', quantity: 0 } });
  check('E7 move quantité 0 → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/admin/stock/move', { token: adminTok, body: { product_id: paygProdId, type: 'in', quantity: -4 } });
  check('E8 move quantité négative → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/admin/stock/move', { token: adminTok, body: { product_id: paygProdId, type: 'in', quantity: 'abc' } });
  check('E9 move quantité "abc" (NaN) → 400 attendu / observé ' + r.status, r.status === 400, J(r.text));
  if (r.status !== 400) {
    defect('Majeur', 'Quantité de stock non numérique: le test `qty <= 0` ne détecte pas NaN et laisse passer', 'POST /api/admin/stock/move',
      `POST /api/admin/stock/move { product_id: ${paygProdId}, type: "in", quantity: "abc" }`,
      '400 — quantité invalide',
      `${r.status} ${r.text} — Number("abc")=NaN, "NaN <= 0" est faux, la validation est donc contournée (500 interne ou donnée corrompue).`);
  }
  // re-stocker 1 unité pour le test de décrément d'installation
  await req('POST', '/api/admin/stock/move', { token: adminTok, body: { product_id: paygProdId, type: 'in', quantity: 1 } });
  stRow = await stockByName(paygName, adminTok);
  check('E10 re-stock 1 → qty=1', stRow?.quantity === 1, `qty=${stRow?.quantity}`);

  // ================= INSTALLATIONS (cash + PAYG) =================
  const insCust = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_C Install' } });
  const insCustId = insCust.json.id;
  r = await req('POST', '/api/installations', { token: a1, body: {} });
  check('F1 installation {} → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/installations', { token: a1, body: { customer_id: 99999999, product_id: cashProdId } });
  check('F2 installation client inconnu → 404', r.status === 404, J(r.json));
  r = await req('POST', '/api/installations', { token: a1, body: { customer_id: insCustId, product_id: 99999999 } });
  check('F3 installation produit inconnu → 404', r.status === 404, J(r.json));
  r = await req('POST', '/api/installations', { token: a1, body: { customer_id: insCustId, product_id: cashProdId, install_date: 'pas-une-date' } });
  check('F4 installation avec install_date invalide → 201?', r.status === 201, J(r.json));
  if (r.status === 201) {
    const d = await req('GET', `/api/installations/${r.json.id}`, { token: a1 });
    defect('Mineur', 'install_date arbitraire acceptée ("pas-une-date" stocké)', 'POST /api/installations',
      `POST /api/installations { install_date: "pas-une-date" }`,
      '400 — date invalide ou format YYYY-MM-DD',
      `201 ; GET /api/installations/${r.json.id} → install_date: "pas-une-date" (aucune validation).`);
  }
  // - - - PAYG : échéancier - - -
  const paygCust = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_C PAYG' } });
  const paygCustId = paygCust.json.id;
  r = await req('POST', '/api/installations', { token: a1, body: { customer_id: paygCustId, product_id: paygProdId } });
  check('F5 installation PAYG → 201', r.status === 201, J(r.json));
  const paygInstallId = r.json.id;
  stRow = await stockByName(paygName, adminTok);
  check('F12a PAYG: stock décrémenté de 1 (1 → 0)', stRow?.quantity === 0, `qty=${stRow?.quantity}`);
  // remettre 1 unité pour le test de paiement (les installations suivantes du même produit l'utiliseront)
  await req('POST', '/api/admin/stock/move', { token: adminTok, body: { product_id: paygProdId, type: 'in', quantity: 1 } });
  const paygdetail = await req('GET', `/api/customers/${paygCustId}`, { token: a1 });
  const insts = paygdetail.json.installments;
  const price = 100000, nb = 6;
  const perInstall = Math.round((price / nb) * 100) / 100;
  const firstExpected = Math.round((price - perInstall * (nb - 1)) * 100) / 100;
  const sum = insts.reduce((a, i) => a + i.amount, 0);
  const datesOk = insts.every((i, k) => k === 0 || insts[k - 1].due_date <= i.due_date);
  check('F6 PAYG: nb échéances = 6', insts.length === nb, `got ${insts.length}`);
  check('F7 PAYG: somme des échéances = prix', Math.abs(sum - price) < 0.01, `sum=${sum} price=${price}`);
  check('F8 PAYG: 1re échéance = acompte calculé', Math.abs(insts[0].amount - firstExpected) < 0.01, `first=${insts[0].amount} expected=${firstExpected}`);
  check('F9 PAYG: échéances suivantes identiques', new Set(insts.slice(1).map((i) => i.amount)).size === 1, J(insts.slice(1).map((i) => i.amount)));
  check('F10 PAYG: dates croissantes', datesOk, J(insts.map((i) => i.due_date)));
  check('F11 PAYG: 1re échéance = aujourd\'hui', insts[0]?.due_date === new Date().toISOString().slice(0, 10), insts[0]?.due_date);
  // - - - Installation sans STOCK du tout - - -
  const zeroStockCust = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_C ZeroStock' } });
  r = await req('POST', '/api/installations', { token: a1, body: { customer_id: zeroStockCust.json.id, product_id: cashProdId } });
  check('F13 installation produit sans stock → 201 attendu? / observé ' + r.status, r.status === 201, J(r.json));
  if (r.status === 201) {
    defect('Majeur', 'Installation enregistrée même avec stock nul — vente sans stock possible (aucune alerte ni blocage)', 'POST /api/installations',
      `1) créer un produit (edge_Lampe Cash) sans aucune ligne stock_items  2) POST /api/installations {customer_id, product_id}`,
      '400/409 "Stock insuffisant" ou au minimum une alerte stock (le front indique-t-il l\'indisponibilité ?)',
      `201 {id:${r.json.id}} — l'installation est validée et le client passe au statut "installé" sans qu'aucune unité ne soit retirée du stock. Risque de survente et d'engagement sans marchandise.`);
  }
  // - - - Statut installation invalide - - -
  const badStatusCust = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_C BadStatus' } });
  r = await req('POST', '/api/installations', { token: a1, body: { customer_id: badStatusCust.json.id, product_id: cashProdId, status: 'bogus' } });
  check('F14 installation status invalide → 400 attendu / observé ' + r.status, r.status === 400, J(r.text));
  if (r.status !== 400) {
    defect('Majeur', 'Statut d\'installation non validé → 500 interne (CHECK non gérée)', 'POST /api/installations',
      `POST /api/installations { status: "bogus" }`,
      '400 — statut invalide (planifiée/installé)',
      `${r.status} ${r.text} — 500 "Erreur interne du serveur."`);
  }
  // - - - Ownership sur installation - - -
  r = await req('POST', '/api/installations', { token: a2t, body: { customer_id: paygCustId, product_id: cashProdId } });
  check('F15 agent2 installe client d\'agent1 → 403', r.status === 403, J(r.json));

  // ================= PAIEMENTS =================
  const payCust = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_C Paiements' } });
  const payCustId = payCust.json.id;
  const payInst = await req('POST', '/api/installations', { token: a1, body: { customer_id: payCustId, product_id: paygProdId } });
  const payInstId = payInst.json.id;
  const payDetail = await req('GET', `/api/customers/${payCustId}`, { token: a1 });
  const installments = payDetail.json.installments;
  const firstInst = installments[0]; // acompte
  const secondInst = installments[1];
  const instAmount = firstInst.amount;
  check('G0 setup paiements: 6 échéances', installments.length === 6, J(installments.map(i => i.amount)));

  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: 0 } });
  check('G1 paiement 0 → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: -50 } });
  check('G2 paiement négatif → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: 'abc' } });
  check('G3 paiement "abc" → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId } });
  check('G4 paiement sans montant → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/payments', { token: a1, body: { amount: 100 } });
  check('G5 paiement sans customer → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: 99999999, amount: 100 } });
  check('G6 paiement client inconnu → 404', r.status === 404, J(r.json));
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: '0x10' } });
  check('G7 paiement "0x10" → 201? (Number permissif)', r.status === 201, J(r.json));
  if (r.status === 201) note('G7: Number("0x10") = 16 accepté — les montants hexadécimaux/châînes numériques passent (coercition permissive).');
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: 1e308 } });
  check('G8 paiement 1e308 → 201? (aucune limite haute)', r.status === 201, J(r.json));
  if (r.status === 201) defect('Mineur', 'Aucune limite haute ni cohérence sur le montant de paiement (1e308 accepté)', 'POST /api/payments',
    `POST /api/payments { customer_id: ${payCustId}, amount: 1e308 }`,
    '400 — montant aberrant (limite ou cohérence avec le solde client)',
    `201 — un paiement de 1e308 F est enregistré ; le tableau de bord totalPaid devient astronomique.`);
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: 0.001 } });
  check('G9 paiement 0.001 → 201? (décimales excessives)', r.status === 201, J(r.json));
  if (r.status === 201) defect('Mineur', 'Montants fractionnaires acceptés (0.001 F) — granularité monétaire non contrôlée', 'POST /api/payments',
    `POST /api/payments { customer_id: ${payCustId}, amount: 0.001 }`,
    '400 ou arrondi au centime/franc',
    `201 — montant de 0.001 stocké en REAL.`);
  // Paiement partiel vs total sur échéance
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: instAmount - 1, installment_id: firstInst.id } });
  const stPartial = (await req('GET', `/api/customers/${payCustId}`, { token: a1 })).json.installments.find(i => i.id === firstInst.id);
  check('G10 paiement partiel sur échéance → reste pending', r.status === 201 && stPartial.status === 'pending', `status=${stPartial?.status}`);
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: instAmount, installment_id: firstInst.id } });
  const stFull = (await req('GET', `/api/customers/${payCustId}`, { token: a1 })).json.installments.find(i => i.id === firstInst.id);
  check('G11 paiement total sur échéance → paid + paid_date', r.status === 201 && stFull.status === 'paid' && !!stFull.paid_date, J(stFull));
  // Paiement sur échéance déjà payée
  const paidBefore = (await req('GET', `/api/payments?customer_id=${payCustId}`, { token: a1 })).json.length;
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: instAmount, installment_id: firstInst.id } });
  const paidAfter = (await req('GET', `/api/payments?customer_id=${payCustId}`, { token: a1 })).json.length;
  check('G12 paiement sur échéance déjà soldée → 201 (accepté, aucun contrôle)', r.status === 201 && paidAfter === paidBefore + 1, `paiements: ${paidBefore} → ${paidAfter}`);
  note('G12: un paiement rattaché à une échéance déjà "paid" est accepté sans avertissement. Il reste comptablement tracé, mais aucune alerte "déjà soldée" côté client serveur.');
  // Références hors périmètre
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: 100, installment_id: 99999999 } });
  check('G13 échéance inconnue → 404', r.status === 404, J(r.json));
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: 100, installation_id: 99999999 } });
  check('G14 installation inconnue → 404', r.status === 404, J(r.json));
  const otherCust = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_C Autre' } });
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: otherCust.json.id, amount: 100, installment_id: secondInst.id } });
  check('G15 échéance d\'un autre client → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/payments', { token: a2t, body: { customer_id: payCustId, amount: 100 } });
  check('G16 agent2 paie pour client agent1 → 403', r.status === 403, J(r.json));
  // Méthode invalide
  r = await req('POST', '/api/payments', { token: a1, body: { customer_id: payCustId, amount: 100, method: 'cheque' } });
  check('G17 method "cheque" → 400 attendu / observé ' + r.status, r.status === 400, J(r.text));
  if (r.status !== 400) {
    defect('Majeur', 'Méthode de paiement non validée → 500 interne (CHECK non gérée)', 'POST /api/payments',
      `POST /api/payments { customer_id: ${payCustId}, amount: 100, method: "cheque" }`,
      '400 — méthode invalide (cash/mobile_money/bank/card)',
      `${r.status} ${r.text} — 500 "Erreur interne du serveur."`);
  }

  // ================= SYNC (hors-ligne) =================
  const c1 = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_Count Sync' } });
  check('SYNC setup', c1.status === 201);
  const countCustomers = async () => { const d = await req('GET', '/api/dashboard', { token: a1 }); return d.json.stats.customers; };
  const beforeN = await countCustomers();

  // idempotence même uuid sur deux envois séparés
  const opCreate = { uuid: UU('cust-001'), op: 'create_customer', payload: { name: 'edge_Sync Client 1', phone: '099 100 200', village: 'EdgeVille' } };
  r = await req('POST', '/api/sync', { token: a1, body: { operations: [opCreate] } });
  check('S1 sync create_customer → done', r.json?.results?.[0]?.status === 'done', J(r.json));
  r = await req('POST', '/api/sync', { token: a1, body: { operations: [opCreate] } });
  check('S2 même uuid renvoyé → duplicate (idempotence)', r.json?.results?.[0]?.duplicate === true, J(r.json));
  const afterN1 = await countCustomers();
  check('S3 un seul client créé malgré 2 envois', afterN1 === beforeN + 1, `${beforeN} → ${afterN1}`);

  // même uuid dans le même batch (uuid frais, jamais envoyé)
  const opBatch = { uuid: UU('batch-002'), op: 'create_customer', payload: { name: 'edge_Sync Batch 2', phone: '' } };
  r = await req('POST', '/api/sync', { token: a1, body: { operations: [opBatch, opBatch] } });
  const sts = r.json?.results?.map(x => `${x.uuid}:${x.status}${x.duplicate ? ':dup' : ''}`).join(' | ');
  check('S4 même uuid 2× dans un batch → 1 done + 1 duplicate', r.json?.results?.length === 2 && !r.json?.results?.[0]?.duplicate && r.json?.results?.[1]?.duplicate === true, sts);
  const afterN2 = await countCustomers();
  check('S5 un seul client créé pour les 2 entrées du batch', afterN2 === beforeN + 2, `${beforeN} → ${afterN2}`);

  // opération inconnue
  r = await req('POST', '/api/sync', { token: a1, body: { operations: [{ uuid: UU('unknown'), op: 'fly_to_moon', payload: {} }] } });
  check('S6 op inconnue → status error (HTTP ' + r.status + ')', r.status === 200 && r.json?.results?.[0]?.status === 'error' && /inconnue/.test(r.json.results[0].error), J(r.json));
  note('S6: les erreurs d\'opérations sync sont renvoyées en HTTP 200 avec status:"error" par opération — un client qui ne lit que le code HTTP ne détectera pas l\'échec.');
  // update enregistrement inexistant
  r = await req('POST', '/api/sync', { token: a1, body: { operations: [{ uuid: UU('upd-001'), op: 'update_customer', payload: { id: 99999999, name: 'X' } }] } });
  check('S7 update_customer inexistant → error propre', r.json?.results?.[0]?.status === 'error' && /introuvable/.test(r.json.results[0].error), J(r.json));
  // create_customer invalide puis retry même uuid
  const opBad = { uuid: UU('bad-001'), op: 'create_customer', payload: { name: '' } };
  r = await req('POST', '/api/sync', { token: a1, body: { operations: [opBad] } });
  check('S8 create_customer name vide → error "name requis"', r.json?.results?.[0]?.status === 'error', J(r.json));
  r = await req('POST', '/api/sync', { token: a1, body: { operations: [opBad] } });
  check('S9 retry même uuid après échec → duplicate (jamais appliqué) — défaut de reprise', r.json?.results?.[0]?.duplicate === true, J(r.json));
  if (r.json?.results?.[0]?.duplicate === true) {
    defect('Majeur', 'Sync: une opération en erreur ne peut JAMAIS être retentée avec le même uuid (bloquée "duplicate")', 'POST /api/sync',
      `1) envoi {uuid:${UU('bad-001')}, op:"create_customer", payload:{name:""}} → error  2) re-envoi du même uuid avec payload corrigé`,
      'Le serveur doit soit retenter l\'opération, soit signaler l\'état "error" pour reprise ; un client hors-ligne corrigerait le payload et renverrait le même uuid',
      `2e envoi → {status:"duplicate"} — l'opération reste à jamais inappliquée. Si le client régénère un uuid à la place, il risque la double application.`);
  }
  // update client d'un autre agent
  r = await req('POST', '/api/sync', { token: a2t, body: { operations: [{ uuid: UU('oth-001'), op: 'update_customer', payload: { id: payCustId, name: 'Hack' } }] } });
  check('S10 update_customer d\'un autre agent → error accès refusé', r.json?.results?.[0]?.status === 'error' && /refus/i.test(r.json.results[0].error), J(r.json));
  const nameAfter = (await req('GET', `/api/customers/${payCustId}`, { token: a1 })).json.name;
  check('S11 le nom n\'a pas changé', nameAfter === 'edge_C Paiements', nameAfter);
  // operations pas un tableau
  r = await req('POST', '/api/sync', { token: a1, body: { operations: { fake: true } } });
  check('S12 operations non-tableau → 200 {results:[]}', r.status === 200 && Array.isArray(r.json?.results), J(r.json));
  // record_payment hors-ligne idempotent
  const payOp = { uuid: UU('pay-001'), op: 'record_payment', payload: { customer_id: payCustId, installment_id: secondInst.id, amount: secondInst.amount } };
  r = await req('POST', '/api/sync', { token: a1, body: { operations: [payOp] } });
  check('S13 sync record_payment → done', r.json?.results?.[0]?.status === 'done', J(r.json));
  r = await req('POST', '/api/sync', { token: a1, body: { operations: [payOp] } });
  check('S14 record_payment même uuid → duplicate', r.json?.results?.[0]?.duplicate === true, J(r.json));
  const secondSt = (await req('GET', `/api/customers/${payCustId}`, { token: a1 })).json.installments.find(i => i.id === secondInst.id);
  check('S15 échéance soldée une seule fois', secondSt?.status === 'paid' && secondSt?.paid_date !== '', J(secondSt));
  // payload null
  r = await req('POST', '/api/sync', { token: a1, body: { operations: [{ uuid: UU('null-001'), op: 'create_customer' }] } });
  check('S16 opération sans payload → error (name requis)', r.json?.results?.[0]?.status === 'error', J(r.json));
  // pending visible
  r = await req('GET', '/api/sync/pending', { token: a1 });
  check('S17 GET /api/sync/pending → liste', r.status === 200 && Array.isArray(r.json), `${r.json?.length} opérations`);

  // ================= CONCURRENCE =================
  // 2 sync identiques simultanés (même uuid) → 1 seul client
  const beforeC = await countCustomers();
  const cc = await Promise.all([
    req('POST', '/api/sync', { token: a1, body: { operations: [{ uuid: UU('race-1'), op: 'create_customer', payload: { name: 'edge_Race Sync', phone: '' } }] } }),
    req('POST', '/api/sync', { token: a1, body: { operations: [{ uuid: UU('race-1'), op: 'create_customer', payload: { name: 'edge_Race Sync', phone: '' } }] } }),
  ]);
  const statuses = cc.map(c => `${c.status}:${c.json?.results?.[0]?.status}${c.json?.results?.[0]?.duplicate ? ':dup' : ''}`).join(' vs ');
  const afterC = await countCustomers();
  check('CONC1 2 sync simultanés même uuid → 1 seul client créé', afterC === beforeC + 1, `${statuses} — clients ${beforeC} → ${afterC}`);
  // 2 installations simultanées sur 1 seule unité en stock → survente
  const raceProd = await req('POST', '/api/admin/products', { token: adminTok, body: { name: 'edge_Race Prod ' + RUN, price: 5000, payg: 0, nb_installments: 1 } });
  const raceProdId = raceProd.json.id;
  const raceIn = await req('POST', '/api/admin/stock/move', { token: adminTok, body: { product_id: raceProdId, type: 'in', quantity: 1 } });
  check('CONC2 setup stock in 1 → 200', raceIn.status === 200, J(raceIn.json));
  let raceRow = await stockByName('edge_Race Prod ' + RUN, adminTok);
  check('CONC2a stock initial = 1', raceRow?.quantity === 1, `qty=${raceRow?.quantity}`);
  const raceC1 = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_Race C1' } });
  const raceC2 = await req('POST', '/api/customers', { token: a1, body: { name: 'edge_Race C2' } });
  const inss = await Promise.all([
    req('POST', '/api/installations', { token: a1, body: { customer_id: raceC1.json.id, product_id: raceProdId } }),
    req('POST', '/api/installations', { token: a1, body: { customer_id: raceC2.json.id, product_id: raceProdId } }),
  ]);
  check('CONC2b 2 installations simultanées → 2×201 (survente)', inss.every(i => i.status === 201), J(inss.map(i => i.status)));
  raceRow = await stockByName('edge_Race Prod ' + RUN, adminTok);
  check('CONC2c stock final = 0 alors que 2 installations validées', raceRow?.quantity === 0, `qty=${raceRow?.quantity}`);
  if (inss.every(i => i.status === 201) && raceRow?.quantity === 0) {
    defect('Majeur', 'Survente possible: deux installations simultanées validées pour une seule unité en stock (décrément non bloquant)', 'POST /api/installations',
      `1) création produit edge_Race Prod + stock in qty 1  2) 2× POST /api/installations simultanés (Promise.all) par le même agent`,
      'Au plus UNE installation doit aboutir (ou la seconde doit refuser/alerter stock insuffisant)',
      `2× HTTP 201 ; stock final = 0 (jamais négatif, mais une installation n'a pas décrémenté). Concrètement: 2 clients "installés" pour 1 unité disponible — engagement sans marchandise.`);
  }
  // 2 POST customers identiques simultanés → 2 lignes (attendu: pas d'unicité)
  const cc2 = await Promise.all([
    req('POST', '/api/customers', { token: a1, body: { name: 'edge_Race Cust', phone: '099 123 456' } }),
    req('POST', '/api/customers', { token: a1, body: { name: 'edge_Race Cust', phone: '099 123 456' } }),
  ]);
  check('CONC3 2 POST customers identiques → 2 lignes distinctes (comportement attendu, pas d\'unicité)', cc2.every(c => c.status === 201) && cc2[0].json.id !== cc2[1].json.id, J(cc2.map(c => c.json)));

  // ================= EXPORTS CSV / DIVERS =================
  r = await req('GET', '/api/reports/export/customers', { token: a1 });
  check('H1 export CSV clients (agent) → 200 CSV', r.status === 200 && /text\/csv/.test(r.headers['content-type'] || ''), `${r.text.slice(0, 40).replace(/\n/g, ' ')}`);
  const agentCsv = await req('GET', '/api/reports/export/customers', { token: a1, maxText: Infinity });
  const hasForeign = agentCsv.fullText.includes('Joseph Kazadi') || agentCsv.fullText.includes('Patrick Musasa');
  check('H2 export agent ne contient PAS les clients des autres agents', !hasForeign, hasForeign ? 'contient les clients d\'autres agents!' : 'OK');
  r = await req('GET', '/api/reports/export/bogus', { token: a1 });
  check('H3 export type inconnu → 404', r.status === 404, J(r.json));
  // Injection de formule CSV neutralisée
  await req('POST', '/api/customers', { token: a1, body: { name: '=HYPERLINK("http://evil")', phone: '099 000 000' } });
  const injCsv = await req('GET', '/api/reports/export/customers', { token: a1, maxText: Infinity });
  const evilRow = injCsv.fullText.split('\n').find(l => l.includes('HYPERLINK'));
  check('H4 nom commençant par "=" → préfixé par apostrophe dans le CSV', !!evilRow && /'=HYPERLINK/.test(evilRow), evilRow || 'ligne non trouvée');
  if (!evilRow || !/'=HYPERLINK/.test(evilRow)) {
    defect('Mineur', 'Injection de formule CSV non neutralisée pour un nom commençant par "="', 'GET /api/reports/export/customers',
      'Créer un client nommé "=HYPERLINK(...)" puis exporter les clients',
      'Le champ doit être préfixé d\'une apostrophe (csvEscape) pour éviter l\'exécution dans Excel',
      `Ligne exportée: ${evilRow ? evilRow.slice(0, 120) : 'introuvable'} — vérifier le contenu réel.`);
  }
  r = await req('GET', '/api/reports/summary', { token: a1 });
  check('H5 summary réservé admin → 403', r.status === 403, J(r.json));
  r = await req('GET', '/api/admin/overview', { token: a1 });
  check('H6 overview réservé admin → 403', r.status === 403, J(r.json));
  r = await req('POST', '/api/admin/commissions/pay', { token: adminTok, body: { ids: [] } });
  check('H7 commissions/pay ids vides → 400', r.status === 400, J(r.json));
  r = await req('POST', '/api/admin/commissions/pay', { token: adminTok, body: { ids: [99999999] } });
  check('H8 commissions/pay ids inconnus → 200 silencieux', r.status === 200, J(r.json));
  if (r.status === 200) note('H8: payer des commissions avec des ids inexistants répond ok:true sans erreur — silencieux.');
  r = await req('GET', '/api/dashboard', { token: a1 });
  check('H9 dashboard agent → 200', r.status === 200 && !!r.json?.stats, J(r.stats));

  // ================= Résumé =================
  const failed = results.filter(x => !x.ok);
  console.log(`\n=== RÉSUMÉ ===`);
  console.log(`Checks: ${results.length}  —  PASS: ${results.length - failed.length}  —  FAIL (comportements inattendus): ${failed.length}`);
  const sevCount = { Bloquant: 0, Majeur: 0, Mineur: 0 };
  for (const d of defects) sevCount[d.sev]++;
  console.log(`Défauts: ${defects.length}  (Bloquant: ${sevCount.Bloquant}, Majeur: ${sevCount.Majeur}, Mineur: ${sevCount.Mineur})`);
  console.log(`Durée: ${((Date.now() - started) / 1000).toFixed(1)}s`);

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify({ results, defects, notes, sevCount }, null, 2));
  console.log(`Résultats JSON: ${OUT_JSON}`);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });