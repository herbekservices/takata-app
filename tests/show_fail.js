// tests/show_fail.js — affiche les échecs des derniers logs de tests (v2)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '..', '..', '.cluster', 'takata-roles-v3');
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.startsWith('resultat_') && f.endsWith('.txt'));
for (const f of files) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) { console.log('absent: ' + f); continue; }
  const raw = fs.readFileSync(p);
  let text;
  if (raw[0] === 0xFF && raw[1] === 0xFE) text = raw.toString('utf16le');
  else text = raw.toString('utf8');
  const lines = text.split(/\r?\n/);
  const fails = lines.filter((l) => l.includes('❌') || l.includes('\u274C'));
  if (fails.length) { console.log('=== ' + f + ' ==='); fails.slice(0, 5).forEach((l) => console.log('  ' + l.trim().slice(0, 160))); }
  const res = lines.find((l) => l.includes('R\u00c9SULTAT') || l.includes('RÉSULTAT'));
  if (res) console.log('  >> ' + res.trim());
}