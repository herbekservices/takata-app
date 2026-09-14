// tests/fix_selfid.js — selfId via data.user.id (la route /auth/me emballe l'utilisateur)
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tests', 'security-test.js');
let lines = fs.readFileSync(p, 'utf8').split('\n');
let done = 0;
lines = lines.map((l) => {
  if (l.includes('const selfId = meSelf.data && meSelf.data.id;')) {
    done++;
    return "  const selfId = meSelf.data && ((meSelf.data.user && meSelf.data.user.id) || meSelf.data.id);";
  }
  return l;
});
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log(done === 1 ? 'selfId corrigé (via user.id)' : '⚠️ occurrences: ' + done);