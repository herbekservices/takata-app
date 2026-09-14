// tests/show_fail2.js — échecs des logs (UTF-16 ou UTF-8, filtre mojibake)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', '..', '..', '.cluster', 'takata-roles-v3');
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['resultat_roles_final.txt', 'resultat_smoke_final.txt'];
for (const f of files) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) { console.log('absent: ' + f); continue; }
  const raw = fs.readFileSync(p);
  let text = raw[0] === 0xFF ? raw.toString('utf16le') : raw.toString('utf8');
  // les lignes d'échec : mojibake « Γ¥î » ou vrai « ❌ »
  const lines = text.split(/\r?\n/);
  const fails = lines.filter((l) => l.includes('Γ¥î') || l.includes('❌') || l.includes('Γ¥') && l.includes('=>'));
  console.log('=== ' + f + ' : ' + fails.length + ' échec(s) ===');
  fails.slice(0, 8).forEach((l) => console.log('  ' + l.trim().slice(0, 150)));
  const res = lines.find((l) => /R├ëSULTAT|RÉSULTAT/.test(l));
  if (res) console.log('  >> ' + res.trim().slice(0, 100));
}