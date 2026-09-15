// tests/fix_login2.js — croix rouge + œil mdp (version simple, texte entier)
const fs = require('fs');
const path = require('path');
const out = [];
let miss = 0;

const vf = path.join(__dirname, '..', 'public', 'js', 'views.js');
let v = fs.readFileSync(vf, 'utf8');

function rep(match, replacement) {
  if (!v.includes(match)) { out.push(`  ⚠️ views: NON TROUVÉ → ${match.slice(0, 60)}`); miss++; return; }
  v = v.replace(match, replacement);
  out.push(`  views: ${match.slice(0, 50)}`);
}

// 1. Champs de connexion avec œil + zones d'erreur
rep(
  '        <div class="field"><label for="login-username">Nom d\'utilisateur</label><input id="login-username" name="username" autocomplete="username" placeholder="ex. agent1" required></div>',
  [
    '        <div class="field" id="field-user">',
    '          <label for="login-username">Nom d\'utilisateur</label>',
    '          <input id="login-username" name="username" autocomplete="username" placeholder="ex. agent1" required>',
    '          <div class="field-error" id="err-user"></div>',
    '        </div>'
  ].join('\n')
);
rep(
  '        <div class="field"><label for="login-password">Mot de passe</label><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="••••••" required></div>',
  [
    '        <div class="field" id="field-pass">',
    '          <label for="login-password">Mot de passe</label>',
    '          <div class="pass-wrap">',
    '            <input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="••••••" required>',
    '            <button type="button" class="pass-eye" id="eye-btn" onclick="TAKATA_VIEWS.togglePassword()" aria-label="Afficher ou masquer le mot de passe">${icon(\'eye\', 18)}</button>',
    '          </div>',
    '          <div class="field-error" id="err-pass"></div>',
    '        </div>'
  ].join('\n')
);

// 2. submitLogin réécrit (erreurs visuelles)
rep(
  [
    '  async function submitLogin(e) {',
    '    if (e) e.preventDefault();',
    '    const f = new FormData(e.target);',
    '    const username = f.get(\'username\');',
    '    const password = f.get(\'password\');',
    '    const btn = e.target.querySelector(\'.btn\');',
    '    btn.disabled = true; btn.textContent = \'Connexion…\';',
    '    try {',
    '      await TAKATA.login(username, password);',
    '      toast(\'Bienvenue\');',
    '      location.hash = \'#/\';',
    '    } catch (err) {',
    '      toast(err.message || \'Erreur de connexion\', true);',
    '      btn.disabled = false; btn.textContent = \'Se connecter\';',
    '    }',
    '  }'
  ].join('\n'),
  [
    '  function togglePassword() {',
    '    const input = document.getElementById(\'login-password\');',
    '    const btn = document.getElementById(\'eye-btn\');',
    '    if (!input || !btn) return;',
    '    const show = input.type === \'password\';',
    '    input.type = show ? \'text\' : \'password\';',
    '    btn.innerHTML = icon(show ? \'eyeOff\' : \'eye\', 18);',
    '    btn.setAttribute(\'aria-label\', show ? \'Masquer le mot de passe\' : \'Afficher le mot de passe\');',
    '  }',
    '',
    '  function loginError(html) {',
    '    const box = document.getElementById(\'login-error\');',
    '    if (!box) return;',
    '    box.innerHTML = html;',
    '    box.style.display = \'flex\';',
    '  }',
    '',
    '  function clearLoginErrors() {',
    '    [\'err-user\', \'err-pass\'].forEach((id) => { const el = document.getElementById(id); if (el) el.innerHTML = \'\'; });',
    '    [\'field-user\', \'field-pass\'].forEach((id) => { const el = document.getElementById(id); if (el) el.classList.remove(\'has-error\'); });',
    '    const box = document.getElementById(\'login-error\');',
    '    if (box) box.style.display = \'none\';',
    '  }',
    '',
    '  async function submitLogin(e) {',
    '    if (e) e.preventDefault();',
    '    clearLoginErrors();',
    '    const f = new FormData(e.target);',
    '    const username = f.get(\'username\');',
    '    const password = f.get(\'password\');',
    '    const btn = e.target.querySelector(\'.btn\');',
    '    btn.disabled = true; btn.textContent = \'Connexion…\';',
    '    try {',
    '      await TAKATA.login(username, password);',
    '      toast(\'Bienvenue\');',
    '      location.hash = \'#/\';',
    '      if (typeof renderRoute === \'function\') renderRoute();',
    '    } catch (err) {',
    '      btn.disabled = false; btn.textContent = \'Se connecter\';',
    '      const cross = icon(\'x\', 14);',
    '      if (err.status === 401) {',
    '        document.getElementById(\'field-user\').classList.add(\'has-error\');',
    '        document.getElementById(\'field-pass\').classList.add(\'has-error\');',
    '        document.getElementById(\'err-user\').innerHTML = cross + \' Identifiant ou mot de passe incorrect\';',
    '        loginError(cross + \' Identifiant ou mot de passe incorrect. Vérifiez puis réessayez.\');',
    '      } else if (err.status === 429) {',
    '        loginError(cross + \' \' + (err.message || \'Trop de tentatives. Patientez un instant puis réessayez.\'));',
    '      } else if (err.status === 0) {',
    '        loginError(cross + \' Serveur non joignable — démarrez le serveur Takata Kwetu (start-takata.bat) et réessayez.\');',
    '      } else {',
    '        loginError(cross + \' \' + (err.message || \'Erreur de connexion\'));',
    '      }',
    '    }',
    '  }'
  ].join('\n')
);

// 3. Icônes eyeOff + x (eye existe déjà)
if (!v.includes('eyeOff:')) {
  const eyeIdx = v.indexOf("    eye: '<path d=\"M1 12s4-8");
  if (eyeIdx !== -1) {
    const insertion = "\n    eyeOff: '<path d=\"M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24\"/><line x1=\"1\" y1=\"1\" x2=\"23\" y2=\"23\"/>',\n    x: '<line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>'";
    const lineEnd = v.indexOf('\n', eyeIdx);
    v = v.slice(0, lineEnd) + insertion + v.slice(lineEnd);
    out.push('  views: icônes eyeOff/x ajoutées');
  } else { out.push('  ⚠️ views: ancre eye non trouvée'); miss++; }
} else out.push('  views: eyeOff déjà présent');

fs.writeFileSync(vf, v, 'utf8');
console.log(out.join('\n'));
console.log(miss ? 'LOGIN2 PARTIEL' : 'LOGIN2 OK');