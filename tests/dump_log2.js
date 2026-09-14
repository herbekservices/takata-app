// tests/dump_log2.js — filtre mojibake des symboles ✅/❌ dans les logs UTF-16 mal encodés
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '..', '..', '.cluster', 'takata-roles-v3');
const f = process.argv[2] || 'resultat_roles_v32.txt';
const raw = fs.readFileSync(path.join(dir, f));
let text;
if (raw[0] === 0xFF && raw[1] === 0xFE) { text = raw.toString('utf16le'); }
else { text = raw.toString('utf8'); }
const lines = text.split(/\r?\n/);
// « ✅ » (E2 9D 8C) et « ❌ » (E2 9D 8C inverse) deviennent « Γ£à » / « Γ¥î » dans le mojibake
lines.forEach((l, i) => {
  if (/Γ¥î|Γ£à/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 130));
});