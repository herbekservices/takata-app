// tests/dump_log.js — dump des lignes clés d'un log (détection UTF-16LE)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '..', '..', '.cluster', 'takata-roles-v3');
const f = process.argv[2] || 'resultat_roles_v32.txt';
const raw = fs.readFileSync(path.join(dir, f));
let text;
if (raw[0] === 0xFF && raw[1] === 0xFE) { text = raw.toString('utf16le'); console.log('[encodage: UTF-16LE]'); }
else { text = raw.toString('utf8'); console.log('[encodage: UTF-8]'); }
const lines = text.split(/\r?\n/);
lines.forEach((l, i) => {
  if (/R..SULTAT|❌|échoué|Erreur/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 140));
});