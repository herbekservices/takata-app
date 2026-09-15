// start.js — Démarrage Takata Kwetu : restaure la base depuis le dépôt GitHub privé si absente,
// puis lance le serveur (hébergeurs à système de fichiers éphémère, ex. Render plan gratuit).
'use strict';
const fs = require('fs');
const path = require('path');

const DB = process.env.TAKATA_DB || path.join(__dirname, 'data', 'takata.db');
const REPO = process.env.GH_BACKUP_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const GH_PATH = process.env.GH_BACKUP_PATH || 'data/takata.db';

(async () => {
  if (REPO && TOKEN && !fs.existsSync(DB)) {
    try {
      // 1) sauvegarde chiffree en priorite
      let res = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + GH_PATH + '.enc', {
        headers: { Authorization: 'Bearer ' + TOKEN, 'User-Agent': 'takata-boot', Accept: 'application/vnd.github+json' },
      });
      if (res.ok) {
        const j = await res.json();
        const cryptoBackup = require('./lib/crypto-backup');
        const raw = cryptoBackup.decrypt(Buffer.from(j.content, 'base64'));
        fs.mkdirSync(path.dirname(DB), { recursive: true });
        fs.writeFileSync(DB, raw);
        console.log('[persist] base restauree depuis la sauvegarde CHIFFREE (' + raw.length + ' octets)');
      } else {
      // 2) repli : ancienne sauvegarde en clair
      res = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + GH_PATH, {
        headers: { Authorization: 'Bearer ' + TOKEN, 'User-Agent': 'takata-boot', Accept: 'application/vnd.github+json' },
      });
      if (res.ok) {
        const j = await res.json();
        fs.mkdirSync(path.dirname(DB), { recursive: true });
        fs.writeFileSync(DB, Buffer.from(j.content, 'base64'));
        console.log('[persist] base restaurée depuis GitHub (' + j.content.length + ' octets base64)');
      } else {
        console.log('[persist] aucune sauvegarde distante (HTTP ' + res.status + ')');
      }
      }
    } catch (e) {
      console.error('[persist] restauration impossible : ' + e.message);
    }
  } else if (fs.existsSync(DB)) {
    console.log('[persist] base locale existante');
  }
  require('./server.js');
})();
