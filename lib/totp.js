// lib/totp.js — Double authentification TOTP (RFC 6238) sans dépendance externe
'use strict';
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

// Code à 6 chiffres pour un compteur donné (HMAC-SHA1)
function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 4294967296), 0);
  buf.writeUInt32BE(counter % 4294967296, 4);
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = h[h.length - 1] & 0x0f;
  const code = (((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3]) % 1000000;
  return String(code).padStart(6, '0');
}

function totp(secret, t = Date.now(), step = 30) {
  return hotp(secret, Math.floor(t / 1000 / step));
}

// Vérifie un code, avec une tolérance d'une période avant/après (horloges mobiles)
function verify(secret, code, window = 1, step = 30) {
  if (!secret || !code) return false;
  const c = String(code).trim().replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  const counter = Math.floor(Date.now() / 1000 / step);
  for (let i = -window; i <= window; i++) {
    if (hotp(secret, counter + i) === c) return true;
  }
  return false;
}

function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

// URI à saisir dans Google Authenticator / Authy (ou via QR)
function otpauthUri(secret, label, issuer = 'Takata Kwetu') {
  return 'otpauth://totp/' + encodeURIComponent(issuer) + ':' + encodeURIComponent(label) +
    '?secret=' + secret + '&issuer=' + encodeURIComponent(issuer) + '&digits=6&period=30&algorithm=SHA1';
}

module.exports = { generateSecret, totp, verify, otpauthUri, base32Encode, base32Decode };
