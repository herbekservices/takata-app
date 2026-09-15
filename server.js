// server.js — Serveur Takata Kwetu (Express + SQLite + PWA statique)
const express = require('express');
const path = require('path');
const compression = require('compression');
const db = require('./db');
const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agent');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/reports');
const syncRoutes = require('./routes/sync');
const techRoutes = require('./routes/tech');

const app = express();
const PORT = process.env.PORT || 8080; // défaut : 8080 (environnement Takata Kwetu pre-prod)

app.disable('x-powered-by');

// Derrière un proxy (Render/Fly/nginx) : vraie IP client pour le rate-limit
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use(express.json({ limit: '64kb' })); // borne anti-abus (les lots de sync tiennent largement)
app.use(compression());

// Sécurité de base
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
  // HSTS : impose HTTPS pendant 1 an (protection contre le downgrade / MITM)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; script-src-attr 'unsafe-inline'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'self'; manifest-src 'self'; upgrade-insecure-requests");
  next();
});

// Anti-CSRF : les mutations doivent provenir de la même origine (aucun CORS ouvert)
// localhost et 127.0.0.1 sont équivalents (usage local pré-production).
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = String(req.headers.origin || req.headers.referer || '');
    const host = String(req.headers.host || '');
    if (origin && host) {
      let originHost = '';
      try { originHost = new URL(origin).host; } catch (e) { originHost = ''; }
      const hostName = host.split(':')[0];
      const originName = originHost.split(':')[0];
      const equivalent = (originName === 'localhost' || originName === '127.0.0.1') && (hostName === 'localhost' || hostName === '127.0.0.1');
      if (originHost && originHost !== host && !equivalent) {
        return res.status(403).json({ error: 'Origine non autorisée.' });
      }
    }
  }
  next();
});

// Journal d audit generique : toute mutation API est enregistree (qui, quoi, quand, IP)
app.use('/api', (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (req.path.startsWith('/auth/login')) return next(); // journalise finement dans auth.js
  res.on('finish', () => {
    try {
      if (res.statusCode >= 400) return;
      const { logAudit } = require('./lib/audit');
      logAudit(req, req.method + ' ' + req.baseUrl + req.path, req.baseUrl + req.path, (req.params && req.params.id) || null, 'status ' + res.statusCode + ' | audit_generique');
    } catch (e) { /* jamais bloquant */ }
  });
  next();
});
// Ne pas mettre en cache les réponses API (données métier sensibles)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Limiteur global anti-abus : 600 requetes / 15 min par IP sur /api (hors /api/health)
const apiHits = new Map();
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || '?';
  const now = Date.now(), WINDOW = 15 * 60 * 1000, MAX = 600;
  const e = apiHits.get(ip);
  if (!e || now - e.start > WINDOW) { apiHits.set(ip, { start: now, n: 1 }); return next(); }
  e.n += 1;
  if (apiHits.size > 5000) { for (const [k, v] of apiHits) { if (now - v.start > WINDOW) apiHits.delete(k); } }
  if (e.n > MAX) { res.setHeader('Retry-After', '900'); return res.status(429).json({ error: 'Trop de requetes. Reessayez plus tard.' }); }
  next();
});

// Santé (publique)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'Takata Kwetu', db: 'sqlite', time: new Date().toISOString() });
});

// API
app.use('/api/auth', authRoutes);
app.use('/api', agentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/tech', techRoutes);

// Fichiers statiques PWA — le service worker ne doit jamais être mis en cache HTTP
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  index: 'index.html',
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    else if (/\.(png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(filePath) || filePath.includes('icons')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        // JS/CSS : revalidation systematique (evite qu'un ancien shell reste figé sur les appareils)
        else if (/\.(js|css)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
    else if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

// Fallback SPA (routes hashées côté client)
app.get(/^\/(?!api\/).*/, (req, res) => {
  // Ne renvoyer l'application que pour les routes client (pas pour /data/... , /server.js ...)
  if (path.extname(req.path)) return res.status(404).type('txt').send('Not Found');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 JSON générique pour les routes API inconnues
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ressource introuvable.' });
});

// Gestion d'erreurs — traduit les contraintes SQLite en réponses HTTP propres,
// message générique sinon (le détail reste dans les logs serveur).
app.use((err, req, res, next) => {
  const code = err && err.code;
  if (code === 'SQLITE_CONSTRAINT_CHECK') {
    return res.status(400).json({ error: 'Valeur non autorisée pour ce champ.' });
  }
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(409).json({ error: 'Opération impossible : cette donnée est référencée ailleurs.' });
  }
  if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'Cette valeur existe déjà.' });
  }
if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Requête trop volumineuse.' });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Requête invalide (JSON malformé).' });
  }
  console.error('[Takata Kwetu] Erreur :', err && err.message);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Takata Kwetu démarré : http://localhost:${PORT}`);
  console.log(`   Admin par défaut : admin / admin123  (voir seed.js)`);
});

// Production : alerter si les comptes de démonstration sont encore actifs
if (process.env.NODE_ENV === 'production') {
  try {
    const defaults = db.prepare("SELECT username FROM users WHERE username IN ('admin','admincomm','admintech','agent1','technicien1') AND active = 1").all();
    if (defaults.length) console.warn('⚠️  SÉCURITÉ : comptes de démonstration encore actifs (' + defaults.map((u) => u.username).join(', ') + ') — changez les mots de passe avant lancement public.');
  } catch (e) { /* base non initialisée */ }
}

// Arrêt gracieux (D-07) : plus de WAL corrompu sur Ctrl+C / kill propre
// Sauvegardes périodiques de la base vers le dépôt GitHub privé (hébergeurs à FS éphémère)
try { require('./persist').start(db); } catch (e) { console.error('[persist] démarrage impossible : ' + (e && e.message)); }

function shutdown() {
  console.log('[Takata Kwetu] Arrêt gracieux (checkpoint WAL puis fermeture)…');
  server.close(() => { db.closeDatabase(); process.exit(0); });
  // filet de sécurité : ne pas rester bloqué par une connexion ouverte
  setTimeout(() => { db.closeDatabase(); process.exit(0); }, 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
