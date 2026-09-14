// tests/fixup_rate.js — restaure les lignes du rate-limit (indentation + return)
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'routes', 'auth.js');
let s = fs.readFileSync(p, 'utf8').split('\n');
const out = [];

const resetIdx = s.findIndex((l) => l.trim() === 'resetAt: now + windowMs };');
if (resetIdx !== -1) {
  s[resetIdx] = '    return { count: 0, resetAt: now + windowMs };';
  out.push('return restauré (ligne ' + (resetIdx + 1) + ')');
} else out.push('⚠️ resetAt non trouvé');

// Réindentation des lignes déplacées
s = s.map((l) => {
  if (l.trim() === 'return rateState(key, windowMs).count >= MAX_FAILS;') return '    ' + l.trim();
  if (l.trim() === 'const rec = rateState(key, windowMs);') return '    ' + l.trim();
  if (l.trim() === "if (isRateLimited(ipKey, WINDOW_MS) || isRateLimited(userKey, USER_WINDOW_MS)) {") return '  ' + l.trim();
  if (l.trim() === 'registerFailure(userKey, USER_WINDOW_MS);') return '    ' + l.trim();
  if (l.trim() === 'registerFailure(ipKey, WINDOW_MS);') return '    ' + l.trim();
  return l;
});
out.push('indentation rétablie');

fs.writeFileSync(p, s.join('\n'), 'utf8');
console.log(out.join('\n'));