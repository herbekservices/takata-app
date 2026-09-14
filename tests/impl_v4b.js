// tests/impl_v4b.js — app.js : icônes SVG (topbar/nav/chargement) + route édition membre
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'js', 'app.js');
let s = fs.readFileSync(p, 'utf8').split('\n');
const out = [];
let miss = 0;

function replaceOnce(match, replacement) {
  const i = s.findIndex((l) => l.includes(match));
  if (i === -1) { out.push('  ⚠️ app: NON TROUVÉ → ' + match.slice(0, 60)); miss++; return; }
  s[i] = replacement;
  out.push('  app: ' + match.slice(0, 50));
}
function replaceAll(match, replacement) {
  let n = 0;
  s = s.map((l) => { if (l.includes(match)) { n++; return l.split(match).join(replacement); } return l; });
  if (n === 0) { out.push('  ⚠️ app: NON TROUVÉ → ' + match.slice(0, 60)); miss++; }
  else out.push('  app: ' + n + ' × ' + match.slice(0, 50));
}

// 1. Helper icon accessible au module
replaceOnce("const V = TAKATA_VIEWS;", "const V = TAKATA_VIEWS;\n  const { icon } = V.helpers;");

// 2. Topbar : logo feuille + cloche SVG
replaceAll('<div class="logo" aria-hidden="true">♻️</div>', '<div class="logo" aria-hidden="true">${icon(\'leaf\', 22)}</div>');
replaceAll('>🔔<span id="notif-badge"', '>${icon(\'bell\')}<span id="notif-badge"');

// 3. Navigation par rôle : noms d'icônes + rendu SVG
replaceAll(
  "items = [['#/', '🏠', 'Accueil', 'accueil'], ['#/customers', '👥', 'Clients', 'clients'], ['#/prospects', '🎯', 'Prospects', 'prospects'], ['#/installments', '📅', 'Échéances', 'echeances'], ['#/profile', '⚙️', 'Profil', 'profil']];",
  "items = [['#/', 'home', 'Accueil', 'accueil'], ['#/customers', 'users', 'Clients', 'clients'], ['#/prospects', 'target', 'Prospects', 'prospects'], ['#/installments', 'calendar', 'Échéances', 'echeances'], ['#/profile', 'sliders', 'Profil', 'profil']];"
);
replaceAll(
  "items = [['#/', '🏠', 'Accueil', 'accueil'], ['#/installations', '♻️', 'Tournées', 'tournees'], ['#/stock', '📦', 'Matériel', 'stock'], ['#/profile', '⚙️', 'Profil', 'profil']];",
  "items = [['#/', 'home', 'Accueil', 'accueil'], ['#/installations', 'recycle', 'Tournées', 'tournees'], ['#/stock', 'box', 'Matériel', 'stock'], ['#/profile', 'sliders', 'Profil', 'profil']];"
);
replaceAll(
  "items = [['#/', '🏠', 'Accueil', 'accueil'], ['#/admin', '🧭', 'Supervision', 'admin'], ['#/admin/agents', '👥', 'Équipes', 'agents'], ['#/admin/reports', '📈', 'Rapports', 'reports'], ['#/profile', '⚙️', 'Profil', 'profil']];",
  "items = [['#/', 'home', 'Accueil', 'accueil'], ['#/admin', 'shield', 'Supervision', 'admin'], ['#/admin/agents', 'users', 'Équipes', 'agents'], ['#/admin/reports', 'chart', 'Rapports', 'reports'], ['#/profile', 'sliders', 'Profil', 'profil']];"
);
replaceAll('<span class="ic" aria-hidden="true">${ic}</span>', '<span class="ic" aria-hidden="true">${icon(ic, 20)}</span>');

// 4. Écran de chargement
replaceAll('<div class="ic">⏳</div>', '${icon(\'clock\', 30)}');

// 5. Route d'édition d'un membre (après agents/new)
replaceOnce(
  "[/^\\/admin\\/agents\\/new$/, (p, q) => A.agentFormView(), 'Nouvel agent', true, 'admin', null],",
  "[/^\\/admin\\/agents\\/new$/, (p, q) => A.agentFormView(), 'Nouveau membre', true, 'admin', null],\n    [/^\\/admin\\/agents\\/(\\d+)\\/edit$/, (p) => A.agentEditView({ id: p[1] }), 'Modifier un membre', true, 'admin', null],"
);

fs.writeFileSync(p, s.join('\n'), 'utf8');
console.log(out.join('\n'));
console.log(miss ? 'IMPL B PARTIELLE (' + miss + ' manqués)' : 'IMPL B OK');