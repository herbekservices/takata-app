// tests/e2e_profiles.js — Scénarios bout-en-bout métier par profil (sur base PROPRE/vide)
// Usage : node tests/e2e_profiles.js   → vérifie le parcours réel de chaque profil
const BASE = process.env.BASE_URL || 'http://localhost:8080';

let passed = 0, failed = 0;
const check = (label, cond, detail) => {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
};

async function api(method, path, body, token) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Be' + 'arer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data };
}
async function login(u, p) {
  const r = await api('POST', '/auth/login', { username: u, password: p });
  if (r.status !== 200) throw new Error(`Login ${u} échoué (HTTP ${r.status}) : ${JSON.stringify(r.data)}`);
  return r.data.token;
}

(async () => {
  const runId = Date.now().toString(36).slice(-5); // idempotence des runs

  console.log('═══ E2E PAR PROFIL — parcours métier réels (base propre) ═══');

  // ============ DIRECTION : prépare le terrain (saisie manuelle du stock possédé) ============
  console.log('── DIRECTION (adminGEN) ──');
  const admin = await login('admin', 'admin123');
  const { data: prods } = await api('GET', '/products', null, admin);
  const seance = prods.find((p) => p.name.includes('Séance'));
  const sacs = prods.find((p) => p.name.includes('Sacs'));
  check('formules métier chargées (Séance + intrants)', !!seance && !!sacs);

  const setStock = await api('POST', '/admin/stock/set', { product_id: seance.id, agent_id: null, quantity: 50, note: 'Stock initial saisi manuellement' }, admin);
  check('direction saisit manuellement le stock possédé (50 séances)', setStock.status === 200 && setStock.data.quantity === 50);
  const setSacs = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: null, quantity: 200 }, admin);
  check('direction saisit le stock des sacs (200 lots)', setSacs.status === 200);

  // Dotation d'un commercial (le superviseur commercial pourrait aussi la faire)
  const { data: adminTeam } = await api('GET', '/admin/agents', null, admin);
  const agent2Row = adminTeam.find((x) => x.username === 'agent2');
  const dot = await api('POST', '/admin/stock/set', { product_id: seance.id, agent_id: agent2Row.id, quantity: 10, note: 'Dotation agent2' }, admin);
  check('dotation de 10 séances à agent2', dot.status === 200);

  const overview0 = await api('GET', '/admin/overview', null, admin);
  check('direction voit la vue globale (compteurs à zéro)', overview0.status === 200 && overview0.data.customers === 0);

  // ============ COMMERCIAL : prospect → client → séance → encaissement → complet ============
  console.log('── COMMERCIAL (agent2) ──');
  const agent2 = await login('agent2', 'agent123');

  // 1. Crée un prospect
  const prospect = await api('POST', '/prospects', { name: 'Client E2E Kabila', phone: '099 777 1234', village: 'Quartier E2E', interest: 'Séance à la carte' }, agent2);
  check('prospect créé', prospect.status === 201);
  const prospectId = prospect.data.id;

  // 2. Le convertit en client
  const converted = await api('POST', `/prospects/${prospectId}/convert`, {}, agent2);
  check('prospect converti en client', converted.status === 201 && converted.data.customerId);
  const customerId = converted.data.customerId;

  // 3. Souscrit une Séance à la carte (2 500 FC)
  const install = await api('POST', '/installations', { customer_id: customerId, product_id: seance.id, serial: 'TAK-SCE-E2E' }, agent2);
  check('abonnement (séance) souscrit — stock décrémenté', install.status === 201);

  // 4. Encaisse le paiement complet (2 500 FC)
  const pay = await api('POST', '/payments', { customer_id: customerId, amount: 2500, method: 'mobile_money', ref: 'E2E-PAY-1' }, agent2);
  check('paiement complet 2 500 FC encaissé', pay.status === 201);

  // 5. Le commercial voit son « complet » : 2 × 500 FC (souscription + encaissement)
  const comms = await api('GET', '/commissions', null, agent2);
  const mine = (comms.data.rows || []).filter((c) => c.amount === 500);
  check('complet du commercial : 2 commissions de 500 FC (souscription + encaissement)', mine.length === 2, 'trouvé : ' + JSON.stringify((comms.data.rows || []).map((c) => c.amount)));

  // 6. Le client apparaît dans son portefeuille
  const { data: myCustomers } = await api('GET', '/customers', null, agent2);
  const e2e = myCustomers.find((c) => c.name === 'Client E2E Kabila');
  check('client visible dans le portefeuille (statut ' + (e2e ? e2e.status : '?') + ')', !!e2e && ['actif', 'installé'].includes(e2e.status));

  // 7. Le paiement est traçable
  const pays = await api('GET', `/payments?customer_id=${customerId}`, null, agent2);
  check('paiement traçable dans l\'historique client', (pays.data || []).some((p) => p.amount === 2500 && p.ref === 'E2E-PAY-1'));

  // ============ TECHNICIEN : tournées + matériel, refus du commerce ============
  console.log('── TECHNICIEN (technicien1) ──');
  const tech = await login('technicien1', 'tech123');
  const techInst = await api('GET', '/installations', null, tech);
  check('technicien consulte les tournées (abonnements en service)', techInst.status === 200 && Array.isArray(techInst.data));
  const techStock = await api('GET', '/stock', null, tech);
  check('technicien consulte son matériel', techStock.status === 200 && Array.isArray(techStock.data));
  const techRefused = await api('POST', '/customers', { name: 'Interdit' }, tech);
  check('technicien bloqué sur la vente (403)', techRefused.status === 403);
  const techCom = await api('GET', '/commissions', null, tech);
  check('technicien bloqué sur les commissions (403)', techCom.status === 403);

  // ============ SUPERVISEUR COMMERCIAL ──
  console.log('── SUPERVISEUR COMMERCIAL (admincomm) ──');
  const admincomm = await login('admincomm', 'admincomm123');
  const newAgent = await api('POST', '/admin/agents', { username: 'agent4-e2e-' + runId, password: 'agent456', full_name: 'Agent E2E', role: 'agent', phone: '+243 870 000 001', team: 'Commercial', region: 'Kolwezi' }, admincomm);
  check('superviseur commercial ne peut plus créer de compte (403, réservé à la direction)', newAgent.status === 403, 'status=' + newAgent.status);
  // Cible EXISTANTE dans le périmètre du superviseur (un commercial réel) :
  // la modification reste réservée à la direction → 403.
  const { data: commTeamE2E } = await api('GET', '/admin/agents', null, admincomm);
  const existingAgent = (commTeamE2E || []).find((x) => x.role === 'agent');
  const phoneEdit = await api('PUT', '/admin/agents/' + (existingAgent ? existingAgent.id : 0), { phone: '+243 870 999 888' }, admincomm);
  check('superviseur ne peut plus modifier un compte (403)', phoneEdit.status === 403, 'status=' + phoneEdit.status);
  const sumComm = await api('GET', '/reports/summary', null, admincomm);
  check('superviseur voit le résumé de son équipe (scopé)', sumComm.status === 200 && (sumComm.data.byAgent || []).every((x) => x.agent !== 'Kavira Mwamba'), JSON.stringify((sumComm.data.byAgent || []).map((x) => x.agent)));

  // ============ SUPERVISEUR TECHNIQUE ──
  console.log('── SUPERVISEUR TECHNIQUE (admintech) ──');
  const admintech = await login('admintech', 'admintech123');
  const newTech = await api('POST', '/admin/agents', { username: 'technicien3-e2e-' + runId, password: 'tech456', full_name: 'Technicien E2E', role: 'technicien', phone: '+243 870 000 002', team: 'Technique' }, admintech);
  check('superviseur technique ne peut plus créer de compte (403)', newTech.status === 403, 'status=' + newTech.status);
  // Dotation d'un technicien EXISTANT de son périmètre (la création de compte
  // étant réservée à la direction, on dote un technicien déjà présent).
  const { data: techTeamPre } = await api('GET', '/admin/agents', null, admintech);
  const existingTech = (techTeamPre || []).find((x) => x.role === 'technicien');
  const dotTech = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: existingTech ? existingTech.id : 0, quantity: 30, note: 'Dotation technicien E2E' }, admintech);
  check('superviseur technique dote son technicien (30 lots de sacs)', dotTech.status === 200);
  const { data: techTeam } = await api('GET', '/admin/agents', null, admintech);
  check('superviseur technique ne voit que des techniciens', techTeam.every((x) => x.role === 'technicien'));

  // ============ DIRECTION : voit tous les mouvements + gère les comptes ============
  console.log('── DIRECTION (adminGEN) ──');
  const admin2 = await login('admin', 'admin123');
  const { data: allTeam } = await api('GET', '/admin/agents', null, admin2);
  check('direction voit les profils comm ET tech', allTeam.some((x) => x.role === 'agent') && allTeam.some((x) => x.role === 'technicien'));
  const dirCreate = await api('POST', '/admin/agents', { username: 'agent5-dir-' + runId, password: 'agent567', full_name: 'Recrutement Direction', role: 'agent', phone: '+243 870 000 003' }, admin2);
  check('direction crée un compte de plus (l\'équipe grandit)', dirCreate.status === 201);
  const ov = await api('GET', '/admin/overview', null, admin2);
  check('direction voit tous les mouvements (encaissements incl. E2E)', ov.status === 200 && Number(ov.data.totalPaid) >= 2500, 'totalPaid=' + ov.data.totalPaid);

  console.log(`\n═══ E2E : ${passed} ✅ / ${failed} ❌ ═══`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Erreur E2E :', e.message); process.exit(2); });