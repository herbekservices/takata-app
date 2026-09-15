// persist.js — Persistance de secours de la base SQLite via un dépôt GitHub privé
// (utile sur les hébergeurs à système de fichiers éphémère, ex. Render plan gratuit).
// Activation : variables d'environnement GITHUB_TOKEN + GH_BACKUP_REPO.
'use strict';
const fs = require('fs');

const REPO = process.env.GH_BACKUP_REPO;                        // ex. herbekservices/takata-data
const GH_PATH = process.env.GH_BACKUP_PATH || 'data/takata.db'; // chemin dans le dépôt
const TOKEN = process.env.GITHUB_TOKEN;
const BRANCH = process.env.GH_BACKUP_BRANCH || 'main';
const INTERVAL_MS = Number(process.env.GH_BACKUP_INTERVAL_MS || 10 * 60 * 1000);

const enabled = () => !!(REPO && TOKEN);

function api(url, opts) {
  return fetch(url, Object.assign({
    headers: { Authorization: 'token ' + TOKEN, 'User-Agent': 'takata-backup', Accept: 'application/vnd.github+json' }
  }, opts || {}));
}

// Sauvegarde immédiate de la base (checkpoint WAL puis upload base64 sur GitHub)
async function backupNow(db) {
  if (!enabled()) return { skipped: true };
  try {
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { /* WAL déjà vidé */ }
    const file = db.name;
    const raw = fs.readFileSync(file);
    const cryptoBackup = require('./lib/crypto-backup');
    const useEnc = cryptoBackup.enabled();
    // Si une cle est fournie, la sauvegarde est CHIFFREE (AES-256-GCM) avant envoi
    const payload = useEnc ? cryptoBackup.encrypt(raw) : raw;
    const targetPath = useEnc ? (GH_PATH + '.enc') : GH_PATH;
    const content = payload.toString('base64');
    let sha;
    const cur = await api(`https://api.github.com/repos/${REPO}/contents/${targetPath}?ref=${BRANCH}`);
    if (cur.status === 200) sha = (await cur.json()).sha;
    const body = JSON.stringify({
      message: 'sauvegarde base Takata Kwetu ' + new Date().toISOString(),
      content,
      sha,
      branch: BRANCH,
    });
    const put = await api(`https://api.github.com/repos/${REPO}/contents/${targetPath}`, { method: 'PUT', body });
    const ok = put.status === 200 || put.status === 201;
    console.log('[persist] sauvegarde ' + (ok ? 'OK' : 'ECHEC HTTP ' + put.status) + (useEnc ? ' (chiffree AES-256-GCM)' : ' (en clair)'));
    return { ok };
  } catch (e) {
    console.error('[persist] sauvegarde impossible : ' + e.message);
    return { ok: false, error: e.message };
  }
}

// Démarre les sauvegardes périodiques (la sauvegarde d'arrêt est gérée par server.js)
function start(db) {
  if (!enabled()) { console.log('[persist] désactivé (GITHUB_TOKEN/GH_BACKUP_REPO absents)'); return; }
  console.log('[persist] actif → ' + REPO + '/' + GH_PATH + ' toutes les ' + Math.round(INTERVAL_MS / 60000) + ' min');
  setTimeout(() => { backupNow(db); }, 60 * 1000);
  setInterval(() => { backupNow(db); }, INTERVAL_MS);
}

module.exports = { backupNow, start, enabled };
