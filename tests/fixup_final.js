// tests/fixup_final.js — réparation finale : meSelf via t1 (objet), bloc remind nettoyé, roleOptions hors template
const fs = require('fs');
const path = require('path');
const P = (f) => path.join(__dirname, '..', f);
const out = [];

// ---- 1. security-test.js ----
let st = fs.readFileSync(P('tests/security-test.js'), 'utf8').split('\n');

const msIdx = st.findIndex((l) => l.includes("const meSelf = await req('GET', '/auth/me', { token: t1 });"));
if (msIdx !== -1) { st[msIdx] = "  const meSelf = await req('GET', '/auth/me', t1);"; out.push('security-test: meSelf via t1 (objet opts)'); }
else out.push('⚠️ security-test: meSelf non trouvé');

// Bloc remind : retirer les 2 lignes résiduelles (selfId fantôme + return mort)
const ghostIdx = st.findIndex((l) => l.includes('const selfId = me.data && me.data.id;'));
if (ghostIdx !== -1) { st.splice(ghostIdx, 1); out.push('security-test: selfId fantôme supprimé'); }
const deadIdx = st.findIndex((l) => l.includes('return other ? req('));
if (deadIdx !== -1) { st.splice(deadIdx, 1); out.push('security-test: return mort supprimé'); }

fs.writeFileSync(P('tests/security-test.js'), st.join('\n'), 'utf8');

// ---- 2. public/js/admin.js : agentFormView propre (roleOptions hors template, sans ${} avec ternaire) ----
let adm = fs.readFileSync(P('public/js/admin.js'), 'utf8').split('\n');
const fnStart = adm.findIndex((l) => l.includes('async function agentFormView(params) {'));
const fnEnd = adm.findIndex((l, i) => i > fnStart && l.trim() === '}' && adm[i + 1] && adm[i + 1].includes('async function createAgent'));
if (fnStart !== -1 && fnEnd !== -1) {
  const newFn = [
    "  async function agentFormView(params) {",
    "    const me = TAKATA.store.user || {};",
    "    const canPickRole = ['admin', 'admingen'].includes(me.role);",
    "    const forcedRole = me.role === 'admintech' ? 'technicien' : 'agent';",
    "    const roleOptions = [",
    "      ['agent', 'Commercial (agent)'],",
    "      ['technicien', 'Technicien (ramasseur)'],",
    "      ['admincomm', 'Superviseur commercial (admincomm)'],",
    "      ['admintech', 'Superviseur technique (admintech)']",
    "    ].map(([v, lbl]) => {",
    "      const sel = forcedRole === v && !canPickRole ? ' selected' : '';",
    "      return '<option value=\"' + esc(v) + '\"' + sel + '>' + esc(lbl) + '</option>';",
    "    }).join('');",
    "    return `",
    "      <div class=\"card\">",
    "        <div class=\"page-title\" style=\"margin:0 0 12px;font-weight:600\">Créer un compte</div>",
    "        <div class=\"field\"><label for=\"f-name\">Nom complet *</label><input id=\"f-name\"></div>",
    "        <div class=\"field\"><label for=\"f-username\">Nom d'utilisateur *</label><input id=\"f-username\" placeholder=\"ex. agent4\"></div>",
    "        <div class=\"field\"><label for=\"f-password\">Mot de passe * (6+ caractères)</label><input id=\"f-password\" type=\"password\" placeholder=\"ex. agent123\"></div>",
    "        <div class=\"field\"><label for=\"f-role\">Profil ${canPickRole ? '' : '(fixé par votre périmètre)'}</label><select id=\"f-role\" ${canPickRole ? '' : 'disabled'}>${roleOptions}</select></div>",
    "        <div class=\"field\"><label for=\"f-team\">Équipe</label><input id=\"f-team\" placeholder=\"ex. Commercial / Technique\"></div>",
    "        <div class=\"field\"><label for=\"f-phone\">Téléphone</label><input id=\"f-phone\" type=\"tel\" placeholder=\"+243 ...\"></div>",
    "        <div class=\"field\"><label for=\"f-region\">Région</label><input id=\"f-region\" placeholder=\"ex. Lubumbashi\"></div>",
    "        <button class=\"btn\" onclick=\"TAKATA_ADMIN.createAgent()\">💾 Créer le compte</button>",
    "      </div>`;",
    "  }"
  ];
  adm.splice(fnStart, fnEnd - fnStart + 1, ...newFn);
  out.push('admin.js: agentFormView réécrit proprement');
} else out.push('⚠️ admin.js: bornes agentFormView non trouvées');

fs.writeFileSync(P('public/js/admin.js'), adm.join('\n'), 'utf8');
console.log(out.join('\n'));