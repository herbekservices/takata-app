// tests/fix_login.js — croix rouge d'erreur + œil mot de passe + rate-limit compte adouci
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
  out.push(`  ${f}: ${match.slice(0, 55)}`);
  return lines;
}

// ================= 1. routes/auth.js : verrou compte 60 s (IP reste 15 min) =================
let au = load('routes/auth.js');
au = replaceOnce(au, 'routes/auth.js',
  "const MAX_FAILS = 5;\nconst WINDOW_MS = 15 * 60 * 1000;",
  "const MAX_FAILS = 5;\nconst WINDOW_MS = 15 * 60 * 1000;      // verrou par IP\nconst USER_WINDOW_MS = 60 * 1000;        // verrou par compte (adouci : 1 min)");
au = replaceOnce(au, 'routes/auth.js',
  "function rateState(key) {",
  "function rateState(key, windowMs) {");
au = replaceOnce(au, 'routes/auth.js',
  "  if (!rec || now > rec.resetAt) {\n    return { count: 0, resetAt: now + WINDOW_MS };\n  }",
  "  if (!rec || now > rec.resetAt) {\n    return { count: 0, resetAt: now + windowMs };\n  }");
au = replaceOnce(au, 'routes/auth.js',
  "function isRateLimited(key) {\n  pruneRateMap();\n  return rateState(key).count >= MAX_FAILS;\n}",
  "function isRateLimited(key, windowMs) {\n  pruneRateMap();\n  return rateState(key, windowMs).count >= MAX_FAILS;\n}");
au = replaceOnce(au, 'routes/auth.js',
  "function registerFailure(key) {\n  const rec = rateState(key);",
  "function registerFailure(key, windowMs) {\n  const rec = rateState(key, windowMs);");
au = replaceOnce(au, 'routes/auth.js',
  "  const retryAfter = () => Math.ceil((rateState(ipKey).resetAt - Date.now()) / 1000);",
  "  const retryAfter = () => Math.ceil(Math.max(rateState(ipKey, WINDOW_MS).resetAt, rateState(userKey, USER_WINDOW_MS).resetAt) - Date.now()) / 1000);");
au = replaceOnce(au, 'routes/auth.js',
  "  if (isRateLimited(ipKey) || isRateLimited(userKey)) {",
  "  if (isRateLimited(ipKey, WINDOW_MS) || isRateLimited(userKey, USER_WINDOW_MS)) {");
au = replaceOnce(au, 'routes/auth.js',
  "    registerFailure(ipKey);\n    registerFailure(userKey);",
  "    registerFailure(ipKey, WINDOW_MS);\n    registerFailure(userKey, USER_WINDOW_MS);");
save('routes/auth.js', au);

// ================= 2. views.js : formulaire de connexion premium =================
let v = load('public/js/views.js');

// Formulaire : wrap œil + zones d'erreur
v = replaceOnce(v, 'public/js/views.js',
  "        <div class=\"field\"><label for=\"login-username\">Nom d'utilisateur</label><input id=\"login-username\" name=\"username\" autocomplete=\"username\" placeholder=\"ex. agent1\" required></div>\n        <div class=\"field\"><label for=\"login-password\">Mot de passe</label><input id=\"login-password\" name=\"password\" type=\"password\" autocomplete=\"current-password\" placeholder=\"••••••\" required></div>",
  [
    "        <div class=\"field\" id=\"field-user\">",
    "          <label for=\"login-username\">Nom d'utilisateur</label>",
    "          <input id=\"login-username\" name=\"username\" autocomplete=\"username\" placeholder=\"ex. agent1\" required>",
    "          <div class=\"field-error\" id=\"err-user\"></div>",
    "        </div>",
    "        <div class=\"field\" id=\"field-pass\">",
    "          <label for=\"login-password\">Mot de passe</label>",
    "          <div class=\"pass-wrap\">",
    "            <input id=\"login-password\" name=\"password\" type=\"password\" autocomplete=\"current-password\" placeholder=\"••••••\" required>",
    "            <button type=\"button\" class=\"pass-eye\" onclick=\"TAKATA_VIEWS.togglePassword()\" aria-label=\"Afficher ou masquer le mot de passe\" id=\"eye-btn\">${icon('eye', 18)}</button>",
    "          </div>",
    "          <div class=\"field-error\" id=\"err-pass\"></div>",
    "        </div>",
    "        <div class=\"login-error\" id=\"login-error\" style=\"display:none\"></div>"
  ].join('\n'));

// submitLogin : gestion d'erreur visuelle + toggle
v = replaceOnce(v, 'public/js/views.js',
  "  async function submitLogin(e) {\n    if (e) e.preventDefault();\n    const f = new FormData(e.target);\n    const username = f.get('username');\n    const password = f.get('password');\n    const btn = e.target.querySelector('.btn');\n    btn.disabled = true; btn.textContent = 'Connexion…';\n    try {\n      await TAKATA.login(username, password);\n      toast('Bienvenue');\n      location.hash = '#/';\n    } catch (err) {\n      toast(err.message || 'Erreur de connexion', true);\n      btn.disabled = false; btn.textContent = 'Se connecter';\n    }\n  }",
  [
    "  function togglePassword() {",
    "    const input = document.getElementById('login-password');",
    "    const btn = document.getElementById('eye-btn');",
    "    if (!input || !btn) return;",
    "    const show = input.type === 'password';",
    "    input.type = show ? 'text' : 'password';",
    "    btn.innerHTML = icon(show ? 'eyeOff' : 'eye', 18);",
    "    btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');",
    "  }",
    "",
    "  function loginError(html) {",
    "    const box = document.getElementById('login-error');",
    "    if (!box) return;",
    "    box.innerHTML = html;",
    "    box.style.display = 'flex';",
    "  }",
    "",
    "  function clearLoginErrors() {",
    "    ['err-user', 'err-pass'].forEach((id) => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });",
    "    ['field-user', 'field-pass'].forEach((id) => { const el = document.getElementById(id); if (el) el.classList.remove('has-error'); });",
    "    const box = document.getElementById('login-error');",
    "    if (box) box.style.display = 'none';",
    "  }",
    "",
    "  async function submitLogin(e) {",
    "    if (e) e.preventDefault();",
    "    clearLoginErrors();",
    "    const f = new FormData(e.target);",
    "    const username = f.get('username');",
    "    const password = f.get('password');",
    "    const btn = e.target.querySelector('.btn');",
    "    btn.disabled = true; btn.textContent = 'Connexion…';",
    "    try {",
    "      await TAKATA.login(username, password);",
    "      toast('Bienvenue');",
    "      location.hash = '#/';",
    "    } catch (err) {",
    "      btn.disabled = false; btn.textContent = 'Se connecter';",
    "      const cross = icon('x', 14);",
    "      if (err.status === 401) {",
    "        document.getElementById('field-user').classList.add('has-error');",
    "        document.getElementById('field-pass').classList.add('has-error');",
    "        document.getElementById('err-user').innerHTML = cross + ' Identifiant ou mot de passe incorrect';",
    "        loginError(cross + ' Identifiant ou mot de passe incorrect. Vérifiez puis réessayez.');",
    "      } else if (err.status === 429) {",
    "        loginError(cross + ' ' + (err.message || 'Trop de tentatives. Patientez un instant puis réessayez.'));",
    "      } else if (err.status === 0) {",
    "        loginError(cross + ' Serveur non joignable — démarrez le serveur TAKATA (npm start) et réessayez.');",
    "      } else {",
    "        toast(err.message || 'Erreur de connexion', true);",
    "      }",
    "    }",
    "  }"
  ].join('\n'));

// Icônes eye / eyeOff / x dans le jeu ICONS
const iconsAnchor = v.findIndex((l) => l.includes("    edit: '<path d=\"M12 20h9\""));
if (iconsAnchor !== -1) {
  v.splice(iconsAnchor + 1, 0,
    "    eye: '<path d=\"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>',",
    "    eyeOff: '<path d=\"M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24\"/><line x1=\"1\" y1=\"1\" x2=\"23\" y2=\"23\"/>',",
    "    x: '<line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>'");
  out.push('  views: icônes eye/eyeOff/x ajoutées');
} else { out.push('  ⚠️ views: ancre ICONS edit non trouvée'); miss++; }

save('public/js/views.js', v);

// ================= 3. CSS : erreurs + œil =================
let c = load('public/css/takata.css');
c = replaceOnce(c, 'public/css/takata.css',
  ".field input:focus-visible, .field select:focus-visible, .field textarea:focus-visible { outline: 2px solid var(--green); outline-offset: 1px; }",
  [
    ".field input:focus-visible, .field select:focus-visible, .field textarea:focus-visible { outline: 2px solid var(--green); outline-offset: 1px; }",
    ".field.has-error input { border-color: var(--red); background: #FDF7F5; }",
    ".field.has-error label { color: var(--red); }",
    ".field-error { display: flex; align-items: center; gap: 5px; color: var(--red); font-size: 12px; font-weight: 500; margin-top: 5px; }",
    ".field-error .ico { color: var(--red); }",
    ".pass-wrap { position: relative; }",
    ".pass-wrap input { padding-right: 44px; }",
    ".pass-eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: none;",
    "  color: var(--text-muted); cursor: pointer; padding: 7px; display: grid; place-items: center; border-radius: var(--radius); }",
    ".pass-eye:hover { color: var(--text); background: #F4F5F3; }",
    ".login-error { display: flex; align-items: flex-start; gap: 8px; background: #FDF7F5; border: 1px solid #F0D8CC;",
    "  color: var(--red); font-size: 13px; font-weight: 500; padding: 12px 14px; border-radius: var(--radius); margin-bottom: 14px; }",
    ".login-error .ico { color: var(--red); flex: none; margin-top: 1px; }"
  ].join('\n'));
save('public/css/takata.css', c);

console.log(out.join('\n'));
console.log(miss ? 'FIX LOGIN PARTIEL' : 'FIX LOGIN OK');