// tests/impl_v4c.js — admin.js : comptes (renommer/téléphone/supprimer/ajouter) + stock manuel + icônes
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'js', 'admin.js');
let s = fs.readFileSync(p, 'utf8').split('\n');
const out = [];
let miss = 0;

function findFrom(start, match) {
  for (let i = start; i < s.length; i++) if (s[i].includes(match)) return i;
  return -1;
}
function replaceBlock(startMatch, endMatchExclusiveCheck, newBlock) {
  const start = findFrom(0, startMatch);
  if (start === -1) { out.push('  ⚠️ admin: début non trouvé → ' + startMatch.slice(0, 50)); miss++; return; }
  let end = start;
  while (end < s.length && s[end].trim() !== '}') end++;
  if (end >= s.length) { out.push('  ⚠️ admin: fin non trouvée pour ' + startMatch.slice(0, 50)); miss++; return; }
  s.splice(start, end - start + 1, ...newBlock);
  out.push('  admin: bloc réécrit (' + startMatch.slice(0, 40) + ', ' + newBlock.length + ' lignes)');
}
function replaceOnce(match, replacement) {
  const i = s.findIndex((l) => l.includes(match));
  if (i === -1) { out.push('  ⚠️ admin: NON TROUVÉ → ' + match.slice(0, 60)); miss++; return; }
  s[i] = replacement;
  out.push('  admin: ' + match.slice(0, 50));
}
function replaceAll(match, replacement) {
  let n = 0;
  s = s.map((l) => { if (l.includes(match)) { n++; return l.split(match).join(replacement); } return l; });
  if (n === 0) { out.push('  ⚠️ admin: NON TROUVÉ → ' + match.slice(0, 60)); miss++; }
  else out.push('  admin: ' + n + ' × ' + match.slice(0, 50));
}

// 1. Helper icon
replaceOnce("const { esc, money, date, toast } = TAKATA_VIEWS.helpers;", "const { esc, money, date, toast, icon } = TAKATA_VIEWS.helpers;");

// 2. adminHomeView : stats cliquables
[
  ["<div class=\"stat\"><div class=\"num\">${o.agents}</div><div class=\"lbl\">Membres actifs</div></div>", "<a class=\"stat\" href=\"#/admin/agents\"><div class=\"num\">${o.agents}</div><div class=\"lbl\">Membres actifs</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${o.customers}</div><div class=\"lbl\">Abonnés</div></div>", "<a class=\"stat\" href=\"#/customers\"><div class=\"num\">${o.customers}</div><div class=\"lbl\">Abonnés</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${o.prospects}</div><div class=\"lbl\">Prospects</div></div>", "<a class=\"stat\" href=\"#/prospects\"><div class=\"num\">${o.prospects}</div><div class=\"lbl\">Prospects</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${o.installations}</div><div class=\"lbl\">Abonnements</div></div>", "<a class=\"stat\" href=\"#/installations\"><div class=\"num\">${o.installations}</div><div class=\"lbl\">Abonnements</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${money(o.totalPaid)}</div><div class=\"lbl\">Encaissements totaux</div></div>", "<a class=\"stat\" href=\"#/admin/reports\"><div class=\"num\">${money(o.totalPaid)}</div><div class=\"lbl\">Encaissements totaux</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${money(o.pendingCommissions)}</div><div class=\"lbl\">Commissions à payer</div></div>", "<a class=\"stat\" href=\"#/admin/commissions\"><div class=\"num\">${money(o.pendingCommissions)}</div><div class=\"lbl\">Commissions à payer</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${o.overdue}</div><div class=\"lbl\">Redevances en retard</div></div>", "<a class=\"stat\" href=\"#/installments?status=overdue\"><div class=\"num\">${o.overdue}</div><div class=\"lbl\">Redevances en retard</div></a>"],
  ["<div class=\"stat\"><div class=\"num\">${money(o.stockValue)}</div><div class=\"lbl\">Valeur du stock</div></div>", "<a class=\"stat\" href=\"#/admin/stock\"><div class=\"num\">${money(o.stockValue)}</div><div class=\"lbl\">Valeur du stock</div></a>"],
  ["<a class=\"btn small\" href=\"#/admin/agents\">👥 Équipes</a>", "<a class=\"btn small\" href=\"#/admin/agents\">${icon('users', 15)} Équipes</a>"],
  ["<a class=\"btn small secondary\" href=\"#/admin/products\">📦 Formules</a>", "<a class=\"btn small secondary\" href=\"#/admin/products\">${icon('box', 15)} Formules</a>"],
  ["<a class=\"btn small secondary\" href=\"#/admin/stock\">🏬 Stock</a>", "<a class=\"btn small secondary\" href=\"#/admin/stock\">${icon('sliders', 15)} Stock</a>"],
  ["<a class=\"btn small secondary\" href=\"#/admin/reports\">📈 Rapports</a>", "<a class=\"btn small secondary\" href=\"#/admin/reports\">${icon('chart', 15)} Rapports</a>"]
].forEach(([m, r]) => replaceAll(m, r));

// 3. agentsView réécrite (téléphone visible, Modifier, Supprimer pour la direction)
replaceBlock(
  "async function agentsView() {",
  null,
  [
    "  async function agentsView() {",
    "    const rows = await get('/admin/agents');",
    "    if (!rows) return errState('users');",
    "    const me = TAKATA.store.user || {};",
    "    const isDir = ['admin', 'admingen'].includes(me.role);",
    "    return `",
    "      <div class=\"page-sub\">Renommez, ajustez le téléphone, le profil, ou supprimez un compte. La direction gère tous les profils ; les superviseurs leur périmètre.</div>",
    "      <div class=\"list\">",
    "        ${rows.map((a) => `<div class=\"card\" style=\"margin:8px 14px\">",
    "          <div class=\"row\"><div class=\"avatar\">${esc(a.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2))}</div>",
    "          <div style=\"flex:1\"><div style=\"font-weight:600\">${esc(a.full_name)} <span class=\"muted\">@${esc(a.username)}</span></div>",
    "          <div class=\"muted\">${esc(ROLE_LABEL[a.role] || a.role)} · ${esc(a.region || '—')} · ${a.customers} clients · ${money(a.collected)}</div>",
    "          <div class=\"muted\" style=\"margin-top:2px\">${icon('phone', 13)} ${a.phone ? esc(a.phone) : 'Numéro non renseigné'}</div></div>",
    "          ${a.active ? '<span class=\"badge green\">Actif</span>' : '<span class=\"badge red\">Désactivé</span>'}</div>",
    "          <hr class=\"divider\">",
    "          <div class=\"icon-btn-row\">",
    "            <a class=\"btn small secondary\" href=\"#/admin/agents/${a.id}/edit\">${icon('edit', 14)} Modifier</a>",
    "            <button class=\"btn small secondary\" onclick=\"TAKATA_ADMIN.resetPassword(${a.id})\">${icon('key', 14)} Mot de passe</button>",
    "            <button class=\"btn small ${a.active ? 'danger' : 'secondary'}\" onclick=\"TAKATA_ADMIN.toggleAgent(${a.id},${a.active ? 0 : 1})\">${a.active ? 'Désactiver' : 'Activer'}</button>",
    "            ${isDir ? `<button class=\"btn small danger\" onclick=\"TAKATA_ADMIN.deleteAgent(${a.id})\">${icon('trash', 14)} Supprimer</button>` : ''}",
    "          </div></div>`).join('') || emptyState('users', 'Aucun membre dans votre périmètre')}",
    "      </div>",
    "      ${fab(\"location.hash='#/admin/agents/new'\", 'Nouveau membre')}",
    "    `;",
    "  }"
  ].map((l) => l.replace(/\\'/g, "'"))
);

// 4. agentEditView + saveAgent + deleteAgent (insérés après createAgent)
const createIdx = findFrom(0, 'async function toggleAgent(');
if (createIdx === -1) { out.push('  ⚠️ admin: ancre toggleAgent non trouvée'); miss++; }
else {
  const newFns = [
    "  async function agentEditView(params) {",
    "    const me = TAKATA.store.user || {};",
    "    const isDir = ['admin', 'admingen'].includes(me.role);",
    "    const rows = await get('/admin/agents');",
    "    const a = (rows || []).find((x) => x.id === Number(params.id));",
    "    if (!a) return emptyState('user', 'Membre introuvable dans votre périmètre');",
    "    return `",
    "      <div class=\"card\">",
    "        <div class=\"page-title\" style=\"margin:0 0 12px;font-weight:600\">Modifier le compte — ${esc(a.full_name)}</div>",
    "        <div class=\"field\"><label for=\"e-name\">Nom complet</label><input id=\"e-name\" value=\"${esc(a.full_name)}\"></div>",
    "        <div class=\"field\"><label for=\"e-phone\">${icon('phone', 14)} Téléphone (laisser vide pour supprimer le numéro)</label><input id=\"e-phone\" type=\"tel\" value=\"${esc(a.phone || '')}\" placeholder=\"+243 ...\"></div>",
    "        <div class=\"field\"><label for=\"e-team\">Équipe</label><input id=\"e-team\" value=\"${esc(a.team || '')}\" placeholder=\"ex. Commercial\"></div>",
    "        <div class=\"field\"><label for=\"e-region\">Région</label><input id=\"e-region\" value=\"${esc(a.region || '')}\" placeholder=\"ex. Kolwezi\"></div>",
    "        ${isDir ? `<div class=\"field\"><label for=\"e-role\">Profil du compte</label><select id=\"e-role\">${[['agent', 'Commercial'], ['technicien', 'Technicien'], ['admincomm', 'Superviseur commercial'], ['admintech', 'Superviseur technique']].map(([v, l]) => `<option value=\"${v}\"${a.role === v ? ' selected' : ''}>${l}</option>`).join('')}</select><div class=\"hint\">La direction seule peut changer le profil. Le membre se reconnectera avec ses nouvelles permissions.</div></div>` : ''}",
    "        <div class=\"field\"><label for=\"e-pass\">Réinitialiser le mot de passe (optionnel, 6+ caractères)</label><input id=\"e-pass\" type=\"password\" placeholder=\"••••••\"></div>",
    "        <button class=\"btn\" onclick=\"TAKATA_ADMIN.saveAgent(${a.id})\">${icon('check', 16)} Enregistrer les modifications</button>",
    "        <br><a class=\"btn small secondary\" style=\"margin-top:10px\" href=\"#/admin/agents\">Retour aux équipes</a>",
    "      </div>`;",
    "  }",
    "",
    "  async function saveAgent(id) {",
    "    const me = TAKATA.store.user || {};",
    "    const isDir = ['admin', 'admingen'].includes(me.role);",
    "    const body = {",
    "      full_name: document.getElementById('e-name').value,",
    "      phone: document.getElementById('e-phone').value,",
    "      team: document.getElementById('e-team').value,",
    "      region: document.getElementById('e-region').value",
    "    };",
    "    if (isDir && document.getElementById('e-role')) body.role = document.getElementById('e-role').value;",
    "    const pass = document.getElementById('e-pass') ? document.getElementById('e-pass').value : '';",
    "    if (!body.full_name.trim()) return toast('Le nom complet est requis', true);",
    "    try {",
    "      await TAKATA.request('PUT', '/admin/agents/' + id, body);",
    "      if (pass) await TAKATA.request('POST', '/admin/agents/' + id + '/reset-password', { password: pass });",
    "      toast('Compte mis à jour ✅');",
    "      location.hash = '#/admin/agents';",
    "    } catch (e) { toast(e.message || 'Erreur', true); }",
    "  }",
    "",
    "  async function deleteAgent(id) {",
    "    if (!confirm('Supprimer définitivement ce compte ? Irréversible (refusé si le compte possède des données liées).')) return;",
    "    try {",
    "      const r = await TAKATA.request('DELETE', '/admin/agents/' + id);",
    "      toast(r && r.deleted ? 'Compte supprimé définitivement' : 'Compte désactivé : des données lui sont liées');",
    "      renderRoute();",
    "    } catch (e) { toast(e.message || 'Erreur', true); }",
    "  }",
    ""
  ];
  s.splice(createIdx, 0, ...newFns);
  out.push('  admin: agentEditView/saveAgent/deleteAgent insérés');
}

// 5. adminStockView réécrite : saisie manuelle des quantités
replaceBlock(
  "async function adminStockView() {",
  null,
  [
    "  async function adminStockView() {",
    "    const [stock, products, agents] = await Promise.all([get('/admin/stock'), get('/admin/products'), get('/admin/agents')]);",
    "    if (!stock) return errState('box');",
    "    return `",
    "      <div class=\"card\">",
    "        <div class=\"page-title\" style=\"margin:0 0 12px;font-weight:600\">Mouvement de stock (entrée / sortie)</div>",
    "        <div class=\"field\"><label for=\"m-product\">Produit</label><select id=\"m-product\">${(products || []).map((p) => `<option value=\"${p.id}\">${esc(p.name)}</option>`).join('')}</select></div>",
    "        <div class=\"field\"><label for=\"m-agent\">Destination / Source</label><select id=\"m-agent\"><option value=\"\">Dépôt central</option>${(agents || []).map((a) => `<option value=\"${a.id}\">${esc(a.full_name)}</option>`).join('')}</select></div>",
    "        <div class=\"row\"><div class=\"field\"><label for=\"m-type\">Type</label><select id=\"m-type\"><option value=\"in\">Entrée (+)</option><option value=\"out\">Sortie (−)</option><option value=\"return\">Retour</option></select></div>",
    "        <div class=\"field\"><label for=\"m-qty\">Quantité</label><input id=\"m-qty\" type=\"number\" value=\"1\"></div></div>",
    "        <button class=\"btn\" onclick=\"TAKATA_ADMIN.doMove()\">Enregistrer le mouvement</button>",
    "      </div>",
    "      <div class=\"section-title\">Saisie manuelle : quantités possédées</div>",
    "      <div class=\"list\">",
    "        ${stock.map((s) => `<div class=\"card\" style=\"margin:6px 14px\">",
    "          <div class=\"row\"><div style=\"flex:1\"><b>${esc(s.name)}</b><div class=\"muted\">${esc(s.agent)} · ${esc(s.category || '')}</div></div>",
    "          <span class=\"badge ${s.quantity <= 3 ? (s.quantity === 0 ? 'red' : 'amber') : 'green'}\">${s.quantity}</span></div>",
    "          <div class=\"stock-line\" style=\"margin-top:10px\">",
    "            <input id=\"sq-${s.id}\" class=\"num\" type=\"number\" min=\"0\" step=\"1\" value=\"${s.quantity}\" inputmode=\"numeric\" aria-label=\"Quantité possédée de ${esc(s.name)}\">",
    "            <button class=\"btn small\" onclick=\"TAKATA_ADMIN.setStock(${s.id}, ${s.product_id}, ${s.agent_id === null ? 'null' : s.agent_id})\">${icon('check', 15)} Valider</button>",
    "          </div>",
    "          <div class=\"muted\" style=\"font-size:11px;margin-top:4px\">Saisissez la quantité réellement possédée puis validez : un ajustement est tracé dans le journal.</div>",
    "        </div>`).join('') || emptyState('box', 'Aucun stock')}",
    "      </div>",
    "      <div class=\"section-title\">Derniers mouvements</div>",
    "      <div class=\"list\">",
    "        ${(await get('/admin/stock/movements') || []).slice(0, 20).map((m) => `<div class=\"card\" style=\"margin:6px 14px\"><div class=\"row\"><div style=\"flex:1\"><b>${esc(m.product)}</b> <span class=\"muted\">· ${esc(m.agent)}</span></div><b style=\"color:${m.quantity < 0 ? 'var(--red)' : 'var(--green-dark)'}\">${m.quantity > 0 ? '+' : ''}${m.quantity}</b></div><div class=\"muted\" style=\"font-size:11px\">${date(m.created_at)} · ${esc(m.note || m.type)}</div></div>`).join('') || '<div class=\"empty\">Aucun mouvement</div>'}",
    "      </div>",
    "    `;",
    "  }",
    "",
    "  async function setStock(rowId, productId, agentId) {",
    "    const input = document.getElementById('sq-' + rowId);",
    "    const qty = Number(input && input.value);",
    "    if (!Number.isInteger(qty) || qty < 0) return toast('Quantité invalide (entier ≥ 0)', true);",
    "    try {",
    "      const r = await TAKATA.request('POST', '/admin/stock/set', { product_id: productId, agent_id: agentId, quantity: qty });",
    "      toast('Stock mis à jour : ' + r.quantity + ' unité(s)');",
    "      renderRoute();",
    "    } catch (e) { toast(e.message || 'Erreur', true); }",
    "  }",
    ""
  ]
);

// 6. fab SVG
replaceAll('title="${esc(label)}">+</button>', 'title="${esc(label)}">${icon(\'plus\', 24)}</button>');

// 7. exports TAKATA_ADMIN
replaceOnce(
  "adminHomeView, agentsView, agentFormView, createAgent, toggleAgent, resetPassword,",
  "adminHomeView, agentsView, agentFormView, createAgent, saveAgent, agentEditView, deleteAgent, toggleAgent, resetPassword, setStock,"
);

fs.writeFileSync(p, s.join('\n'), 'utf8');
console.log(out.join('\n'));
console.log(miss ? 'IMPL C PARTIELLE (' + miss + ' manqués)' : 'IMPL C OK');