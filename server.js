// server.js — Serveur TAKATA (Express + SQLite + PWA statique)
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
const PORT = process.env.PORT || 8080; // défaut : 8080 (environnement TAKATA pre-prod)

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
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
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

// Ne pas mettre en cache les réponses API (données métier sensibles)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Santé (publique)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'TAKATA', db: 'sqlite', time: new Date().toISOString() });
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
    if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    else if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

// Fallback SPA (routes hashées côté client)
app.get(/^\/(?!api\/).*/, (req, res) => {
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
  console.error('[TAKATA] Erreur :', err && err.message);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

const server = app.listen(PORT, () => {
  console.log(`✅ TAKATA démarré : http://localhost:${PORT}`);
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
function shutdown() {
  console.log('[TAKATA] Arrêt gracieux (checkpoint WAL puis fermeture)…');
  server.close(() => { db.closeDatabase(); process.exit(0); });
  // filet de sécurité : ne pas rester bloqué par une connexion ouverte
  setTimeout(() => { db.closeDatabase(); process.exit(0); }, 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
