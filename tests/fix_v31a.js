// tests/fix_v31a.js — corrections de la relecture compat/UI (BLOQUANT + majeurs + 2e vague d'emojis)
const fs = require('fs');
const path = require('path');
const W = (f) => path.join(__dirname, '..', f);
const out = [];
let miss = 0;

function load(f) { return fs.readFileSync(W(f), 'utf8').split('\n'); }
function save(f, l) { fs.writeFileSync(W(f), l.join('\n'), 'utf8'); }
function replaceAll(lines, f, match, replacement) {
  let n = 0;
  const res = lines.map((l) => { if (l.includes(match)) { n++; return l.split(match).join(replacement); } return l; });
  if (n === 0) { out.push(`  ⚠️ ${f}: NON TROUVÉ → ${match.slice(0, 60)}`); miss++; }
  else out.push(`  ${f}: ${n} × ${match.slice(0, 50)}`);
  return res;
}
function replaceOnce(lines, f, match, replacement) {
  const i = lines.findIndex((l) => l.includes(match));
  if (i === -1) { out.push(`  ⚠️ ${f}: NON TROUVÉ → ${match.slice(0, 60)}`); miss++; return lines; }
  lines[i] = replacement;
  out.push(`  ${f}: ${match.slice(0, 50)}`);
  return lines;
}

// ================= 1. views.js =================
let v = load('public/js/views.js');

// BLOQUANT : if manquant dans installationDetailView
const badIdx = v.findIndex((l) => l.trim() === "return emptyState(icon('recycle'), 'Abonnement introuvable');");
if (badIdx === -1) { out.push('  ⚠️ views: return inconditionnel non trouvé (déjà corrigé ?)'); miss++; }
else { v[badIdx] = "    if (!i) return emptyState(icon('recycle'), 'Abonnement introuvable');"; out.push('  views: if (!i) restauré (BLOQUANT corrigé)'); }

// MAJEUR : clé wifi-off
v = replaceOnce(v, 'public/js/views.js', 'wifiOff:', "'wifi-off':");

// 2e vague d'emojis (états vides secondaires, boutons)
[
  ["emptyState('💸',", "emptyState(icon('wallet'),"],
  ["emptyState('✅',", "emptyState(icon('check'),"],
  ["emptyState('👥',", "emptyState(icon('users'),"],
  ["emptyState('🎯',", "emptyState(icon('target'),"],
  ["emptyState('🏅',", "emptyState(icon('award'),"],
  ["emptyState('📦',", "emptyState(icon('box'),"],
  ["emptyState('🔔',", "emptyState(icon('bell'),"],
  [">✏️ Modifier<", ">${icon('edit', 14)} Modifier<"],
  [">📣 Relancer<", ">Relancer<"],
  [">🔔 Relancer<", ">Relancer<"],
  [">💾 Enregistrer<", ">Enregistrer<"],
  [">💰 Payer", ">${icon('wallet')} Payer"],
  ["toast('Bienvenue 👋')", "toast('Bienvenue')"]
].forEach(([m, r]) => { v = replaceAll(v, 'public/js/views.js', m, r); });
// toasts : retirer les ✅ finaux
v = v.map((l) => l.replace(/ ✅'\)/g, "')"));
save('public/js/views.js', v);

// ================= 2. admin.js =================
let a = load('public/js/admin.js');

// errState/emptyState avec icônes SVG (les paramètres insèrent du HTML)
[
  ["errState('📊')", "errState(icon('chart'))"],
  ["errState('📦')", "errState(icon('box'))"],
  ["errState('🏅')", "errState(icon('award'))"],
  ["errState('📈')", "errState(icon('chart'))"],
  ["errState('users')", "errState(icon('users'))"],
  ["errState('box')", "errState(icon('box'))"],
  ["emptyState('users',", "emptyState(icon('users'),"],
  ["emptyState('box',", "emptyState(icon('box'),"],
  ["emptyState('user',", "emptyState(icon('user'),"],
  ["emptyState('📦',", "emptyState(icon('box'),"],
  ["<h3>📋 Actions rapides</h3>", "<h3>${icon('check')} Actions rapides</h3>"],
  [">💾 Créer le compte<", ">Créer le compte<"],
  [">✏️ Modifier<", ">${icon('edit', 14)} Modifier<"],
  [">💾 Enregistrer<", ">Enregistrer<"],
  [">💰 Payer", ">${icon('wallet')} Payer"]
].forEach(([m, r]) => { a = replaceAll(a, 'public/js/admin.js', m, r); });

// Avatars d'exports CSV : noms d'icônes + rendu SVG
a = replaceOnce(a, 'public/js/admin.js',
  "['customers', '👥', 'Clients'], ['prospects', '🎯', 'Prospects'], ['installations', '♻️', 'Abonnements'],",
  "['customers', 'users', 'Clients'], ['prospects', 'target', 'Prospects'], ['installations', 'recycle', 'Abonnements'],");
a = replaceOnce(a, 'public/js/admin.js',
  "['payments', '💸', 'Paiements'], ['installments', '📅', 'Échéances'], ['agents', '👤', 'Agents'], ['commissions', '🏅', 'Commissions']",
  "['payments', 'wallet', 'Paiements'], ['installments', 'calendar', 'Échéances'], ['agents', 'user', 'Agents'], ['commissions', 'award', 'Commissions']");
a = replaceAll(a, 'public/js/admin.js', '<div class="avatar">${ic}</div>', '<div class="avatar">${icon(ic, 18)}</div>');

// downloadExport manquant au registre
a = replaceOnce(a, 'public/js/admin.js',
  "adminHomeView, agentsView, agentFormView, createAgent, saveAgent, agentEditView, deleteAgent, toggleAgent, resetPassword, setStock,",
  "adminHomeView, agentsView, agentFormView, createAgent, saveAgent, agentEditView, deleteAgent, toggleAgent, resetPassword, setStock, downloadExport,");
save('public/js/admin.js', a);

// ================= 3. app.js : bandeau offline sans emoji =================
let ap = load('public/js/app.js');
const bannerIdx = ap.findIndex((l) => l.includes('📴') || l.includes('Mode hors-ligne'));
if (bannerIdx !== -1) {
  ap[bannerIdx] = ap[bannerIdx].replace(/📴\s*/g, '');
  out.push('  app.js: emoji bandeau hors-ligne retiré');
}
save('public/js/app.js', ap);

// ================= 4. api.js : toast hors-ligne sans emoji =================
let api = load('public/js/api.js');
let nApi = 0;
api = api.map((l) => { if (/[📴⏳]/u.test(l)) { nApi++; return l.replace(/[📴⏳]\s*/gu, ''); } return l; });
if (nApi) { save('public/js/api.js', api); out.push('  api.js: ' + nApi + ' ligne(s) sans emoji'); }

// ================= 5. CSS : avatar générique, badge, loupe, fallback =================
let css = load('public/css/takata.css');
css = replaceOnce(css, 'public/css/takata.css',
  ".list-item .avatar {",
  ".avatar, .list-item .avatar {");
css = replaceOnce(css, 'public/css/takata.css',
  ".auth-wrap { min-height: 100dvh;",
  ".auth-wrap { min-height: 100vh; min-height: 100dvh;");
css = replaceOnce(css, 'public/css/takata.css',
  ".bottomnav a:focus-visible { outline: 2px solid var(--green); outline-offset: -2px; border-radius: var(--radius); }",
  ".bottomnav a:focus-visible { outline: 2px solid var(--green); outline-offset: -2px; border-radius: var(--radius); }\na.badge { text-decoration: none; }");
save('public/css/takata.css', css);

// Loupe de recherche : SVG en background (remplace content '🔍')
const searchIdx = css.findIndex((l) => l.includes("content: '🔍'") || l.includes('🔍'));
if (searchIdx !== -1) {
  const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a918a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>');
  css[searchIdx] = '  content: \'\';\n  width: 16px; height: 16px;\n  background: url("data:image/svg+xml,' + svg + '") no-repeat center / contain;';
  save('public/css/takata.css', css);
  out.push('  css: loupe de recherche en SVG data-URI');
} else { out.push('  ⚠️ css: ancre loupe non trouvée'); miss++; }

// ================= 6. sw.js : pré-cache avec ?v=4 =================
let sw = load('public/sw.js');
sw = replaceOnce(sw, 'public/sw.js', "'/css/takata.css',", "'/css/takata.css?v=4',");
sw = replaceOnce(sw, 'public/sw.js', "'/js/app.js',", "'/js/app.js?v=4',");
sw = replaceOnce(sw, 'public/sw.js', "'/js/api.js',", "'/js/api.js?v=4',");
sw = replaceOnce(sw, 'public/sw.js', "'/js/views.js',", "'/js/views.js?v=4',");
sw = replaceOnce(sw, 'public/sw.js', "'/js/admin.js',", "'/js/admin.js?v=4',");
save('public/sw.js', sw);

console.log(out.join('\n'));
console.log(miss ? 'FIX V31A PARTIEL (' + miss + ' manqués)' : 'FIX V31A OK');