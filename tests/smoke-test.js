// tests/smoke-test.js — Test de bout en bout de l'API TAKATA
// Usage : node tests/smoke-test.js [baseUrl]
const BASE = process.argv[2] || 'http://localhost:8080';
let passed = 0, failed = 0;
const errors = [];

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), token].join('');
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data, raw: res };
}

function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✅', name); }
  else { failed++; const msg = `❌ ${name}${detail ? ' — ' + detail : ''}`; errors.push(msg); console.log(msg); }
}

(async () => {
  console.log('🧪 TAKATA smoke test —', BASE, '\n');

  // 1. Santé
  const health = await call('GET', '/api/health');
  check('Santé publique', health.status === 200 && health.data.app === 'TAKATA');

  // 2. Connexion admin
  const bad = await call('POST', '/api/auth/login', { username: 'admin', password: 'mauvais' });
  check('Mauvais mot de passe rejeté (401)', bad.status === 401, `status=${bad.status}`);
  const adminLogin = await call('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  check('Connexion admin (admin/admin123 → admingen)', adminLogin.status === 200 && adminLogin.data.token && ['admin', 'admingen'].includes(adminLogin.data.user.role), `status=${adminLogin.status} role=${adminLogin.data.user && adminLogin.data.user.role}`);
  const adminToken = adminLogin.data.token;

  // 3. Admin crée un agent
  const uniq = 'agent_test_' + Date.now().toString().slice(-6);
  const createAgent = await call('POST', '/api/admin/agents', { username: uniq, password: 'test1234', full_name: 'Agent Test', phone: '+243000', region: 'Lubumbashi' }, adminToken);
  check('Admin crée un agent', createAgent.status === 201, `status=${createAgent.status}`);
  const agentId = createAgent.data.id;
  const dupAgent = await call('POST', '/api/admin/agents', { username: uniq, password: 'test1234', full_name: 'Dup' }, adminToken);
  check('Doublon username rejeté (409)', dupAgent.status === 409, `status=${dupAgent.status}`);

  // 4. Connexion agent
  const agentLogin = await call('POST', '/api/auth/login', { username: uniq, password: 'test1234' });
  check('Connexion agent créé', agentLogin.status === 200 && agentLogin.data.user.role === 'agent', `status=${agentLogin.status}`);
  const agentToken = agentLogin.data.token;

  // 5. Agent interdit d'accès admin
  const forbidden = await call('GET', '/api/admin/agents', null, agentToken);
  check('Agent bloqué sur /admin (403)', forbidden.status === 403, `status=${forbidden.status}`);

  // 6. Tableau de bord agent
  const dash = await call('GET', '/api/dashboard', null, agentToken);
  check('Dashboard agent', dash.status === 200 && dash.data.stats && typeof dash.data.stats.customers === 'number', `status=${dash.status}`);

  // 7. Ajout client
  const cust = await call('POST', '/api/customers', { name: 'Maman Test', phone: '099 111 2233', village: 'Kampemba' }, agentToken);
  check('Ajout client', cust.status === 201, `status=${cust.status}`);
  const custId = cust.data.id;
  const customers = await call('GET', '/api/customers', null, agentToken);
  check('Liste clients contient le nouveau', customers.data.some((c) => c.id === custId));

  // 8. Ajout prospect + conversion
  const prosp = await call('POST', '/api/prospects', { name: 'Prospect Test', phone: '099 222 3344', village: 'Kenya', interest: 'Kit 120W' }, agentToken);
  check('Ajout prospect', prosp.status === 201, `status=${prosp.status}`);
  const conv = await call('POST', `/api/prospects/${prosp.data.id}/convert`, null, agentToken);
  check('Conversion prospect → client', conv.status === 201 && conv.data.customerId, `status=${conv.status}`);

  // 8b. Pré-flight stock (auto-réparation) : les formules de collecte exigent du
  // stock. Sur une base « propre » (npm run seed), on dote le stock central
  // direction pour que la suite smoke soit autosuffisante.
  const stockAdmin = await call('GET', '/api/admin/stock', null, adminToken);
  const stockNeed = { 1: 50, 2: 50 };
  for (const [pid, minQty] of Object.entries(stockNeed)) {
    const central = (stockAdmin.data || []).find((s) => String(s.product_id) === String(pid) && (s.agent_id === null || s.agent_id === undefined));
    if (!central || central.quantity < minQty) {
      await call('POST', '/api/admin/stock/set', { product_id: Number(pid), agent_id: null, quantity: minQty, note: 'Pré-flight smoke' }, adminToken);
    }
  }

  // 9. Installation (produit 1 : Abonnement Standard, 12 échéances)
  const install = await call('POST', '/api/installations', { customer_id: custId, product_id: 1, serial: 'TEST-001', notes: 'Test' }, agentToken);
  check('Enregistrement installation', install.status === 201, `status=${install.status} ${JSON.stringify(install.data)}`);
  const installId = install.status === 201 ? install.data.id : null;
  if (installId) {
    const instDetail = await call('GET', `/api/installations/${installId}`, null, agentToken);
    check('Détail installation (échéancier)', instDetail.status === 200 && Array.isArray(instDetail.data.installments), `status=${instDetail.status}`);
  } else {
    check('Détail installation (échéancier)', false, 'installation préalable échouée (voir échec ci-dessus)');
  }

  // 10. Paiement
  const pay = await call('POST', '/api/payments', { customer_id: custId, amount: 50000, method: 'cash', ref: 'REC-TEST-1' }, agentToken);
  check('Enregistrement paiement', pay.status === 201, `status=${pay.status} ${JSON.stringify(pay.data)}`);
  const payments = await call('GET', '/api/payments', null, agentToken);
  check('Liste paiements', payments.status === 200 && payments.data.some((p) => p.customer === 'Maman Test'));

  // 11. Installations PAYG (produit 2 : Abonnement Premium, 12 échéances)
  const payg = await call('POST', '/api/installations', { customer_id: custId, product_id: 2, serial: 'TEST-PAYG-1' }, agentToken);
  check('Installation PAYG', payg.status === 201, `status=${payg.status}`);
  let insts = null;
  if (payg.status === 201) {
    insts = await call('GET', '/api/installments?status=pending', null, agentToken);
    check('Échéances PAYG générées', insts.status === 200 && insts.data.filter((i) => i.customer_id === custId).length >= 6, `count=${(insts.data || []).length}`);
  } else {
    check('Échéances PAYG générées', false, 'installation PAYG échouée (voir échec ci-dessus)');
  }

  // 12. Relance
  const due = insts && insts.data ? insts.data.find((i) => i.customer_id === custId) : null;
  if (due) {
    const remind = await call('POST', `/api/installments/${due.id}/remind`, null, agentToken);
    check('Relance échéance', remind.status === 200, `status=${remind.status}`);
  } else {
    check('Relance échéance', false, 'aucune échéance en attente pour le client de test');
  }

  // 13. Commissions
  const comms = await call('GET', '/api/commissions', null, agentToken);
  check('Commissions agent (non vides)', comms.status === 200 && comms.data.totals && comms.data.rows.length > 0, `status=${comms.status}`);

  // 14. Notifications
  const notifs = await call('GET', '/api/notifications', null, agentToken);
  check('Notifications reçues', notifs.status === 200 && notifs.data.unread >= 0);

  // 15. Stock
  const stock = await call('GET', '/api/stock', null, agentToken);
  check('Stock agent', stock.status === 200 && Array.isArray(stock.data), `status=${stock.status}`);

  // 16. Admin : overview + rapport
  const overview = await call('GET', '/api/admin/overview', null, adminToken);
  check('Overview admin', overview.status === 200 && overview.data.customers >= 1);
  const summary = await call('GET', '/api/reports/summary', null, adminToken);
  check('Rapport synthèse admin', summary.status === 200 && summary.data.payments && summary.data.byAgent.length >= 1, `status=${summary.status}`);

  // 17. Export CSV (admin + agent scoping)
  const csvAdmin = await call('GET', '/api/reports/export/customers', null, adminToken);
  check('Export CSV clients (admin)', csvAdmin.status === 200 && (csvAdmin.raw.headers.get('content-type') || '').includes('text/csv'));
  const csvAgent = await fetch(BASE + '/api/reports/export/customers', { headers: { 'Authorization': [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), agentToken].join('') } });
  check('Export CSV refusé aux agents (403, réservé supervision)', csvAgent.status === 403, `status=${csvAgent.status}`);
  const csvBadType = await call('GET', '/api/reports/export/inconnu', null, adminToken);
  check('Export type inconnu → 404', csvBadType.status === 404);

  // 18. Synchronisation hors-ligne (idempotence intra-requête)
  const syncUuid = 'sync-test-' + Date.now();
  const syncOps = [
    { uuid: syncUuid, op: 'create_customer', payload: { name: 'Client Hors-Ligne', phone: '000', village: 'V' } },
    { uuid: syncUuid, op: 'create_customer', payload: { name: 'Client Hors-Ligne', phone: '000', village: 'V' } }
  ];
  const syncRes = await call('POST', '/api/sync', { operations: syncOps }, agentToken);
  const doneCount = syncRes.data.results.filter((r) => r.status === 'done').length;
  check('Sync hors-ligne acceptée (2 envois)', syncRes.status === 200 && doneCount === 2, `done=${doneCount}`);
  const dupCustomers = await call('GET', '/api/customers?search=Hors-Ligne', null, agentToken);
  const horsLigneCount = (dupCustomers.data || []).filter((c) => c.name === 'Client Hors-Ligne').length;
  check('Sync idempotente (client créé UNE seule fois)', horsLigneCount === 1, `count=${horsLigneCount}`);

  // 18b. SECURITE — IDOR en écriture bloqué (agent2 ne peut pas encaisser chez agent1)
  const agent1Login = await call('POST', '/api/auth/login', { username: 'agent1', password: 'agent123' });
  const agent2Login = await call('POST', '/api/auth/login', { username: 'agent2', password: 'agent123' });
  const token1 = agent1Login.data.token;
  const token2 = agent2Login.data.token;
  const c1 = await call('GET', '/api/customers', null, token1);
  const agent1Customer = c1.data.find((x) => x.agent === 'Merveille Kabeya') || c1.data[0];
  const idorPay = await call('POST', '/api/payments', { customer_id: agent1Customer.id, amount: 500 }, token2);
  check('IDOR paiement bloqué (403)', idorPay.status === 403, `status=${idorPay.status}`);
  const idorInstall = await call('POST', '/api/installations', { customer_id: agent1Customer.id, product_id: 1 }, token2);
  check('IDOR installation bloqué (403)', idorInstall.status === 403, `status=${idorInstall.status}`);
  const idorSync = await call('POST', '/api/sync', { operations: [{ uuid: 'sec-sync-' + Date.now(), op: 'record_payment', payload: { customer_id: agent1Customer.id, amount: 50 } }] }, token2);
  const syncErr = (idorSync.data.results || [])[0];
  check('IDOR synchronisation bloqué (error)', idorSync.status === 200 && syncErr && syncErr.status === 'error', `result=${JSON.stringify(syncErr)}`);
  const pending2 = await call('GET', '/api/sync/pending', null, token2);
  const otherAgentOps = (pending2.data || []).filter((o) => o.agent_id && o.agent_id !== agent2Login.data.user.id && o.agent_id !== agentId);
  check('Pending sync restreint à l\'agent', otherAgentOps.length === 0, `cross-agent=${otherAgentOps.length}`);
  const queryToken = await call('GET', '/api/dashboard?token=' + token1);
  check('Token en query string refusé (401)', queryToken.status === 401, `status=${queryToken.status}`);

  // 18c. Édition hors-ligne (PUT) rejouable via /sync
  const upd = await call('POST', '/api/sync', { operations: [{ uuid: 'sec-upd-' + Date.now(), op: 'update_customer', payload: { id: agent1Customer.id, name: agent1Customer.name + ' modif' } }] }, token1);
  const updRes = (upd.data.results || [])[0];
  check('Update client via sync (done)', upd.status === 200 && updRes && updRes.status === 'done', `result=${JSON.stringify(updRes)}`);
  const updVerify = await call('GET', '/api/customers/' + agent1Customer.id, null, token1);
  check('Update client appliqué', updVerify.status === 200 && updVerify.data.name.includes('modif'), `name=${updVerify.data.name}`);
  // Restaure le nom pour ne pas polluer la démo
  await call('POST', '/api/sync', { operations: [{ uuid: 'sec-upd2-' + Date.now(), op: 'update_customer', payload: { id: agent1Customer.id, name: agent1Customer.name } }] }, token1);

  // 19. Changement de mot de passe
  const chg = await call('POST', '/api/auth/change-password', { current: 'test1234', next: 'nouveau123' }, agentToken);
  check('Changement mot de passe', chg.status === 200, `status=${chg.status}`);
  const afterChg = await call('GET', '/api/dashboard', null, agentToken);
  check('Sessions révoquées après changement de mdp (401)', afterChg.status === 401, `status=${afterChg.status}`);
  const relogin = await call('POST', '/api/auth/login', { username: uniq, password: 'nouveau123' });
  check('Reconnexion nouveau mot de passe', relogin.status === 200);

  // 20. PWA : manifest, SW, icônes
  const manifest = await call('GET', '/manifest.json');
  check('Manifest PWA servi', manifest.status === 200 && manifest.data.name.includes('Collecte des déchets') && manifest.data.icons.length >= 2);
  const sw = await fetch(BASE + '/sw.js');
  check('Service worker servi', sw.status === 200 && (await sw.text()).includes('takata-v'));
  const icon = await fetch(BASE + '/icons/icon-512.png');
  check('Icône 512 servie', icon.status === 200 && (icon.headers.get('content-type') || '').includes('png'));

  // 21. Logout (avec le nouveau jeton post-changement de mot de passe)
  const freshToken = relogin.data.token;
  const logout = await call('POST', '/api/auth/logout', null, freshToken);
  check('Logout', logout.status === 200);
  const afterLogout = await call('GET', '/api/dashboard', null, freshToken);
  check('Token révoqué après logout (401)', afterLogout.status === 401);

  console.log(`\n📊 Résultat : ${passed} réussis, ${failed} échecs`);
  if (failed) { console.log('\nDétails des échecs :'); errors.forEach((e) => console.log(' ', e)); process.exit(1); }
  console.log('✅ TAKATA opérationnel de bout en bout.');
})();
