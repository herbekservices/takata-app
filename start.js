// start.js — Démarrage TAKATA : restaure la base depuis le dépôt GitHub privé si absente,
// puis lance le serveur. (Utilisé comme commande de démarrage sur les hébergeurs à
// système de fichiers éphémère — ex. Render plan gratuit.)
'use strict';
const fs = require('fs');
const path = require('path');

const DB = process.env.TAKATA_DB || path.join(__dirname, 'data', 'takata.db');
const REPO = process.env.GH_BACKUP_REPO;
const TOKEN = proces…KEN;
const GH_PATH = process.env.GH_BACKUP_PATH || 'data/takata.db';

(async () => {
  if (REPO && TOKEN && !fs.existsSync(DB)) {
    try {
      const res = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + GH_PATH, {
        headers: { Authorization: '***' + TOKEN, 'User-Agent': 'takata-boot', Accept: 'application/vnd.github+json' },
      });
      if (res.ok) {
        const j = await res.json();
        fs.mkdirSync(path.dirname(DB), { recursive: true });
        fs.writeFileSync(DB, Buffer.from(j.content, 'base64'));
        console.log('[persist] base restaurée depuis GitHub (' + j.content.length + ' octets base64)');
      } else {
        console.log('[persist] aucune sauvegarde distante (HTTP ' + res.status + ')');
      }
    } catch (e) {
      console.error('[persist] restauration impossible : ' + e.message);
    }
  } else if (fs.existsSync(DB)) {
    console.log('[persist] base locale existante (' + DB + ')');
  }
  require('./server.js');
})();
