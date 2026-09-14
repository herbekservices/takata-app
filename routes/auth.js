// routes/auth.js — Connexion / déconnexion / profil (avec rate-limiting)
const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword, createToken, deleteToken, revokeAllTokens, requireAuth, requireAdmin, ROLE, isSuper } = require('../auth');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, username: u.username, full_name: u.full_name, phone: u.phone, role: u.role, region: u.region, active: u.active, created_at: u.created_at };
}

// --- Rate-limiting du login : 5 échecs / 15 min, par IP réelle ET par compte ---
// L'en-tête X-Forwarded-For fourni par le client n'est JAMAIS utilisé (spoofable) :
// en local, l'IP est req.socket.remoteAddress ; derrière un proxy de confiance,
// configurer app.set('trust proxy', 1) côté serveur.
const loginAttempts = new Map(); // clé -> { count, resetAt }  (clés : ip:<ip> et user:<username>)
const MAX_FAILS = 5;          // par COMPTE (5 échecs / 60 s)
const MAX_FAILS_IP = 20;      // par IP (20 échecs / 15 min : plusieurs personnes peuvent partager l'IP (tunnel, NAT, Wi-Fi du bureau))
const USER_WINDOW_MS = 60 * 1000;        // verrou par compte (adouci : 1 min)
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 2000; // borne mémoire de la Map

function pruneRateMap() {
  if (loginAttempts.size > MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of loginAttempts) {
      if (now > v.resetAt) loginAttempts.delete(k);
    }
  }
}

function rateState(key, windowMs) {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec || now > rec.resetAt) {
    return { count: 0, resetAt: now + windowMs };
  }
  return rec;
}

function isRateLimited(key, windowMs, maxFails = MAX_FAILS) {
  pruneRateMap();
    return rateState(key, windowMs).count >= maxFails;
}

function registerFailure(key, windowMs) {
    const rec = rateState(key, windowMs);
  rec.count += 1;
  loginAttempts.set(key, rec);
}

function clearRateKeys(ipKey, userKey) {
  loginAttempts.delete(ipKey);
  loginAttempts.delete(userKey);
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  // Derrière un tunnel/proxy (TRUST_PROXY actif), req.ip = vraie IP client ;
  // sinon on retombe sur la socket (usage local).
  const ipKey = 'ip:' + ((req.ip || (req.socket && req.socket.remoteAddress)) || '?');
  const userKey = 'user:' + String(((req.body || {}).username || '')).trim().toLowerCase();
  const retryAfter = () => Math.ceil((Math.max(rateState(ipKey, WINDOW_MS).resetAt, rateState(userKey, USER_WINDOW_MS).resetAt) - Date.now()) / 1000);

  if (isRateLimited(ipKey, WINDOW_MS, MAX_FAILS_IP) || isRateLimited(userKey, USER_WINDOW_MS)) {
    return res.status(429).json({ error: `Trop de tentatives. Réessayez dans ${retryAfter()}s.` });
  }
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  // Message identique pour tout échec (compte inexistant, mauvais mot de passe, compte désactivé)
  // pour ne pas révéler l'existence d'un compte.
  if (!user || !verifyPassword(password, user.password_hash) || !user.active) {
    registerFailure(ipKey, WINDOW_MS);
    registerFailure(userKey, USER_WINDOW_MS);
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }
  clearRateKeys(ipKey, userKey);
  const token = createToken(user.id);
  res.json({ token, user: publicUser(user) });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  deleteToken(req.token);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// POST /api/auth/change-password — révoque toutes les sessions existantes
router.post('/change-password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next || String(next).length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(current, user.password_hash)) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id);
  revokeAllTokens(user.id);
  res.json({ ok: true });
});

// Admin : créer un compte (agent commercial, technicien, superviseur comm/tech)
// Périmètre : le créateur ne peut créer que des rôles de son niveau ou inférieurs.
// - admin / admingen : tous les rôles opérationnels et superviseurs
// - admincomm : commerciaux (agent) ; admintech : techniciens
// Route retirée : la création de comptes est consolidée dans POST /api/admin/agents
router.post('/register-agent', requireAuth, (req, res) => {
  res.status(410).json({ error: 'Route retirée : créez les comptes via Supervision → Équipes (POST /api/admin/agents).' });
});

function notif2(userId, title, body) {
  try { db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)').run(userId, title, body); } catch (e) {}
}

module.exports = router;