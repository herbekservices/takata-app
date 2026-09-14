// routes/sync.js — Synchronisation hors-ligne : réception d'opérations en file
// Chaque opération porte un uuid client pour l'idempotence. Toutes les cibles
// (client, échéance, installation) sont vérifiées avant application.
const express = require('express');
const db = require('../db');
const { buildScheduleDates, localDateStr } = require('../dates');
const { requireAuth, isAdminLike, isTechnician, scopedRoles } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const isAdmin = isAdminLike;

// Les équipes techniques (techniciens, admintech) n'utilisent pas la vente hors-ligne
const COMMERCIAL_OPS = ['create_customer', 'update_customer', 'create_prospect', 'update_prospect', 'create_installation', 'record_payment'];
const isTechBlocked = (u) => isTechnician(u) || u.role === 'admintech';

// POST /api/sync — { operations: [{ uuid, op, payload, created_at }] }
router.post('/', (req, res) => {
  const { operations = [] } = req.body || {};
  if (!Array.isArray(operations) || operations.length === 0) {
    return res.json({ results: [], serverTime: new Date().toISOString() });
  }
  const results = [];
  const insertOp = db.prepare(`INSERT OR IGNORE INTO sync_queue (agent_id, op, payload, client_uuid, created_at) VALUES (?,?,?,?,?)`);

  // D-02 (corrigé) : traitement ATOMIQUE par opération — insertion en file +
  // application métier + marquage 'done' dans UNE transaction. Un crash ne peut
  // plus laisser une opération 'pending' jamais appliquée (perte silencieuse) :
  // au redémarrage, le client renvoie l'opération et elle est réellement appliquée.
  // Seul un statut 'done' fait foi pour l'idempotence.
  const processOp = db.transaction((uuid, opName, payloadJson, createdAt) => {
    const existing = db.prepare('SELECT * FROM sync_queue WHERE client_uuid = ?').get(uuid);
    if (existing && existing.status === 'done') return { duplicate: true };
    if (existing) {
      db.prepare(`UPDATE sync_queue SET payload=?, error='', status='pending' WHERE client_uuid = ?`).run(payloadJson, uuid);
    } else {
      insertOp.run(req.user.id, opName, payloadJson, uuid, createdAt);
    }
    applyOp(req.user, opName, JSON.parse(payloadJson));
    db.prepare(`UPDATE sync_queue SET status='done', synced_at=datetime('now','localtime') WHERE client_uuid = ?`).run(uuid);
    return { duplicate: false };
  });

  for (const op of operations) {
    const uuid = op.uuid || `${op.op}-${op.ts || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payloadJson = JSON.stringify(op.payload || {});
    try {
      const r = processOp(uuid, op.op, payloadJson, op.created_at || new Date().toISOString());
      results.push(r.duplicate ? { uuid, status: 'done', duplicate: true } : { uuid, status: 'done' });
    } catch (e) {
      // Transaction annulée (rien n'a été appliqué) : on trace l'erreur dans la
      // file, HORS transaction, pour la visibilité /pending de l'agent.
      const msg = String((e && e.message) || e);
      try {
        const existing = db.prepare('SELECT id FROM sync_queue WHERE client_uuid = ?').get(uuid);
        if (existing) db.prepare(`UPDATE sync_queue SET status='error', error=? WHERE client_uuid = ?`).run(msg, uuid);
        else db.prepare(`INSERT INTO sync_queue (agent_id, op, payload, client_uuid, status, error) VALUES (?,?,?,?, 'error', ?)`)
          .run(req.user.id, op.op, payloadJson, uuid, msg);
      } catch (e2) { /* la traçabilité ne doit jamais masquer la réponse */ }
      results.push({ uuid, status: 'error', error: msg });
    }
  }
  res.json({ results, serverTime: new Date().toISOString() });
});

// GET /api/sync/pending — opérations de l'agent connecté (admin : tout)
router.get('/pending', (req, res) => {
  const roles = scopedRoles(req.user);
  let rows;
  if (isAdminLike(req.user)) {
    // Supervision : opérations de l'équipe (commerciaux ou techniciens selon le profil)
    const rolePh = roles.map(() => '?').join(',');
    rows = db.prepare(`SELECT id, agent_id, op, client_uuid, status, error, created_at FROM sync_queue WHERE agent_id IN (SELECT id FROM users WHERE role IN (${rolePh})) ORDER BY id DESC LIMIT 100`).all(...roles);
  } else {
    rows = db.prepare('SELECT id, agent_id, op, client_uuid, status, error, created_at FROM sync_queue WHERE agent_id = ? ORDER BY id DESC LIMIT 100').all(req.user.id);
  }
  res.json(rows);
});

function getCustomerOrThrow(user, id, label = 'Client') {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!c) throw new Error(`${label} introuvable.`);
  if (!isAdmin(user) && c.agent_id !== user.id) throw new Error(`Accès refusé : ${label.toLowerCase()} hors de votre périmètre.`);
  return c;
}

function applyOp(user, op, payload) {
  if (isTechBlocked(user) && COMMERCIAL_OPS.includes(op)) throw new Error('Opération réservée aux équipes commerciales.');
  switch (op) {
    case 'create_customer': {
      const { name, phone, village, address, notes } = payload;
      if (!name) throw new Error('name requis');
      db.prepare(`INSERT INTO customers (agent_id, name, phone, village, address, notes) VALUES (?,?,?,?,?,?)`)
        .run(user.id, String(name).trim(), phone || '', village || '', address || '', notes || '');
      break;
    }
    case 'update_customer': {
      const { id, name, phone, village, address, status, notes } = payload;
      if (!id) throw new Error('id requis');
      const c = getCustomerOrThrow(user, id);
      db.prepare(`UPDATE customers SET name=?, phone=?, village=?, address=?, status=?, notes=? WHERE id=?`)
        .run(name || c.name, phone ?? c.phone, village ?? c.village, address ?? c.address, status || c.status, notes ?? c.notes, c.id);
      break;
    }
    case 'create_prospect': {
      const { name, phone, village, interest, follow_up_date, notes } = payload;
      if (!name) throw new Error('name requis');
      db.prepare(`INSERT INTO prospects (agent_id, name, phone, village, interest, follow_up_date, notes) VALUES (?,?,?,?,?,?,?)`)
        .run(user.id, String(name).trim(), phone || '', village || '', interest || '', follow_up_date || '', notes || '');
      break;
    }
    case 'update_prospect': {
      const { id, name, phone, village, interest, status, follow_up_date, notes } = payload;
      if (!id) throw new Error('id requis');
      const p = db.prepare('SELECT * FROM prospects WHERE id = ?').get(id);
      if (!p) throw new Error('Prospect introuvable.');
      if (!isAdmin(user) && p.agent_id !== user.id) throw new Error('Accès refusé : prospect hors de votre périmètre.');
      db.prepare(`UPDATE prospects SET name=?, phone=?, village=?, interest=?, status=?, follow_up_date=?, notes=? WHERE id=?`)
        .run(name || p.name, phone ?? p.phone, village ?? p.village, interest ?? p.interest, status || p.status, follow_up_date ?? p.follow_up_date, notes ?? p.notes, p.id);
      break;
    }
    case 'create_installation': {
      const { customer_id, product_id, serial, install_date, notes, status } = payload;
      if (!customer_id || !product_id) throw new Error('customer_id et product_id requis');
      if (status && !['planifiée', 'installé'].includes(status)) throw new Error('Statut d\'installation invalide.');
      if (install_date && !/^\d{4}-\d{2}-\d{2}$/.test(install_date)) throw new Error('Date d\'installation invalide.');
      const customer = getCustomerOrThrow(user, customer_id);
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
      if (!product) throw new Error('Produit inconnu');
      // Refus si aucune unité disponible (pas de vente sans stock, même hors-ligne)
      const stockRow = db.prepare(`SELECT * FROM stock_items WHERE product_id = ? AND ((agent_id = ?) OR (agent_id IS NULL)) ORDER BY (agent_id = ?) DESC`)
        .all(product_id, user.id, user.id).find((r) => r.quantity > 0);
      if (!stockRow) throw new Error('Stock insuffisant pour cette installation.');
      const info = db.prepare(`INSERT INTO installations (customer_id, agent_id, product_id, serial, install_date, status, notes) VALUES (?,?,?,?,?,?,?)`)
      .run(customer.id, user.id, product_id, serial || '', install_date || localDateStr(), status || 'installé', notes || '');
      db.prepare('UPDATE stock_items SET quantity = quantity - 1 WHERE id = ?').run(stockRow.id);
      db.prepare(`INSERT INTO stock_movements (product_id, agent_id, type, quantity, note) VALUES (?,?, 'installation', -1, ?)`)
        .run(product_id, user.id, `Installation #${info.lastInsertRowid} (hors-ligne)`);
      if (product.payg && product.nb_installments > 1) {
        const perInstall = Math.round((product.price / product.nb_installments) * 100) / 100;
        const insSched = db.prepare(`INSERT INTO installments (installation_id, customer_id, agent_id, due_date, amount) VALUES (?,?,?,?,?)`);
        buildScheduleDates(product.nb_installments).forEach((dueStr, k) => {
          const amount = k === 0 ? Math.round((product.price - perInstall * (product.nb_installments - 1)) * 100) / 100 : perInstall;
          insSched.run(info.lastInsertRowid, customer.id, user.id, dueStr, amount);
        });
      }
      const comm = Math.round(product.price * (product.commission_rate / 100) * 100) / 100;
      if (comm > 0) db.prepare(`INSERT INTO commissions (agent_id, installation_id, amount) VALUES (?,?,?)`).run(user.id, info.lastInsertRowid, comm);
      db.prepare(`UPDATE customers SET status = 'installé' WHERE id = ?`).run(customer.id);
      break;
    }
    case 'record_payment': {
      const { customer_id, amount, method, ref, notes, installment_id, installation_id } = payload;
      const amountNum = Number(amount);
      if (!customer_id || !Number.isFinite(amountNum) || amountNum <= 0) throw new Error('customer_id et montant valide requis');
      if (amountNum > 100000000) throw new Error('Montant trop élevé.');
      const cents = Math.round(amountNum * 100);
      if (Math.abs(amountNum - cents / 100) > 1e-9) throw new Error('Montant avec trop de décimales (maximum 2).');
      if (method && !['cash', 'mobile_money', 'bank', 'card'].includes(method)) throw new Error('Méthode de paiement invalide.');
      const customer = getCustomerOrThrow(user, customer_id);
      let installment = null;
      if (installment_id) {
        installment = db.prepare('SELECT * FROM installments WHERE id = ?').get(installment_id);
        if (!installment) throw new Error('Échéance introuvable.');
        if (installment.customer_id !== customer.id) throw new Error(`Échéance hors périmètre de ce client.`);
      }
      if (installation_id) {
        const inst = db.prepare('SELECT * FROM installations WHERE id = ?').get(installation_id);
        if (!inst) throw new Error('Installation introuvable.');
        if (inst.customer_id !== customer.id) throw new Error(`Installation hors périmètre de ce client.`);
      }
      const finalAmount = cents / 100;
      const info = db.prepare(`INSERT INTO payments (customer_id, agent_id, amount, method, ref, notes, installment_id, installation_id) VALUES (?,?,?,?,?,?,?,?)`)
        .run(customer.id, user.id, finalAmount, method || 'cash', ref || '', notes || '', installment_id || null, installation_id || null);
    if (installment && installment.status === 'pending') {
      const cumul = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE installment_id = ?').get(installment.id).s;
      if (cumul >= installment.amount) {
        db.prepare(`UPDATE installments SET status='paid', paid_date=date('now','localtime'), payment_id=? WHERE id=? AND status='pending'`)
          .run(info.lastInsertRowid, installment.id);
      }
    }
    // Commission TAKATA sur encaissement hors-ligne (identique au chemin en ligne) :
    // renouvellement d'abonnement = 5 % ; séance à la carte = commission_rate (20 % → 500 FC)
    const productRow = installation_id
      ? db.prepare(`SELECT p.* FROM installations i JOIN products p ON p.id = i.product_id WHERE i.id = ?`).get(installation_id)
      : db.prepare(`SELECT p.* FROM installations i JOIN products p ON p.id = i.product_id WHERE i.customer_id = ? ORDER BY i.id DESC LIMIT 1`).get(customer.id);
    const rate = productRow ? (productRow.payg ? 5 : productRow.commission_rate) : 5;
    const comm = Math.round(finalAmount * (rate / 100) * 100) / 100;
    if (comm > 0) db.prepare(`INSERT INTO commissions (agent_id, payment_id, installation_id, amount) VALUES (?,?,?,?)`)
      .run(user.id, info.lastInsertRowid, installation_id || null, comm);
      break;
    }
    default:
      throw new Error(`Opération inconnue : ${op}`);
  }
}

module.exports = router;
