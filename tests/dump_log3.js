// tests/dump_log3.js — dump des échecs (UTF-16 ou UTF-8)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '..', '..', '.cluster', 'takata-roles-v3');
const f = process.argv[2] || 'resultat_e2e_tech.txt';
const raw = fs.readFileSync(path.join(dir, f));
let text = raw[0] === 0xFF ? raw.toString('utf16le') : raw.toString('utf8');
const lines = text.split(/\r?\n/);
lines.forEach((l, i) => {
  if (/Γ¥î|❌|R..SULTAT/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 160));
});