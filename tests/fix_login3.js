// tests/fix_login3.js — corrige les 2 lignes de redirection dans fix_login2.js avant exécution
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'fix_login2.js');
let s = fs.readFileSync(p, 'utf8');
const n1 = (s.match(/'#\/logreussi'/g) || []).length;
s = s.split("'#/logreussi'").join("'#/'");
const marker = "location.hash = '#/';\n      setTimeout(() => { location.hash = '#/'; renderRoute(); }, 0);";
if (s.includes(marker)) {
  s = s.replace(marker, "location.hash = '#/';\n      if (typeof renderRoute === 'function') renderRoute();");
  console.log('renderRoute forcé après login');
}
fs.writeFileSync(p, s, 'utf8');
console.log('logreussi → #/ (' + n1 + ' occurrences)');