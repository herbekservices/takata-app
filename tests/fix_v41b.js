// tests/fix_v41b.js — verrou username systématique (ligne unique) + front profils
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

// 1. auth.js : registerFailure(userKey) sans condition
let au = load('routes/auth.js');
au = replaceOnce(au, 'routes/auth.js',
  "if (userKey.length > 5) registerFailure(userKey);",
  "    registerFailure(userKey);");
save('routes/auth.js', au);

// 2. views.js : icône truck ajoutée à ICONS
let v = load('public/js/views.js');
const truckIdx = v.findIndex((l) => l.includes("    clock: '<circle"));
if (truckIdx === -1) { out.push('  ⚠️ views: ancre clock non trouvée'); miss++; }
else {
  v.splice(truckIdx, 0,
    "    truck: '<rect x=\"1\" y=\"3\" width=\"15\" height=\"13\"/><polygon points=\"16 8 20 8 23 11 23 16 16 16 16 8\"/><circle cx=\"5.5\" cy=\"18.5\" r=\"2.5\"/><circle cx=\"18.5\" cy=\"18.5\" r=\"2.5\"/>',");
  out.push('  views: icône truck ajoutée');
}
save('public/js/views.js', v);

// 3. admin.js : agentsView avec filtres de profils + badges différenciés
const avStart = load('public/js/admin.js').findIndex((l) => l.includes('async function agentsView() {'));
if (avStart === -1) { out.push('  ⚠️ admin: agentsView non trouvé'); miss++; }
else {
  let s = load('public/js/admin.js');
  let avStart = s.findIndex((l) => l.includes('async function agentsView() {'));
  let avEnd = avStart;
  while (avEnd < s.length && s[avEnd].trim() !== '};') avEnd++; // fin = }; de la template + fonction ? chercher '  }' puis rien
  // bornes robustes : fin = première ligne '  }' après le début
  avEnd = avStart;
  while (avEnd < s.length && s[avEnd].trim() !== '}') avEnd++;
  const newView = [
    "  async function agentsView(params, q) {",
    "    const rows = await get('/admin/agents');",
    "    if (!rows) return errState(icon('users'));",
    "    const prof = (q && q.profile) || '';",
    "    const isDir = ['admin', 'admingen'].includes((TAKATA.store.user || {}).role);",
    "    const groups = {",
    "      '': { test: () => true, label: 'Tous' },",
    "      'comm': { test: (a) => a.role === 'agent', label: 'Commerciaux' },",
    "      'tech': { test: (a) => a.role === 'technicien', label: 'Techniciens' },",
    "      'sup': { test: (a) => ['admincomm', 'admintech'].includes(a.role), label: 'Superviseurs' },",
    "      'dir': { test: (a) => ['admin', 'admingen'].includes(a.role), label: 'Direction' }",
    "    };",
    "    const list = prof && groups[prof] ? rows.filter(groups[prof].test) : rows;",
    "    const roleBadge = (a) => {",
    "      if (a.role === 'agent') return `<span class=\"badge green\">${icon('users', 12)} Commercial</span>`;",
    "      if (a.role === 'technicien') return `<span class=\"badge amber\">${icon('truck', 12)} Technicien</span>`;",
    "      if (a.role === 'admincomm') return `<span class=\"badge gray\">${icon('users', 12)} Sup. commercial</span>`;",
    "      if (a.role === 'admintech') return `<span class=\"badge gray\">${icon('truck', 12)} Sup. technique</span>`;",
    "      return `<span class=\"badge green\">${icon('shield', 12)} Direction</span>`;",
    "    };",
    "    const tabs = [['', 'Tous'], ['comm', 'Commerciaux'], ['tech', 'Techniciens'], ['sup', 'Superviseurs'], ['dir', 'Direction']];",
    "    return `",
    "      <div style=\"display:flex;gap:6px;overflow-x:auto;padding:8px 14px\">",
    "        ${tabs.map(([v, l]) => `<a class=\"badge ${(prof || '') === v ? 'green' : 'gray'}\" style=\"flex:none\" href=\"#/admin/agents${v ? '?profile=' + v : ''}\">${l}</a>`).join('')}",
    "      </div>",
    "      <div class=\"page-sub\">Commerciaux et techniciens sont des profils distincts : badges et périmètres séparés.</div>",
    "      <div class=\"list\">",
    "        ${list.map((a) => `<div class=\"card\" style=\"margin:8px 14px\">",
    "          <div class=\"row\"><div class=\"avatar\">${esc(a.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2))}</div>",
    "          <div style=\"flex:1\"><div style=\"font-weight:600\">${esc(a.full_name)} <span class=\"muted\">@${esc(a.username)}</span></div>",
    "          <div style=\"margin-top:2px\">${roleBadge(a)} <span class=\"muted\">· ${esc(a.region || '—')} · ${a.customers} clients · ${money(a.collected)}</span></div>",
    "          <div class=\"muted\" style=\"margin-top:2px\">${icon('phone', 13)} ${a.phone ? esc(a.phone) : 'Numéro non renseigné'}</div></div>",
    "          ${a.active ? '<span class=\"badge green\">Actif</span>' : '<span class=\"badge red\">Désactivé</span>'}</div>",
    "          <hr class=\"divider\">",
    "          <div class=\"icon-btn-row\">",
    "            <a class=\"btn small secondary\" href=\"#/admin/agents/${a.id}/edit\">${icon('edit', 14)} Modifier</a>",
    "            <button class=\"btn small secondary\" onclick=\"TAKATA_ADMIN.resetPassword(${a.id})\">${icon('key', 14)} Mot de passe</button>",
    "            <button class=\"btn small ${a.active ? 'danger' : 'secondary'}\" onclick=\"TAKATA_ADMIN.toggleAgent(${a.id},${a.active ? 0 : 1})\">${a.active ? 'Désactiver' : 'Activer'}</button>",
    "            ${isDir ? `<button class=\"btn small danger\" onclick=\"TAKATA_ADMIN.deleteAgent(${a.id})\">${icon('trash', 14)} Supprimer</button>` : ''}",
    "          </div></div>`).join('') || emptyState(icon('users'), 'Aucun membre dans ce profil')}",
    "      </div>",
    "      ${fab(\"location.hash='#/admin/agents/new'\", 'Nouveau membre')}",
    "    `;",
    "  }"
  ];
  s.splice(avStart, avEnd - avStart + 1, ...newView);
  save('public/js/admin.js', s);
  out.push('  admin: agentsView réécrite (filtres profils + badges)');
}

// 4. app.js : passer q à agentsView
let ap = load('public/js/app.js');
ap = replaceOnce(ap, 'public/js/app.js',
  "(p, q) => A.agentsView(),",
  "(p, q) => A.agentsView(q),");
save('public/js/app.js', ap);

console.log(out.join('\n'));
console.log(miss ? 'FIX V41B PARTIEL' : 'FIX V41B OK');