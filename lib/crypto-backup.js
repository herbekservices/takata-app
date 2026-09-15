// lib/crypto-backup.js — Chiffrement des sauvegardes de base (AES-256-GCM)
// Clé fournie par la variable d'environnement TAKATA_BACKUP_KEY (conservée HORS LIGNE).
'use strict';
const crypto = require('crypto');

function key() {
  const k = process.env.TAKATA_BACKUP_KEY;
  if (!k) return null;
  return crypto.createHash('sha256').update(String(k), 'utf8').digest(); // 32 octets
}

function enabled() { return !!process.env.TAKATA_BACKUP_KEY; }

// Retourne un Buffer JSON contenant {iv, tag, data} en base64
function encrypt(buf) {
  const k = key();
  if (!k) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const data = Buffer.concat([c.update(buf), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.from(JSON.stringify({
    v: 1, alg: 'aes-256-gcm',
    iv: iv.toString('base64'), tag: tag.toString('base64'), data: data.toString('base64'),
  }), 'utf8');
}

// Inverse de encrypt() : reçoit le Buffer JSON, retourne la base d'origine
function decrypt(jsonBuf) {
  const k = key();
  if (!k) throw new Error('TAKATA_BACKUP_KEY absent');
  const j = JSON.parse(jsonBuf.toString('utf8'));
  if (!j || !j.iv || !j.tag || !j.data) throw new Error('format de sauvegarde invalide');
  const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(j.iv, 'base64'));
  d.setAuthTag(Buffer.from(j.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(j.data, 'base64')), d.final()]);
}

module.exports = { encrypt, decrypt, enabled };
