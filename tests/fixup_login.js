// tests/fixup_login.js — répare auth.js (retryAfter) + views.js (virgule x, doublon phone)
const fs = require('fs');
const path = require('path');
const out = [];
let miss = 0;

function load(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\n'); }
function save(f, l) { fs.writeFileSync(path.join(__dirname, '..', f), l.join('\n'), 'utf8'); }
function replaceOnce(lines, f, match, replacement) {
  const i = lines.findIndex((l) => l.includes(match));
  if (i === -1) { out.push(`  ⚠️ ${f}: NON TROUVÉ → ${match.slice(0, 70)}`); miss++; return lines; }
  lines[i] = replacement;
  out.push(`  ${f}: ligne ${i + 1} corrigée`);
  return lines;
}

// 1. auth.js : retryAfter correctement parenthésé
let au = load('routes/auth.js');
const raIdx = au.findIndex((l) => l.includes('Math.ceil(Math.max(rateState(ipKey'));
if (raIdx !== -1) {
  au[raIdx] = "  const retryAfter = () => Math.ceil((Math.max(rateState(ipKey, WINDOW_MS).resetAt, rateState(userKey, USER_WINDOW_MS).resetAt) - Date.now()) / 1000);";
  out.push('auth.js: retryAfter corrigé');
} else out.push('⚠️ auth.js: retryAfter non trouvé');
// rate-limit paramétré (les autres modifications ratées à cause du CRLF)
au = replaceOnce(au, 'routes/auth.js', 'const MAX_FAILS = 5;', 'const MAX_FAILS = 5;\nconst USER_WINDOW_MS = 60 * 1000;        // verrou par compte (adouci : 1 min)');
au = replaceOnce(au, 'routes/auth.js', 'function rateState(key) {', 'function rateState(key, windowMs) {');
au = replaceOnce(au, 'routes/auth.js', 'resetAt: now + WINDOW_MS };', 'resetAt: now + windowMs };');
au = replaceOnce(au, 'routes/auth.js', 'function isRateLimited(key) {', 'function isRateLimited(key, windowMs) {');
au = replaceOnce(au, 'routes/auth.js', 'return rateState(key).count >= MAX_FAILS;', 'return rateState(key, windowMs).count >= MAX_FAILS;');
au = replaceOnce(au, 'routes/auth.js', 'function registerFailure(key) {', 'function registerFailure(key, windowMs) {');
au = replaceOnce(au, 'routes/auth.js', 'const rec = rateState(key);', 'const rec = rateState(key, windowMs);');
au = replaceOnce(au, 'routes/auth.js', 'if (isRateLimited(ipKey) || isRateLimited(userKey)) {', 'if (isRateLimited(ipKey, WINDOW_MS) || isRateLimited(userKey, USER_WINDOW_MS)) {');
au = replaceOnce(au, 'routes/auth.js', '    registerFailure(userKey);', '    registerFailure(userKey, USER_WINDOW_MS);');
au = replaceOnce(au, 'routes/auth.js', '    registerFailure(ipKey);', '    registerFailure(ipKey, WINDOW_MS);');
save('routes/auth.js', au);

// 2. views.js : virgule après l'icône x + suppression du doublon phone
let v = load('public/js/views.js');
const xIdx = v.findIndex((l) => l.includes("x: '<line x1=\"18\" y1=\"6\""));
if (xIdx !== -1 && !v[xIdx].trim().endsWith(',')) {
  v[xIdx] = v[xIdx].trimEnd().replace(/$/, ',');
  out.push('views.js: virgule ajoutée après icône x');
} else out.push('views.js: virgule x déjà présente');
// doublon phone : garder le premier
const phoneIdxs = v.map((l, i) => (l.includes("    phone: '<path d=\"M22 16.92v3") ? i : -1)).filter((i) => i >= 0);
if (phoneIdxs.length > 1) {
  const dupIdx = phoneIdxs[1];
  v.splice(dupIdx, 1);
  out.push('views.js: doublon phone supprimé');
} else out.push('views.js: pas de doublon phone');

save('public/js/views.js', v);

console.log(out.join('\n'));
console.log(miss ? 'FIXUP LOGIN PARTIEL' : 'FIXUP LOGIN OK');