// seed.js — Initialisation de la base TAKATA
// Usage :
//   node seed.js --reset          → base PROPRE : comptes des 5 profils + formules, ZÉRO donnée de démo
//   node seed.js --reset --demo   → base de DÉMONSTRATION (clients, abonnements, paiements, stock…)
// Les comptes et les formules font partie de la configuration : ils sont toujours créés.
const DEMO = process.argv.includes('--demo');
const RESET = process.argv.includes('--reset') || DEMO;
const db = require('./db');
const { hashPassword } = require('./auth');

if (RESET) {
  const tables = ['tech_demandes', 'tournees', 'tech_report_items', 'tech_reports', 'notifications', 'commissions', 'installments', 'payments', 'installations',
    'prospects', 'customers', 'stock_movements', 'stock_items', 'products', 'tokens', 'sync_queue', 'users'];
  db.pragma('foreign_keys = OFF');
  for (const t of tables) {
    try { db.prepare(`DELETE FROM ${t}`).run(); }
    catch (e) { console.error(`[seed] ATTENTION : suppression de ${t} impossible — ${e.message}`); }
  }
  try { db.prepare(`DELETE FROM sqlite_sequence`).run(); } catch (e) { /* */ }
  db.pragma('foreign_keys = ON');
  console.log('♻️  Base réinitialisée.');
}

const seed = db.transaction(() => {
  // ================= 1. COMPTES (les 5 profils) =================
  const insUser = (username, password, full_name, phone, role, team, region) =>
    db.prepare(`INSERT INTO users (username, password_hash, full_name, phone, role, team, region) VALUES (?,?,?,?,?,?,?)`)
      .run(username, hashPassword(password), full_name, phone, role, team, region).lastInsertRowid;

  // Direction (adminGEN) + superviseurs
  const admingenId = insUser('admin', 'admin123', 'Héritier Kalambayi', '+243 800 000 000', 'admingen', 'Direction', 'National');
  const admincommId = insUser('admincomm', 'admincomm123', 'Chantal Banza', '+243 801 000 001', 'admincomm', 'Commercial', 'National');
  const admintechId = insUser('admintech', 'admintech123', 'Patrick Musasa', '+243 801 000 002', 'admintech', 'Technique', 'National');

  // Équipe commerciale
  const agentIds = [
    insUser('agent1', 'agent123', 'Merveille Kabeya', '+243 810 111 222', 'agent', 'Commercial', ''),
    insUser('agent2', 'agent123', 'Jean-Claude Mbuyi', '+243 820 333 444', 'agent', 'Commercial', ''),
    insUser('agent3', 'agent123', 'Grace Ilunga', '+243 830 555 666', 'agent', 'Commercial', ''),
  ];

  // Équipe technique
  const techIds = [
    insUser('technicien1', 'tech123', 'Kavira Mwamba', '+243 840 777 888', 'technicien', 'Technique', ''),
    insUser('technicien2', 'tech123', 'Joseph Kazadi', '+243 850 999 000', 'technicien', 'Technique', ''),
  ];

  // ================= 2. FORMULES & INTRANTS (configuration métier) =================
  const products = [
    ['Réabonnement Standard (2 collectes/sem)', 'Formule collecte', 20000, 8000, 20, 1, 12],
    ['Réabonnement Premium (3 collectes/sem)', 'Formule collecte', 35000, 14000, 20, 1, 12],
    ['Séance à la carte (1 collecte)', 'Formule collecte', 2500, 1000, 20, 0, 1],
    ['Sacs poubelle (lot de 10)', 'Intrant', 5000, 3000, 0, 0, 1],
    ['Désinfectant (bidon 1 L)', 'Intrant', 15000, 9000, 0, 0, 1],
  ];
  const productIds = products.map(([n, c, pr, co, cr, payg, nb]) =>
    db.prepare(`INSERT INTO products (name, category, price, cost, commission_rate, payg, nb_installments) VALUES (?,?,?,?,?,?,?)`)
      .run(n, c, pr, co, cr, payg, nb).lastInsertRowid);

  // Dotation par metier : sacs poubelle aux commerciaux, desinfectant aux techniciens
const _sacs = productIds[3]; // Sacs poubelle
const _desinf = productIds[4]; // Desinfectant
agentIds.forEach((id) => db.prepare('INSERT OR IGNORE INTO stock_items (product_id, agent_id, quantity) VALUES (?,?,?)').run(_sacs, id, 50));
techIds.forEach((id) => db.prepare('INSERT OR IGNORE INTO stock_items (product_id, agent_id, quantity) VALUES (?,?,?)').run(_desinf, id, 20));
// ================= 3. DÉMONSTRATION (uniquement avec --demo) =================
  if (DEMO) {
    // Stock de départ (dotations)
    const stockDefs = [
      [productIds[0], null, 500], [productIds[1], null, 300], [productIds[2], null, 1000],
      [productIds[3], null, 200], [productIds[4], null, 30],
      [productIds[0], agentIds[0], 40], [productIds[1], agentIds[0], 20], [productIds[2], agentIds[0], 60],
      [productIds[0], agentIds[1], 35], [productIds[2], agentIds[1], 50],
      [productIds[1], agentIds[2], 15], [productIds[2], agentIds[2], 40],
      [productIds[3], techIds[0], 60], [productIds[4], techIds[0], 12],
      [productIds[3], techIds[1], 50], [productIds[4], techIds[1], 10],
    ];
    const insStock = db.prepare('INSERT INTO stock_items (product_id, agent_id, quantity) VALUES (?,?,?)');
    for (const s of stockDefs) insStock.run(...s);

    const dateOffset = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

    // Clients abonnés
    const customers = [
      ['Maman Odette Tshibanda', '099 111 2233', 'Joli Site', 'Av. de la Paix 12', agentIds[0]],
      ['Papa André Kalenga', '099 222 3344', 'Dilala', 'Av. Lumumba 45', agentIds[0]],
      ['Carine Mwamba', '099 333 4455', 'Manika', 'Av. des Écoles 8', agentIds[0]],
      ['Joseph Kazadi', '099 444 5566', 'Kampemba', 'Av. du Marché 3', agentIds[1]],
      ['Esther Ntumba', '099 555 6677', 'Golf', 'Av. du Port 21', agentIds[1]],
      ['Patrick Musasa', '099 666 7788', 'Lubota', 'Av. de la Gare 7', agentIds[2]],
    ];
    const insCust = db.prepare(`INSERT INTO customers (agent_id, name, phone, village, address, status) VALUES (?,?,?,?,?, 'actif')`);
    const custIds = customers.map(([n, ph, v, a, aId]) => insCust.run(aId, n, ph, v, a).lastInsertRowid);

    // Prospects
    const prospects = [
      ['Marcel Nkulu', '099 777 8899', 'Kampemba', 'Abonnement Standard', 'contacté', agentIds[0]],
      ['Chantal Banza', '099 888 9900', 'Kisanga', 'Abonnement Premium', 'nouveau', agentIds[0]],
      ['Dieu-Merci Ilunga', '099 999 0011', 'Manika', 'Abonnement Standard', 'nouveau', agentIds[1]],
      ['Sylvie Muteba', '098 111 2233', 'Likasi', 'Séance à la carte', 'contacté', agentIds[2]],
    ];
    const insProsp = db.prepare(`INSERT INTO prospects (agent_id, name, phone, village, interest, status, follow_up_date) VALUES (?,?,?,?,?,?,?)`);
    for (const [n, ph, v, i, st, aId] of prospects) {
      insProsp.run(aId, n, ph, v, i, st, new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
    }

    // Abonnements + échéanciers mensuels
    const insInstall = db.prepare(`INSERT INTO installations (customer_id, agent_id, product_id, serial, install_date, status) VALUES (?,?,?,?,?, 'installé')`);
    const abs1 = insInstall.run(custIds[0], agentIds[0], productIds[0], 'TAK-ABS-0001', dateOffset(0)).lastInsertRowid;
    const abs2 = insInstall.run(custIds[1], agentIds[0], productIds[0], 'TAK-ABS-0002', dateOffset(-5)).lastInsertRowid;
    const abs3 = insInstall.run(custIds[3], agentIds[1], productIds[1], 'TAK-ABS-0003', dateOffset(-2)).lastInsertRowid;
    const abs4 = insInstall.run(custIds[5], agentIds[2], productIds[2], 'TAK-SCE-0001', dateOffset(-8)).lastInsertRowid;

    const insInst = db.prepare(`INSERT INTO installments (installation_id, customer_id, agent_id, due_date, amount, status, paid_date) VALUES (?,?,?,?,?,?,?)`);
    const schedule = (installationId, custId, agentId, price) => {
      for (let k = 0; k < 12; k++) {
        const due = new Date(Date.now() + k * 30 * 864e5);
        const paid = k === 0;
        insInst.run(installationId, custId, agentId, due.toISOString().slice(0, 10), price,
          paid ? 'paid' : 'pending', paid ? dateOffset(0) : '');
      }
    };
    schedule(abs1, custIds[0], agentIds[0], 20000);
    schedule(abs2, custIds[1], agentIds[0], 20000);
    schedule(abs3, custIds[3], agentIds[1], 35000);

    // Paiements + commissions
    const insPay = db.prepare(`INSERT INTO payments (customer_id, agent_id, installation_id, amount, method, ref, created_at) VALUES (?,?,?,?,?,?,?)`);
    const pay1 = insPay.run(custIds[0], agentIds[0], abs1, 20000, 'mobile_money', 'MM-88231', dateOffset(-1)).lastInsertRowid;
    const pay2 = insPay.run(custIds[3], agentIds[1], abs3, 35000, 'mobile_money', 'MM-88232', dateOffset(-2)).lastInsertRowid;
    const pay3 = insPay.run(custIds[5], agentIds[2], abs4, 2500, 'cash', 'REC-0001', dateOffset(-3)).lastInsertRowid;

    const insComm = db.prepare(`INSERT INTO commissions (agent_id, payment_id, installation_id, amount, status) VALUES (?,?,?,?,?)`);
    insComm.run(agentIds[0], pay1, abs1, 4000, 'pending');
    insComm.run(agentIds[1], pay2, abs3, 7000, 'pending');
    insComm.run(agentIds[2], pay3, abs4, 500, 'paid');

    // Notifications
    const insNotif = db.prepare(`INSERT INTO notifications (user_id, title, body, read) VALUES (?,?,?,?)`);
    insNotif.run(agentIds[0], 'Bienvenue sur TAKATA', 'Votre compte commercial est prêt. Bonnes collectes !', 0);
    insNotif.run(techIds[0], 'Tournée du jour', '2 abonnements Standard à collecter à Joli Site et Dilala.', 0);
    insNotif.run(admincommId, 'Équipe commerciale prête', '3 commerciaux et 6 abonnés enregistrés.', 0);
    insNotif.run(admingenId, 'Compte direction créé', 'TAKATA Admin est prêt.', 0);

    console.log('   Démo : 6 clients, 4 abonnements, 3 paiements, 4 commissions, stock doté.');
    return { demo: true, agentIds, techIds, custIds, abs: [abs1, abs2, abs3, abs4] };
  }

  // Mode PROPRE : zéro donnée, base prête pour l'activité réelle
  console.log('   Base propre : comptes + formules uniquement. Le stock et les clients se saisiront depuis l\'application.');
  return { demo: false, admingenId, admincommId, admintechId, agentIds, techIds, productIds };
});

const result = seed();

console.log('✅ ' + (DEMO ? 'Données de DÉMONSTRATION chargées.' : 'Base PROPRE chargée (aucune donnée de démonstration).'));
console.log('   Direction : admin / admin123 (adminGEN) · admincomm / admincomm123 · admintech / admintech123');
result.agentIds.forEach((id) => {
  const u = db.prepare('SELECT username, full_name FROM users WHERE id = ?').get(id);
  console.log(`   Commercial : ${u.username} / agent123 (${u.full_name})`);
});
// Garde-fou : si le COMMIT a échoué (base verrouillée, process tué par un pipe…),
// la base est vide → on le dit et on sort en erreur plutôt que de livrer une base cassée.
const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
const productCount = db.prepare('SELECT COUNT(*) c FROM products').get().c;
if (userCount === 0 || productCount === 0) {
  console.error('❌ ÉCHEC DU SEED : users=' + userCount + ', products=' + productCount + ' — le COMMIT a été annulé (verrou ou interruption). Relancez le seed sans rediriger la sortie.');
  process.exit(1);
}
result.techIds.forEach((id) => {
  const u = db.prepare('SELECT username, full_name FROM users WHERE id = ?').get(id);
  console.log(`   Technicien : ${u.username} / tech123 (${u.full_name})`);
});