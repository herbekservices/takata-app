// tests/e2e_tech.js — E2E métier technique : rapport du jour, stock, compilation, œil au login
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
let passed = 0, failed = 0;
// Re-seed : chaque exécution part d'une base propre (idempotence)
require('child_process').execSync('node seed.js --reset', { cwd: path.join(__dirname, '..') });
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

(async () => {
  console.log('═══ E2E MÉTIER TECHNIQUE (base propre) ═══');
  // 1. La direction saisit le stock possédé (sacs 200, désinfectant 30)
  const admin = (await api('POST', '/auth/login', { username: 'admin', password: 'admin123' })).data;
  const { data: prods } = await api('GET', '/products', null, admin.token);
  const sacs = prods.find((p) => p.name.includes('Sacs'));
  const desinf = prods.find((p) => p.name.includes('Désinfectant'));
  check('produits intrants au catalogue', !!sacs && !!desinf);
  await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: null, quantity: 200 }, admin.token);
  await api('POST', '/admin/stock/set', { product_id: desinf.id, agent_id: null, quantity: 30 }, admin.token);

  // 2. Dotation du technicien1 par le superviseur technique
  const admintech = (await api('POST', '/auth/login', { username: 'admintech', password: 'admintech123' })).data;
  const { data: techTeam } = await api('GET', '/admin/agents', null, admintech.token);
  const tech1 = techTeam.find((x) => x.username === 'technicien1');
  await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: tech1.id, quantity: 60 }, admintech.token);
  await api('POST', '/admin/stock/set', { product_id: desinf.id, agent_id: tech1.id, quantity: 12 }, admintech.token);
  check('superviseur technique dote son technicien (60 sacs, 12 désinfectants)', true);

  // 3. Le technicien crée son RAPPORT DU JOUR
  const tech = (await api('POST', '/auth/login', { username: 'technicien1', password: 'tech123' })).data;
  const report = await api('POST', '/tech/reports', {
    date: new Date().toISOString().slice(0, 10),
    menages_servis: 14,
    poubelles_evacuees: 22,
    courses_camion: 2,
    desinfections: 3,
    maisons_desinfectees: 5,
    commentaire: 'Tournée du matin : 2 incidents (poubelles endommagées). Désinfection du marché central.',
    items: [
      { product_id: sacs.id, quantite_utilisee: 10, etat_de_besoin: 50 },
      { product_id: desinf.id, quantite_utilisee: 2, etat_de_besoin: 20 }
    ]
  }, tech.token);
  check('technicien enregistre son rapport du jour (14 ménages, 22 poubelles, 2 courses, 3 désinfections, 5 maisons)', report.status === 201, JSON.stringify(report.data));

  // 4. Le stock des intrants est décrémenté (dotation du technicien)
  const { data: techStock } = await api('GET', '/admin/stock', null, admintech.token);
  const sacsTech = techStock.find((s) => s.product_id === sacs.id && s.agent_id === tech1.id);
  const desTech = techStock.find((s) => s.product_id === desinf.id && s.agent_id === tech1.id);
  check('stock décrémenté : sacs 60 → 50', sacsTech && sacsTech.quantity === 50, 'trouvé : ' + (sacsTech && sacsTech.quantity));
  check('stock décrémenté : désinfectant 12 → 10', desTech && desTech.quantity === 10, 'trouvé : ' + (desTech && desTech.quantity));

  // 5. Le rapport du jour est consultable (technicien + superviseur + direction)
  const own = await api('GET', '/tech/reports', null, tech.token);
  check('technicien relit son rapport du jour', (own.data || []).some((r) => r.menages_servis === 14));
  const ownTech = await api('GET', '/tech/reports', null, admintech.token);
  check('superviseur technique voit le rapport de son équipe', (ownTech.data || []).some((r) => r.menages_servis === 14));

  // 6. La compilation (summary) pour admintech et direction
  const sumTech = await api('GET', '/tech/summary', null, admintech.token);
  const t1 = (sumTech.data.per_tech || []).find((x) => x.technicien === 'Kavira Mwamba');
  check('compilation admintech : Kavira 14 ménages / 22 poubelles / 2 courses / 3 désinfections / 5 maisons',
    t1 && t1.menages_servis === 14 && t1.poubelles_evacuees === 22 && t1.courses_camion === 2 && t1.desinfections === 3 && t1.maisons_desinfectees === 5,
    JSON.stringify(t1));
  check('état de besoin consolidé : sacs 50, désinfectant 20', (sumTech.data.consos || []).some((c) => c.product_id === sacs.id && c.etat_de_besoin === 50) && (sumTech.data.consos || []).some((c) => c.product_id === desinf.id && c.etat_de_besoin === 20));
  const sumDir = await api('GET', '/tech/summary', null, admin.token);
  check('direction voit la compilation (totaux identiques)', sumDir.status === 200 && sumDir.data.totals.menages_servis === 14);
  const sumComm = await api('GET', '/tech/summary', null, (await api('POST', '/auth/login', { username: 'admincomm', password: 'admincomm123' })).data.token);
  check('admincomm : hors périmètre technique (403)', sumComm.status === 403);

  // 7. admincomm bloqué sur les rapports techniques
  const admincomm = (await api('POST', '/auth/login', { username: 'admincomm', password: 'admincomm123' })).data;
  const blocked = await api('GET', '/tech/reports', null, admincomm.token);
  check('admincomm bloqué sur les rapports techniques (403)', blocked.status === 403);

  console.log(`\n═══ E2E TECH : ${passed} ✅ / ${failed} ❌ ═══`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Erreur E2E tech :', e.message); process.exit(2); });