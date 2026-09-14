// tests/impl_v4a.js — views.js : icônes SVG premium + stats cliquables + libellés premium
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'js', 'views.js');
let s = fs.readFileSync(p, 'utf8').split('\n');
const out = [];
let miss = 0;

function replaceAll(match, replacement) {
  let n = 0;
  s = s.map((l) => {
    if (!l.includes(match)) return l;
    n++;
    return l.split(match).join(replacement);
  });
  if (n === 0) { out.push('  ⚠️ views: NON TROUVÉ → ' + match.slice(0, 60)); miss++; }
  else out.push('  views: ' + n + ' × ' + match.slice(0, 50));
}

// 1. Jeu d'icônes SVG (feather/lucide style, MIT) inséré avant le helper Toast
const iconsBlock = [
  "  // ---- Icônes SVG premium (inline, stroke, aucune dépendance réseau) ----",
  "  const ICONS = {",
  "    leaf: '<path d=\"M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z\"/><path d=\"M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12\"/>',",
  "    home: '<path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><polyline points=\"9 22 9 12 15 12 15 22\"/>',",
  "    users: '<path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>',",
  "    user: '<path d=\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/>',",
  "    target: '<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>',",
  "    calendar: '<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/><line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/><line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/>',",
  "    recycle: '<path d=\"M7 19H4.815a1.126 1.126 0 0 1-1.027-.671L1.842 14.6a1.126 1.126 0 0 1 .5-1.425l4.5-2.5\"/><path d=\"M2 8l5-5 5 5\"/><path d=\"M16.5 10.5L21 6\"/><path d=\"M19.597 21.482A1.126 1.126 0 0 0 21 20.446v-3.946\"/><path d=\"M9 14l3.5 6h-7\"/><path d=\"M16 14l3-6 3 6h-6.5\"/>',",
  "    box: '<path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\"/><polyline points=\"3.27 6.96 12 12.01 20.73 6.96\"/><line x1=\"12\" y1=\"22.08\" x2=\"12\" y2=\"12\"/>',",
  "    shield: '<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/>',",
  "    chart: '<line x1=\"18\" y1=\"20\" x2=\"18\" y2=\"10\"/><line x1=\"12\" y1=\"20\" x2=\"12\" y2=\"4\"/><line x1=\"6\" y1=\"20\" x2=\"6\" y2=\"14\"/>',",
  "    bell: '<path d=\"M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9\"/><path d=\"M13.73 21a2 2 0 0 1-3.46 0\"/>',",
  "    plus: '<line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>',",
  "    wallet: '<path d=\"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1\"/><path d=\"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4\"/>',",
  "    trash: '<polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/><line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"/><line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"/>',",
  "    edit: '<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z\"/>',",
  "    key: '<path d=\"M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4\"/>',",
  "    phone: '<path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z\"/>',",
  "    wifiOff: '<line x1=\"1\" y1=\"1\" x2=\"23\" y2=\"23\"/><path d=\"M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0\"/><line x1=\"12\" y1=\"20\" x2=\"12.01\" y2=\"20\"/>',",
  "    clock: '<circle cx=\"12\" cy=\"12\" r=\"10\"/><polyline points=\"12 6 12 12 16 14\"/>',",
  "    alert: '<path d=\"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z\"/><line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"13\"/><line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\"/>',",
  "    refresh: '<polyline points=\"23 4 23 10 17 10\"/><path d=\"M20.49 15a9 9 0 1 1-2.12-9.36L23 10\"/>',",
  "    award: '<circle cx=\"12\" cy=\"8\" r=\"7\"/><polyline points=\"8.21 13.89 7 23 12 20 17 23 15.79 13.88\"/>',",
  "    check: '<polyline points=\"20 6 9 17 4 12\"/>',",
  "    settings: '<line x1=\"4\" y1=\"21\" x2=\"4\" y2=\"14\"/><line x1=\"4\" y1=\"10\" x2=\"4\" y2=\"3\"/><line x1=\"12\" y1=\"21\" x2=\"12\" y2=\"12\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"3\"/><line x1=\"20\" y1=\"21\" x2=\"20\" y2=\"16\"/><line x1=\"20\" y1=\"12\" x2=\"20\" y2=\"3\"/><line x1=\"1\" y1=\"14\" x2=\"7\" y2=\"14\"/><line x1=\"9\" y1=\"8\" x2=\"15\" y2=\"8\"/><line x1=\"17\" y1=\"16\" x2=\"23\" y2=\"16\"/>',",
  "    sliders: '<line x1=\"4\" y1=\"21\" x2=\"4\" y2=\"14\"/><line x1=\"4\" y1=\"10\" x2=\"4\" y2=\"3\"/><line x1=\"12\" y1=\"21\" x2=\"12\" y2=\"12\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"3\"/><line x1=\"20\" y1=\"21\" x2=\"20\" y2=\"16\"/><line x1=\"20\" y1=\"12\" x2=\"20\" y2=\"3\"/><line x1=\"1\" y1=\"14\" x2=\"7\" y2=\"14\"/><line x1=\"9\" y1=\"8\" x2=\"15\" y2=\"8\"/><line x1=\"17\" y1=\"16\" x2=\"23\" y2=\"16\"/>'",
  "  };",
  "  function icon(name, size) {",
  "    const pathData = ICONS[name];",
  "    if (!pathData) return '';",
  "    const s = size || 18;",
  "    return '<svg class=\"ico\" width=\"' + s + '\" height=\"' + s + '\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">' + pathData + '</svg>';",
  "  }",
  "",
  "  // Toast"
];
const toastIdx = s.findIndex((l) => l.includes('// Toast'));
if (toastIdx === -1) { out.push('  ⚠️ views: ancre Toast non trouvée'); miss++; }
else s.splice(toastIdx, 0, ...iconsBlock);

// 2. Export du helper icon (avant le stub renderRoute en fin de fichier)
const exportIdx = s.findIndex((l) => l.includes('window.renderRoute = () => {};'));
if (exportIdx === -1) { out.push('  ⚠️ views: ancre export non trouvée'); miss++; }
else s.splice(exportIdx, 0, "  TAKATA_VIEWS.helpers.icon = icon;");

// 3. Remplacements globaux (avatars de listes / empty states)
[
  ["emptyState('📡',", "emptyState(icon('wifi-off'),"],
  ["emptyState('👤',", "emptyState(icon('user'),"],
  ["emptyState('♻️',", "emptyState(icon('recycle'),"],
  ["emptyState('📅',", "emptyState(icon('calendar'),"],
  ["listItem('♻️',", "listItem(icon('recycle'),"],
  ["listItem('📅',", "listItem(icon('calendar'),"],
  ["listItem('₣',", "listItem(icon('wallet'),"],
  ["listItem('📦',", "listItem(icon('box'),"],
  ["listItem('🏅',", "listItem(icon('award'),"]
].forEach(([m, r]) => replaceAll(m, r));

// 4. Écrans et boutons clés
[
  ["<div class=\"auth-logo\">♻️</div>", "<div class=\"auth-logo\">${icon('leaf', 30)}</div>"],
  ["<h3>📊 Vue supervision</h3>", "<h3>${icon('shield')} Vue supervision</h3>"],
  ["<h3>⚠️ Relances à faire", "<h3>${icon('alert')} Relances à faire"],
  [">💾 Enregistrer<", ">Enregistrer<"],
  [">♻️ Souscrire<", ">Souscrire<"],
  [">💰 Encaisser", ">${icon('wallet')} Encaisser"],
  [">🔄 Synchroniser maintenant<", ">${icon('refresh')} Synchroniser maintenant<"],
  [">✅ Convertir<", ">Convertir<"],
  ["'✅ Convertir'", "'Convertir'"],
  ["toast('Bienvenue 👋')", "toast('Bienvenue')"],
  ["toast('Relance enregistrée 📣')", "toast('Relance enregistrée')"]
].forEach(([m, r]) => replaceAll(m, r));
s = s.map((l) => l.replace(/ ✅'\)/g, "')"));

// 5. Stats cliquables (cartes = liens)
[
  ["<div class=\"stat\"><div class=\"num\">${s.installations}</div><div class=\"lbl\">Abonnements en service</div></div>", "<a class=\"stat\" href=\"#/installations\"><div class=\"num\">${s.installations}</div><div class=\"lbl\">Abonnements en service</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${s.planned}</div><div class=\"lbl\">Tournées planifiées</div></div>", "<a class=\"stat\" href=\"#/installations\"><div class=\"num\">${s.planned}</div><div class=\"lbl\">Tournées planifiées</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${s.customers}</div><div class=\"lbl\">Abonnés actifs</div></div>", "<a class=\"stat\" href=\"#/customers\"><div class=\"num\">${s.customers}</div><div class=\"lbl\">Abonnés actifs</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${s.stockAlerts}</div><div class=\"lbl\">Matériel en stock faible</div></div>", "<a class=\"stat\" href=\"#/stock\"><div class=\"num\">${s.stockAlerts}</div><div class=\"lbl\">Matériel en stock faible</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${s.customers}</div><div class=\"lbl\">Clients abonnés</div></div>", "<a class=\"stat\" href=\"#/customers\"><div class=\"num\">${s.customers}</div><div class=\"lbl\">Clients abonnés</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${s.prospects}</div><div class=\"lbl\">Prospects</div></div>", "<a class=\"stat\" href=\"#/prospects\"><div class=\"num\">${s.prospects}</div><div class=\"lbl\">Prospects</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${s.installations}</div><div class=\"lbl\">Abonnements</div></div>", "<a class=\"stat\" href=\"#/installations\"><div class=\"num\">${s.installations}</div><div class=\"lbl\">Abonnements</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${money(s.paidMonth)}</div><div class=\"lbl\">Encaissé (mois)</div></div>", "<a class=\"stat\" href=\"#/payments\"><div class=\"num\">${money(s.paidMonth)}</div><div class=\"lbl\">Encaissé (mois)</div></a>"],
  ["<div class=\"stat\"><div class=\"num\" style=\"color:${s.overdue ? 'var(--red)' : 'var(--green-dark)'}\">${s.overdue}</div><div class=\"lbl\">Redevances en retard</div></div>", "<a class=\"stat\" href=\"#/installments?status=overdue\"><div class=\"num\" style=\"color:${s.overdue ? 'var(--red)' : 'var(--green-dark)'}\">${s.overdue}</div><div class=\"lbl\">Redevances en retard</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${s.upcoming}</div><div class=\"lbl\">Redevances ≤ 7 j</div></div>", "<a class=\"stat\" href=\"#/installments?status=pending\"><div class=\"num\">${s.upcoming}</div><div class=\"lbl\">Redevances ≤ 7 j</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${s.stockAlerts}</div><div class=\"lbl\">Intrants en stock faible</div></div>", "<a class=\"stat\" href=\"#/stock\"><div class=\"num\">${s.stockAlerts}</div><div class=\"lbl\">Intrants en stock faible</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${money(s.pendingCommissions)}</div><div class=\"lbl\">Commissions à venir</div></div>", "<a class=\"stat\" href=\"#/commissions\"><div class=\"num\">${money(s.pendingCommissions)}</div><div class=\"lbl\">Commissions à venir</div></a>"]
].forEach(([m, r]) => replaceAll(m, r));

fs.writeFileSync(p, s.join('\n'), 'utf8');
console.log(out.join('\n'));
console.log(miss ? 'IMPL A PARTIELLE (' + miss + ' manqués)' : 'IMPL A OK');