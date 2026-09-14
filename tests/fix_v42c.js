// tests/fix_v42c.js — check §7 : cohérence vue globale ↔ somme réelle (plus de seuil figé)
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tests', 'roles_test.js');
let s = fs.readFileSync(p, 'utf8');
const out = [];
let miss = 0;

const oldCheck = "  check('direction voit tous les mouvements (encaissements incl. E2E)', ov.status === 200 && Number(ov.data.totalPaid) >= 2500, 'totalPaid=' + ov.data.totalPaid);";
const newCheck = [
  "  // Cohérence : la vue globale doit refléter exactement la somme des paiements du périmètre",
  "  const { data: allPays } = await api('GET', '/payments', null, admin2);",
  "  const paySum = (allPays || []).reduce((acc, p) => acc + Number(p.amount), 0);",
  "  check('direction : vue globale cohérente avec la somme réelle (' + paySum + ' FC encaissés)', ov.status === 200 && Number(ov.data.totalPaid) === paySum, 'overview=' + ov.data.totalPaid + ' vs paiements=' + paySum);"
].join('\n');
if (s.includes(oldCheck)) { s = s.replace(oldCheck, newCheck); out.push('roles_test: check §7 direction remplacé (cohérence)'); }
else { out.push('  ⚠️ roles_test: check §7 direction non trouvé'); miss++; }
fs.writeFileSync(p, s, 'utf8');
console.log(out.join('\n'));