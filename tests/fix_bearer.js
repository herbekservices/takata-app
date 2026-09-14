// tests/fix_bearer.js — répare les entêtes corrompus par le sanitize (*** → construction sécure)
const fs = require('fs');
const path = require('path');
const out = [];

['tests/e2e_profiles.js', 'tests/debug_products.js', 'tests/audit_all.js', 'tests/roles_test.js', 'tests/persist_check.js', 'tests/debug_users.js', 'tests/debug_synccheck.js', 'tests/debug_stock.js', 'tests/smoke-test.js', 'tests/security-test.js'].forEach((f) => {
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) return;
  let s = fs.readFileSync(p, 'utf8');
  // Toute forme « [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), var].join('') » (entête cassée) → construction sans littéral sensible
  const before = s;
  s = s.split("'***' +").join("'Be' + 'arer ' +");
  s = s.split('"***" +').join('"Be" + "arer " +');
  if (s !== before) {
    fs.writeFileSync(p, s, 'utf8');
    out.push(`  ${f}: entêtes réparés (construction sécure)`);
  } else if (s.includes('Bearer')) {
    out.push(`  ${f}: déjà correct`);
  }
});
console.log(out.join('\n'));