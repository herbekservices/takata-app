// tests/impl_tech_app.js — routes techniques + navigation + contrôle d'accès
const fs = require('fs');
const path = require('path');
const out = [];
let miss = 0;

const af = path.join(__dirname, '..', 'public', 'js', 'app.js');
let app = fs.readFileSync(af, 'utf8');

function replaceOnce(match, replacement) {
  const i = app.split('\n').findIndex((l) => l.includes(match));
  if (i === -1) { out.push(`  ⚠️ app: NON TROUVÉ → ${match.slice(0, 70)}`); miss++; return; }
  app = app.split('\n');
  app[i] = replacement;
  app = app.join('\n');
  out.push(`  app: ${match.slice(0, 55)}`);
}

// 1. Routes techniques (après /stock)
replaceOnce(
  "[/^\\/stock$/, (p, q) => V.stockView(), 'Stock', true, 'stock', 'stock'],",
  [
    "[/^\\/stock$/, (p, q) => V.stockView(), 'Stock', true, 'stock', 'stock'],",
    "[/^\\/tech$/, (p, q) => V.techDayView(), 'Rapport du jour', true, 'tech', null],",
    "[/^\\/tech\\/historique$/, (p, q) => V.techHistoryView(), 'Mes rapports techniques', true, 'tech', null],",
    "[/^\\/tech\\/rapport\\/(\\d+)$/, (p, q) => V.techReportDetailView({ id: p[1] }), 'Détail rapport technique', true, 'tech', null],",
    "[/^\\/admin\\/tech$/, (p, q) => V.techCompilationView(), 'Compilation technique', true, 'tech', 'tech'],"
  ].join('\n')
);

// 2. Gate : compilation technique réservée admintech/direction
replaceOnce(
  "// Le technicien n'accède pas aux modules commerciaux (vente/encaissement/prospects)",
  "  // La compilation technique est réservée au superviseur technique et à la direction\n  if (path === '/admin/tech' && user && !['admintech', 'admin', 'admingen'].includes(user.role)) {\n    TAKATA_VIEWS.helpers.toast('Compilation technique : réservée au superviseur technique et à la direction', true);\n    location.hash = '#/';\n    return;\n  }\n  // Le technicien n'accède pas aux modules commerciaux (vente/encaissement/prospects)"
);

// 3. Nav technicien : onglet Rapports
replaceOnce(
  "items = [['#/', 'home', 'Accueil', 'accueil'], ['#/installations', 'recycle', 'Tournées', 'tournees'], ['#/stock', 'box', 'Matériel', 'stock'], ['#/profile', 'sliders', 'Profil', 'profil']];",
  "items = [['#/', 'home', 'Accueil', 'accueil'], ['#/installations', 'recycle', 'Tournées', 'tournees'], ['#/tech', 'chart', 'Rapports', 'tech'], ['#/stock', 'box', 'Matériel', 'stock'], ['#/profile', 'sliders', 'Profil', 'profil']];"
);

// 4. Nav admintech : « Technique » à la place de « Rapports »
const superLine = app.split('\n').findIndex((l) => l.includes("['#/admin/reports', 'chart', 'Rapports', 'reports']"));
if (superLine !== -1) {
  const lines = app.split('\n');
  lines[superLine] = lines[superLine].replace(
    "['#/admin/reports', 'chart', 'Rapports', 'reports']",
    "(role === 'admintech' ? ['#/admin/tech', 'truck', 'Technique', 'tech'] : ['#/admin/reports', 'chart', 'Rapports', 'reports'])"
  );
  app = lines.join('\n');
  out.push('  app: nav admintech → Technique');
} else { out.push('  ⚠️ app: nav super non trouvée'); miss++; }

fs.writeFileSync(af, app, 'utf8');
console.log(out.join('\n'));
console.log(miss ? 'IMPL APP PARTIELLE' : 'IMPL APP OK');