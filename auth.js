// auth.js — Authentification : hachage scrypt (crypto intégré), tokens (condensat SHA-256), middlewares
const crypto = require('crypto');
const db = require('./db');

const TOKEN_TTL_DAYS = 30;

// --- Hachage de mot de passe (scrypt, sel aléatoire 16 octets) ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- Tokens : seul le condensat SHA-256 est stocké en base ---
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');

function createToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO tokens (user_id, token, expires_at) VALUES (?,?,?)').run(userId, digest(token), expiresAt);
  return token;
}

function deleteToken(token) {
  db.prepare('DELETE FROM tokens WHERE token = ?').run(digest(token));
}

function revokeAllTokens(userId) {
  db.prepare('DELETE FROM tokens WHERE user_id = ?').run(userId);
}

function userFromToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id
    WHERE t.token = ? AND t.expires_at > datetime('now') AND u.active = 1
  `).get(digest(token));
  return row || null;
}

// --- Middleware Express ---
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Non autorisé. Veuillez vous reconnecter.' });
  req.user = user;
  req.token = token;
  next();
}

// --- Rôles Takata Kwetu ---
// admin / admingen : direction (tout voir, gérer les comptes)
// admincomm       : supervision des équipes commerciales
// admintech       : supervision des équipes techniques
// agent           : commercial (son portefeuille)
// technicien      : opérations terrain (tournées, stock, désinfection)
const ROLE = { ADMIN: 'admin', AGENT: 'agent', TECH: 'technicien', ADMINCOMM: 'admincomm', ADMINTECH: 'admintech', ADMINGEN: 'admingen' };
const SUPER_ROLES = [ROLE.ADMIN, ROLE.ADMINGEN];          // direction : tout + comptes
const ADMIN_ROLES = [ROLE.ADMIN, ROLE.ADMINGEN, ROLE.ADMINCOMM, ROLE.ADMINTECH]; // accès espace admin
const COMM_TEAM = [ROLE.AGENT];                            // équipe commerciale
const TECH_TEAM = [ROLE.TECH];                             // équipe technique

const isSuper = (u) => SUPER_ROLES.includes(u && u.role);
const isAdminLike = (u) => ADMIN_ROLES.includes(u && u.role);
const isCommercial = (u) => u && u.role === ROLE.AGENT;
const isTechnician = (u) => u && u.role === ROLE.TECH;

// Périmètre des équipes dont un superviseur répond :
// admincomm → commerciaux ; admintech → techniciens ; direction → tous
function scopedRoles(user) {
  if (!user) return [];
  if (user.role === ROLE.ADMINCOMM) return COMM_TEAM;
  if (user.role === ROLE.ADMINTECH) return TECH_TEAM;
  if (isSuper(user)) return [...COMM_TEAM, ...TECH_TEAM, ROLE.ADMIN, ROLE.ADMINCOMM, ROLE.ADMINTECH, ROLE.ADMINGEN];
  return [user.role];
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès réservé à un profil autorisé.' });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  if (!req.user || !isSuper(req.user)) {
    return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });
  }
  next();
}

module.exports = {
  hashPassword, verifyPassword, createToken, deleteToken, revokeAllTokens, userFromToken,
  requireAuth, requireAdmin, requireRole,
  ROLE, SUPER_ROLES, ADMIN_ROLES, COMM_TEAM, TECH_TEAM,
  isSuper, isAdminLike, isCommercial, isTechnician, scopedRoles
};