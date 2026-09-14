// tests/roles_test.js — Vérification du modèle de rôles TAKATA (deep_delivery)
// Usage : node tests/roles_test.js   (serveur attendu sur http://localhost:8080)
/* eslint-disable no-console */
const BASE = process.env.BASE_URL || 'http://localhost:8080';

let passed = 0, failed = 0;
const check = (label, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✅ ${label} ${extra}`); }
  else { failed++; console.log(`  ❌ ${label} ${extra}`); }
};

async function api(method, path, body, token) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), token].join('') } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* vide */ }
  return { status: res.status, data };
}

async function login(username, password) {
  const { status, data } = await api('POST', '/auth/login', { username, password });
  if (status !== 200 || !data.token) throw new Error(`Login échoué ${username}: HTTP ${status} ${JSON.stringify(data)}`);
  return data;
}

(async () => {
  console.log('── 1. CONNEXIONS PAR RÔLE ──');
  const admin = await login('admin', 'admin123');
  const admincomm = await login('admincomm', 'admincomm123');
  const admintech = await login('admintech', 'admintech123');
  const agent1 = await login('agent1', 'agent123');
  const agent2 = await login('agent2', 'agent123');
  const tech1 = await login('technicien1', 'tech123');
  check('adminGEN (admin) connecté, rôle=' + admin.user.role, admin.user.role === 'admingen');
  check('admincomm connecté, rôle=' + admincomm.user.role, admincomm.user.role === 'admincomm');
  check('admintech connecté, rôle=' + admintech.user.role, admintech.user.role === 'admintech');
  check('agent1 connecté → ' + agent1.user.full_name, agent1.user.role === 'agent' && agent1.user.full_name.includes('Merveille'));
  check('agent2 connecté', agent2.user.role === 'agent');
  check('technicien1 connecté', tech1.user.role === 'technicien');

  console.log('── 2. PRODUITS SECTEUR (collecte des déchets) ──');
  const { data: prods } = await api('GET', '/products', null, agent1.token);
  const names = prods.map((p) => p.name);
  check('5 formules/intrants en catalogue', prods.length === 5, JSON.stringify(names));
  check('Abonnement Standard 20 000 FC/mois (mensuel)', names.some((n) => n.includes('Standard')) && prods.find((p) => p.name.includes('Standard')).price === 20000 && prods.find((p) => p.name.includes('Standard')).payg === 1);
  check('Abonnement Premium 35 000 FC/mois', prods.find((p) => p.name.includes('Premium')).price === 35000);
  check('Séance à la carte 2 500 FC (sans échéancier)', prods.find((p) => p.name.includes('Séance')).price === 2500 && prods.find((p) => p.name.includes('Séance')).payg === 0);

  console.log('── 3. PÉRIMÈTRE COMMERCIAL (voit son portefeuille) ──');
  const { data: c1 } = await api('GET', '/customers', null, agent1.token);
  const { data: c2 } = await api('GET', '/customers', null, agent2.token);
  check('agent1 voit ses clients (Merveille Kabeya)', c1.length >= 3, '→ ' + c1.map((c) => c.name).join(' | '));
  check('agent2 voit ses clients seulement', c2.length === 2, '→ ' + c2.map((c) => c.name).join(' | '));
  check('agent1 ne voit pas les clients d’agent2', !c1.some((x) => x.name.includes('Esther')));
  const { data: dash1 } = await api('GET', '/dashboard', null, agent1.token);
  check('dashboard agent1 : ' + dash1.stats.customers + ' clients / ' + dash1.stats.prospects + ' prospects', dash1.stats.customers >= 3 && dash1.stats.prospects === 2);

  console.log('── 4. PÉRIMÈTRE TECHNICIEN (opérations terrain uniquement) ──');
  const tProsp = await api('GET', '/prospects', null, tech1.token);
  check('technicien : prospects refusés (403)', tProsp.status === 403);
  const tCust = await api('POST', '/customers', { name: 'Test Interdit' }, tech1.token);
  check('technicien : création client refusée (403)', tCust.status === 403);
  const tPay = await api('POST', '/payments', { customer_id: 1, amount: 2000 }, tech1.token);
  check('technicien : encaissement refusé (403)', tPay.status === 403);
  const tInstall = await api('GET', '/installations', null, tech1.token);
  check('technicien : lit les abonnements en service', tInstall.status === 200 && tInstall.data.length >= 4);
  const tStock = await api('GET', '/stock', null, tech1.token);
  check('technicien : accès au stock matériel', tStock.status === 200);
  const tDash = await api('GET', '/dashboard', null, tech1.token);
  check('dashboard technicien : tournées/stock', tDash.data && tDash.data.stats.installations >= 4);

  const ts = Date.now().toString(36);
  console.log('── 5. admincomm supervise LES COMMERCIAUX ──');
  const { data: acTeam } = await api('GET', '/admin/agents', null, admincomm.token);
  check('admincomm ne voit QUE des commerciaux', acTeam.length >= 3 && acTeam.every((x) => x.role === 'agent'), acTeam.map((x) => x.username).join(', '));
  const acCreateTech = await api('POST', '/admin/agents', { username: 'tousef' + ts, password: 'secret12', full_name: 'X', role: 'technicien' }, admincomm.token);
  // Règle de sécurité : pas d'élévation — le rôle demandé (technicien) est forcé à « agent »
  check('admincomm ne peut plus créer de compte (403, réservé à la direction)', acCreateTech.status === 403, JSON.stringify(acCreateTech.data));
  const acCreateAgent = await api('POST', '/admin/agents', { username: 'agent-x' + ts, password: 'secret12', full_name: 'Alpha Test', role: 'agent', team: 'Commercial', region: 'Kolwezi' }, admincomm.token);
  check('admincomm ne peut plus créer un commercial (403)', acCreateAgent.status === 403, 'status=' + acCreateAgent.status);

  console.log('── 6. admintech supervise LES TECHNICIENS ──');
  const { data: atTeam } = await api('GET', '/admin/agents', null, admintech.token);
  check('admintech ne voit QUE des techniciens', atTeam.length >= 2 && atTeam.every((x) => x.role === 'technicien'), atTeam.map((x) => x.username).join(', '));
  const atCreateAgent = await api('POST', '/admin/agents', { username: 'yop' + ts, password: 'secret12', full_name: 'Y', role: 'agent' }, admintech.token);
  // Règle de sécurité : pas d'élévation — le rôle demandé (agent) est forcé à « technicien »
  check('admintech ne peut plus créer de compte (403, réservé à la direction)', atCreateAgent.status === 403, JSON.stringify(atCreateAgent.data));
  const atCreateTech = await api('POST', '/admin/agents', { username: 'tech-x' + ts, password: 'secret12', full_name: 'Ramasseur Test', role: 'technicien', team: 'Technique', region: 'Lubumbashi' }, admintech.token);
  check('admintech ne peut plus créer un technicien (403)', atCreateTech.status === 403, 'status=' + atCreateTech.status);

  console.log('── 7. adminGEN : TOUT voir + créer des comptes ──');
  const { data: genTeam } = await api('GET', '/admin/agents', null, admin.token);
  const rolesVus = [...new Set(genTeam.map((x) => x.role))];
  check('adminGEN voit agents + techniciens + superviseurs + direction', ['agent', 'technicien', 'admincomm', 'admintech', 'admingen'].every((r) => rolesVus.includes(r)), JSON.stringify(rolesVus));
  const genCreate = await api('POST', '/admin/agents', { username: 'admingen-x' + ts, password: 'secret12', full_name: 'Directeur Bis', role: 'admingen' }, admin.token);
  check('adminGEN crée un compte admingen', genCreate.status === 201);
  const { data: ov } = await api('GET', '/admin/overview', null, admin.token);
  const { data: allPays } = await api('GET', '/payments', null, admin.token);
const paySum = (allPays || []).reduce((acc, p) => acc + Number(p.amount), 0);
check('adminGEN overview : ' + ov.customers + ' abonnés / ' + ov.installations + ' abonnements / ' + ov.totalPaid + ' FC encaissés (cohérent avec la somme réelle ' + paySum + ')', ov.customers >= 6 && ov.installations >= 4 && Number(ov.totalPaid) === paySum);

  console.log('── 8. CRÉATION & PERSISTANCE DE DONNÉES ──');
  const created = await api('POST', '/customers', { name: 'Persistance Test', phone: '099 123 9876', village: 'Dilala', address: 'Av. Test 1' }, agent1.token);
  check('agent1 crée un client → HTTP ' + created.status, created.status === 201);
  const cid = created.data.id;
  const found = await api('GET', '/customers/' + cid, null, agent1.token);
  check('client relisible via GET /customers/' + cid, found.status === 200 && found.data.name === 'Persistance Test');
  // Paiement séance (client Patrick Musasa, seed) → commission 20 % = 500 FC (règle TAKATA)
  const agent3 = await login('agent3', 'agent123');
  const { data: allCust } = await api('GET', '/customers', null, admin.token);
  const pat = allCust.find((x) => x.name.includes('Patrick'));
  if (pat) {
    const pay = await api('POST', '/payments', { customer_id: pat.id, amount: 2500, method: 'cash', ref: 'REC-TEST' }, agent3.token);
    check('paiement séance 2 500 FC enregistré (HTTP ' + pay.status + ')', pay.status === 201);
    const comms = await api('GET', '/commissions', null, agent3.token);
    check('commission séance : 500 FC (20 %) calculée', comms.data && comms.data.rows.some((x) => x.amount === 500 && x.agent.includes('Ilunga')), JSON.stringify((comms.data || {}).rows || []));
  } else {
    check('client séance présent (seed)', false);
  }

  // Persistance après redémarrage : vérifiée par le script tests/persist_check.js (relance serveur entre les deux)

  console.log('── 9. GESTION DES COMPTES & STOCK MANUEL (v3.1) ──');
  // a) Édition : renommer + téléphone par la direction
  const acct = await api('POST', '/admin/agents', { username: 'edit-me' + ts, password: 'secret12', full_name: 'Édit Test', role: 'agent', phone: '+243 000 111 222', region: 'Kolwezi' }, admin.token);
  check('création du compte à éditer (HTTP ' + acct.status + ')', acct.status === 201);
  const edit = await api('PUT', '/admin/agents/' + acct.data.id, { full_name: 'Édit Test Renommé', phone: '+243 999 888 777' }, admin.token);
  check('direction renomme le compte + téléphone (HTTP ' + edit.status + ')', edit.status === 200);
  const { data: teamAfter } = await api('GET', '/admin/agents', null, admin.token);
  const renamed = teamAfter.find((x) => x.id === acct.data.id);
  check('renommage persisté : ' + (renamed && renamed.full_name) + ' / ' + (renamed && renamed.phone), renamed && renamed.full_name === 'Édit Test Renommé' && renamed.phone === '+243 999 888 777');
  // b) Suppression du numéro de téléphone (champ vide)
  await api('PUT', '/admin/agents/' + acct.data.id, { phone: '' }, admin.token);
  const { data: teamEmpty } = await api('GET', '/admin/agents', null, admin.token);
  const emptied = teamEmpty.find((x) => x.id === acct.data.id);
  check('numéro de téléphone supprimé (vide)', emptied && (emptied.phone === '' || emptied.phone === null));
  // c) Changement de profil par la direction
  const roleChange = await api('PUT', '/admin/agents/' + acct.data.id, { role: 'technicien' }, admin.token);
  check('direction change le profil (agent → technicien)', roleChange.status === 200);
  // d) Suppression définitive d'un compte sans données liées
  const del = await api('DELETE', '/admin/agents/' + acct.data.id, null, admin.token);
  check('direction supprime le compte (hard delete)', del.status === 200 && del.data.deleted === true);
  const { data: teamGone } = await api('GET', '/admin/agents', null, admin.token);
  check('compte disparu de la liste', !(teamGone || []).some((x) => x.id === acct.data.id));
  // e) Suppression refusée si données liées (agent1 a des clients)
  const { data: teamAll } = await api('GET', '/admin/agents', null, admin.token);
  const a1row = teamAll.find((x) => x.username === 'agent1');
  const delBlocked = await api('DELETE', '/admin/agents/' + a1row.id, null, admin.token);
  check('suppression refusée si données liées (409 + conseil)', delBlocked.status === 409);
  // f) Stock : saisie manuelle des quantités possédées
  const { data: prodsAll } = await api('GET', '/products', null, admin.token);
  const sacs = prodsAll.find((p) => p.name.includes('Sacs'));
  const set1 = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: null, quantity: 250 }, admin.token);
  check('stock : saisie manuelle acceptée (250)', set1.status === 200 && set1.data.quantity === 250);
  const { data: stockAdmin } = await api('GET', '/admin/stock', null, admin.token);
  const line = stockAdmin.find((st) => st.product_id === sacs.id && st.agent_id === null);
  check('quantité persistée en base : ' + (line && line.quantity), line && line.quantity === 250);
  const set2 = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: null, quantity: 240 }, admin.token);
  check('ajustement à la baisse accepté (240)', set2.status === 200);
  const setBad = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: null, quantity: -5 }, admin.token);
  check('quantité négative refusée (400)', setBad.status === 400);

  // g) Rôle relu après changement de profil
  const { data: teamRole } = await api('GET', '/admin/agents', null, admin.token);
  const roleRow = teamRole.find((x) => x.username === 'agent1');
  check('agent1 conserve son profil après édition refusée', roleRow && roleRow.role === 'agent');
  // h) PUT de superviseur : changement de rôle ignoré
  const supPut = await api('PUT', '/admin/agents/' + teamRole.find((x) => x.username === 'agent2').id, { role: 'admintech' }, admincomm.token);
  const { data: teamAfterSup } = await api('GET', '/admin/agents', null, admin.token);
  check('superviseur ne peut pas changer un profil', supPut.status === 200 || supPut.status === 403 ? !(teamAfterSup.find((x) => x.username === 'agent2').role === 'admintech') : false);
  // i) Protection du profil direction
  const dirRow = teamRole.find((x) => x.role === 'admingen');
  const dirPut = await api('PUT', '/admin/agents/' + dirRow.id, { role: 'agent' }, admin.token);
  check('profil direction protégé (403)', dirPut.status === 403);
  // j) DELETE d'un superviseur → désactivation simple
  const tmpSup = await api('POST', '/admin/agents', { username: 'tmp-sup' + ts, password: 'secret12', full_name: 'Sup Temp', role: 'admincomm' }, admin.token);
  const delSup = await api('DELETE', '/admin/agents/' + tmpSup.data.id, null, admin.token);
  check('direction supprime un superviseur (hard delete)', delSup.status === 200 && delSup.data.deleted === true);
  // k) Mouvement d'ajustement tracé
  const { data: movs } = await api('GET', '/admin/stock/movements', null, admin.token);
  check('mouvement d\'ajustement manuel tracé', (movs || []).some((m) => /Ajustement/i.test(m.note || '')));
  // l) Stock : quantité absente refusée + destinataire inconnu refusé
  const setNoQty = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: null }, admin.token);
  check('stock : quantité absente refusée (400)', setNoQty.status === 400);
  const setBadAgent = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: 9999, quantity: 10 }, admin.token);
  check('stock : destinataire inconnu refusé (400)', setBadAgent.status === 400);

  console.log('── 10. SÉCURITÉ : consolidation, périmètres & protections (v3.2) ──');
  // a) Route register-agent retirée (consolidation de la création de comptes)
  const reg410 = await api('POST', '/auth/register-agent', { username: 'x-test', password: 'xxxxxx', full_name: 'X' }, admin.token);
  check('register-agent retirée (410 → POST /admin/agents)', reg410.status === 410);
  // b) Mutation cross-origin refusée
  const evil = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: JSON.stringify({ username: 'agent1', password: 'agent123' }) });
  check('mutation cross-origin refusée (403)', evil.status === 403);
  // c) Payload surdimensionné refusé
  const big = 'x'.repeat(80 * 1024);
  const bigRes = await api('POST', '/sync', { operations: [{ uuid: 'big-' + ts, op: 'create_customer', payload: { name: big } }] }, admin.token);
  check('payload > 64kb refusé (413)', bigRes.status === 413);
  // d) Summary scopé : admincomm ne voit que les commerciaux
  const sumComm = await api('GET', '/reports/summary', null, admincomm.token);
  const commAgents = (sumComm.data.byAgent || []).map((x) => x.agent);
  check('summary admincomm : classement limité aux commerciaux (aucun technicien)', commAgents.length > 0 && commAgents.every((n) => !/Kavira Mwamba/.test(n)), JSON.stringify(commAgents));
  const sumAdm = await api('GET', '/reports/summary', null, admin.token);
  check('summary adminGEN ≥ admincomm (encaissements)', Number(sumAdm.data.payments.total) >= Number(sumComm.data.payments.total), sumAdm.data.payments.total + ' vs ' + sumComm.data.payments.total);
  // e) sync/pending scopé par équipe
  const pendComm = await api('GET', '/sync/pending', null, admincomm.token);
  const { data: teamAll2 } = await api('GET', '/admin/agents', null, admin.token);
  const agentIds = teamAll2.filter((x) => x.role === 'agent').map((x) => x.id);
  const techIds2 = teamAll2.filter((x) => x.role === 'technicien').map((x) => x.id);
  check('sync/pending admincomm : opérations commerciales uniquement', (pendComm.data || []).every((o) => agentIds.includes(o.agent_id)), JSON.stringify([...new Set((pendComm.data || []).map((o) => o.agent_id))]));
  const pendTech = await api('GET', '/sync/pending', null, admintech.token);
  check('sync/pending admintech : opérations techniques uniquement', (pendTech.data || []).every((o) => techIds2.includes(o.agent_id)), JSON.stringify([...new Set((pendTech.data || []).map((o) => o.agent_id))]));
  // f) Mouvements de stock scopés (matériel technique masqué à admincomm)
  const movsComm = await api('GET', '/admin/stock/movements', null, admincomm.token);
  check('mouvements admincomm : matériel technique masqué', (movsComm.data || []).every((m) => !/Kavira Mwamba/.test(m.agent || '')), 'lignes: ' + (movsComm.data || []).length);
  // admintech ajuste le stock de son technicien → mouvement tracé, visible pour lui, masqué pour admincomm
  const techRow = teamAll2.find((x) => x.role === 'technicien' && x.username === 'technicien1');
  const techSet = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: techRow.id, quantity: 55 }, admintech.token);
  check('admintech ajuste le stock de son technicien (HTTP ' + techSet.status + ')', techSet.status === 200);
  const movsTech = await api('GET', '/admin/stock/movements', null, admintech.token);
  check('mouvement d\'ajustement technique visible pour admintech', (movsTech.data || []).some((m) => /Ajustement manuel/.test(m.note || '')), 'lignes: ' + (movsTech.data || []).length);
  const movsCommAfter = await api('GET', '/admin/stock/movements', null, admincomm.token);
  check('mouvement technique masqué pour admincomm', !((movsCommAfter.data || []).some((m) => /Ajustement manuel/.test(m.note || '') && /Musasa/.test(m.agent || ''))), 'lignes: ' + (movsCommAfter.data || []).length);

  console.log(`\n═══ RÉSULTAT : ${passed} ✅ / ${failed} ❌ ═══`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Erreur d’exécution des tests :', e.message); process.exit(2); });