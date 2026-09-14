// tests/impl_v43f.js — front : vues technicien/superviseur + restriction direction-only
const fs = require('fs');
const path = require('path');
const out = [];
let miss = 0;

const vf = path.join(__dirname, '..', 'public', 'js', 'views.js');
let v = fs.readFileSync(vf, 'utf8');

// 1. Login : retrait du sous-titre « Collecte des déchets ménagers »
if (v.includes('<div class="auth-sub">Collecte des déchets ménagers</div>')) {
  v = v.replace('<div class="auth-sub">Collecte des déchets ménagers</div>', '');
  out.push('  views: sous-titre retiré du login');
} else out.push('  views: sous-titre déjà absent');

// 2. Formulaire d\'abonnement : uniquement les formules de collecte (pas les intrants)
v = v.replace(
  "<select id=\"f-product\">${(products || []).map((p) => `<option value=\"${p.id}\">${esc(p.name)} — ${money(p.price)}${p.payg ? ' (mensuel)' : ''}</option>`).join('')}</select>",
  "<select id=\"f-product\">${(products || []).filter((p) => p.category === 'Formule collecte').map((p) => `<option value=\"${p.id}\">${esc(p.name)} — ${money(p.price)}${p.payg ? ' (mensuel)' : ''}</option>`).join('')}</select>"
);
out.push('  views: formules de collecte uniquement dans le formulaire d\'abonnement');

// 3. Vues techniques : Matériel (disponibilité + signaler), Tournées technicien, Tournées admin, Demandes
const beforeExport = v.indexOf('  // ============ RAPPORTS TECHNIQUES (métier : évacuations, désinfections) ============');
if (beforeExport === -1) { out.push('  ⚠️ views: ancre rapports techniques non trouvée'); process.exit(1); }
const newViews = [
  "  // ============ MATÉRIEL TECHNICIEN : disponibilité + signaler un besoin ============",
  "  async function techMatosView() {",
  "    const stock = await get('/stock');",
  "    if (stock === null) return emptyState('wifiOff', 'Hors ligne — réessayez plus tard');",
  "    const demandes = (await get('/tech/demandes')) || [];",
  "    const ouvertes = demandes.filter((d) => d.statut === 'ouverte');",
  "    return `",
  "      <div class=\"page-title\">Matériel — disponibilité</div>",
  "      <div class=\"list\">",
  "        ${stock.map((p) => `<div class=\"list-item\" style=\"cursor:default\">",
  "          <div class=\"avatar\">${icon('box', 18)}</div>",
  "          <div class=\"body\"><div class=\"title\">${esc(p.name)}</div>",
  "          <div class=\"desc\">${p.disponible ? 'Disponible sur le dépôt (demandez la dotation au superviseur technique)' : 'Indisponible pour le moment'}</div></div>",
  "          ${p.disponible ? '<span class=\"badge green\">Disponible</span>' : '<span class=\"badge red\">Indisponible</span>'}</div>`).join('') || emptyState('box', 'Aucun intrant référencé')}",
  "      </div>",
  "      <div class=\"section-title\">Signaler un besoin de matériel</div>",
  "      <form class=\"card\" onsubmit=\"return TAKATA_VIEWS.submitTechBesoin(event)\">",
  "        <div class=\"field\"><label for=\"b-product\">Intrant demandé</label><select id=\"b-product\">${stock.map((p) => `<option value=\"${p.product_id}\">${esc(p.name)}</option>`).join('')}</select></div>",
  "        <div class=\"field\"><label for=\"b-qte\">Quantité souhaitée</label><input id=\"b-qte\" type=\"number\" min=\"1\" value=\"1\"></div>",
  "        <div class=\"field\"><label for=\"b-motif\">Motif</label><textarea id=\"b-motif\" rows=\"2\" placeholder=\"Ex. : sacs pour la tournée de la semaine…\"></textarea></div>",
  "        <button class=\"btn\" type=\"submit\">${icon('check', 16)} Envoyer la demande au superviseur</button>",
  "      </form>",
  "      ${ouvertes.length ? `<div class=\"section-title\">Mes demandes en attente (${ouvertes.length})</div><div class=\"list\">",
  "        ${ouvertes.map((d) => `<div class=\"list-item\" style=\"cursor:default\"><div class=\"body\"><div class=\"title\">${esc(d.produit)} × ${d.quantite}</div><div class=\"desc\">${esc(d.motif || 'Sans motif')}</div></div><span class=\"badge amber\">En attente</span></div>`).join('')}</div>` : ''}",
  "    `;",
  "  }",
  "",
  "  async function submitTechBesoin(e) {",
  "    e.preventDefault();",
  "    const body = {",
  "      product_id: Number(document.getElementById('b-product').value),",
  "      quantite: Number(document.getElementById('b-qte').value) || 0,",
  "      motif: document.getElementById('b-motif').value",
  "    };",
  "    if (body.quantite <= 0) return toast('Indiquez la quantité souhaitée', true);",
  "    try {",
  "      await TAKATA.offlineAware('POST', '/tech/demandes', body);",
  "      toast('Demande envoyée au superviseur technique ✅');",
  "      renderRoute();",
  "    } catch (err) { toast(err.message || 'Erreur', true); }",
  "    return false;",
  "  }",
  "",
  "  // ============ TOURNÉES : le technicien valide les siennes ============",
  "  async function techTourneesView() {",
  "    const rows = await get('/tech/tournees');",
  "    if (rows === null) return emptyState('wifiOff', 'Hors ligne — réessayez plus tard');",
  "    const enCours = rows.filter((r) => r.statut !== 'validee');",
  "    const faites = rows.filter((r) => r.statut === 'validee');",
  "    return `",
  "      <div class=\"page-title\">Mes tournées</div>",
  "      <div class=\"section-title\">À faire (${enCours.length})</div>",
  "      <div class=\"list\">",
  "        ${enCours.map((r) => `<div class=\"card\" style=\"margin:8px 14px\">",
  "          <div class=\"row\"><div class=\"avatar\">${icon('truck', 18)}</div>",
  "          <div style=\"flex:1\"><div style=\"font-weight:600\">${esc(r.zone || 'Tournée')}</div>",
  "          <div class=\"muted\">${date(r.date)} · ${r.menages_prevus} ménage(s) prévu(s) · assignée par ${esc(r.assigne_par)}</div></div>",
  "          <span class=\"badge amber\">Assignée</span></div>",
  "          <hr class=\"divider\">",
  "          <div class=\"field\"><label for=\"v-men-${r.id}\">Ménages servis réellement</label><input id=\"v-men-${r.id}\" type=\"number\" min=\"0\" value=\"${r.menages_prevus}\"></div>",
  "          <div class=\"field\"><label for=\"v-obs-${r.id}\">Observations</label><textarea id=\"v-obs-${r.id}\" rows=\"2\" placeholder=\"Ex. : tout est fait, 2 ménages absents…\"></textarea></div>",
  "          <button class=\"btn small\" onclick=\"TAKATA_VIEWS.valideTournee(${r.id})\">${icon('check', 15)} Valider la tournée faite</button>",
  "        </div>`).join('') || emptyState('truck', 'Aucune tournée assignée — votre superviseur vous en assignera')}",
  "      </div>",
  "      <div class=\"section-title\">Validées (${faites.length})</div>",
  "      <div class=\"list\">",
  "        ${faites.map((r) => `<div class=\"list-item\" style=\"cursor:default\"><div class=\"avatar\">${icon('check', 18)}</div>",
  "          <div class=\"body\"><div class=\"title\">${esc(r.zone || 'Tournée')} — ${date(r.date)}</div>",
  "          <div class=\"desc\">${r.menages_servis} ménage(s) servi(s)${r.observations ? ' · ' + esc(r.observations).slice(0, 80) : ''}</div></div>",
  "          <span class=\"badge green\">Validée</span></div>`).join('') || emptyState('check', 'Aucune tournée validée')}",
  "      </div>`;",
  "  }",
  "",
  "  async function valideTournee(id) {",
  "    const body = {",
  "      menages_servis: Number(document.getElementById('v-men-' + id).value) || 0,",
  "      observations: document.getElementById('v-obs-' + id).value",
  "    };",
  "    try {",
  "      await TAKATA.offlineAware('POST', `/tech/tournees/${id}/valider`, body);",
  "      toast('Tournée validée ✅ le superviseur technique est notifié');",
  "      renderRoute();",
  "    } catch (err) { toast(err.message || 'Erreur', true); }",
  "  }",
  "",
  "  // ============ SUPERVISION : assigner les tournées, traiter les demandes (admintech / direction) ============",
  "  async function techSupervisionView() {",
  "    const me = TAKATA.store.user || {};",
    "    const isAdminDir = ['admin', 'admingen'].includes(me.role);",
  "    const [techs, tournees, demandes, stock] = await Promise.all([",
  "      get('/admin/agents'), get('/tech/tournees'), get('/tech/demandes'), get('/admin/stock')",
  "    ]);",
  "    if (techs === null) return emptyState('wifiOff', 'Hors ligne — réessayez plus tard');",
  "    const techniciens = (techs || []).filter((a) => a.role === 'technicien' && a.active);",
  "    const ouverteDemandes = (demandes || []).filter((d) => d.statut === 'ouverte');",
  "    return `",
  "      <div class=\"page-title\">Technique — tournées &amp; matériel</div>",
  "      <div class=\"card\">",
  "        <h3>${icon('truck', 16)} Assigner une tournée à un technicien</h3>",
  "        <div class=\"field\"><label for=\"as-tech\">Technicien</label><select id=\"as-tech\">${techniciens.map((x) => `<option value=\"${x.id}\">${esc(x.full_name)}</option>`).join('')}</select></div>",
  "        <div class=\"row\">",
  "          <div class=\"field\"><label for=\"as-date\">Date</label><input id=\"as-date\" type=\"date\" value=\"${new Date().toISOString().slice(0, 10)}\"></div>",
  "          <div class=\"field\"><label for=\"as-men\">Ménages prévus</label><input id=\"as-men\" type=\"number\" min=\"0\" value=\"0\"></div>",
  "        </div>",
  "        <div class=\"field\"><label for=\"as-zone\">Zone / quartier de la tournée</label><input id=\"as-zone\" placeholder=\"ex. Quartier Industriel, Av. …\"></div>",
  "        <button class=\"btn small\" onclick=\"TAKATA_VIEWS.assignTournee()\">${icon('check', 15)} Assigner la tournée</button>",
  "      </div>",
  "      <div class=\"section-title\">Tournées assignées</div>",
  "      <div class=\"list\">",
  "        ${(tournees || []).map((r) => `<div class=\"list-item\" style=\"cursor:default\"><div class=\"avatar\">${icon('truck', 18)}</div>",
  "          <div class=\"body\"><div class=\"title\">${esc(r.zone || 'Tournée')} — ${date(r.date)}</div>",
  "          <div class=\"desc\">${esc(r.technicien)} · ${r.menages_prevus} prévu(s) · assignée par ${esc(r.assigne_par)}</div></div>",
  "          ${r.statut === 'validee' ? '<span class=\"badge green\">Validée</span>' : '<span class=\"badge amber\">En attente</span>'}</div>`).join('') || emptyState('truck', 'Aucune tournée assignée')}",
  "      </div>",
  "      <div class=\"section-title\">Demandes de matériel (${ouverteDemandes.length} en attente)</div>",
  "      <div class=\"list\">",
  "        ${(demandes || []).map((d) => `<div class=\"list-item\" style=\"cursor:default\"><div class=\"body\"><div class=\"title\">${esc(d.technicien)} — ${esc(d.produit)} × ${d.quantite}</div>",
  "          <div class=\"desc\">${esc(d.motif || 'Sans motif')}</div></div>",
  "          ${d.statut === 'ouverte' ? `<button class=\"btn small secondary\" onclick=\"TAKATA_VIEWS.traiterDemande(${d.id})\">${icon('check', 14)} Traiter</button>` : '<span class=\"badge green\">Traitée</span>'}</div>`).join('') || emptyState('box', 'Aucune demande')}",
  "      </div>",
  "      <div class=\"section-title\">État du stock et matériel alloué</div>",
  "      <div class=\"list\">",
  "        ${(stock || []).map((s) => `<div class=\"list-item\" style=\"cursor:default\">",
  "          <div class=\"body\"><div class=\"title\">${esc(s.name)} — ${esc(s.agent || 'Dépôt central')}</div>",
  "          <div class=\"desc\">Quantité : ${s.quantity}${isAdminDir ? ' · Coût unitaire : ' + money(s.cost) : ''}</div></div>",
  "          ${s.quantity > 0 ? '<span class=\"badge green\">Disponible</span>' : '<span class=\"badge red\">Rupture</span>'}</div>`).join('') || emptyState('box', 'Aucun stock')}",
  "      </div>",
  "      ${isAdminDir ? '<div class=\"card\"><h3>' + icon(\'sliders\', 16) + ' Saisie du stock</h3><p class=\"muted\">La saisie et la modification du stock se font dans Supervision → Stock (réservées à la direction).</p></div>' : ''}",
  "    `;",
  "  }",
  "",
  "  async function assignTournee() {",
  "    const body = {",
  "      technicien_id: Number(document.getElementById('as-tech').value),",
  "      date: document.getElementById('as-date').value,",
  "      zone: document.getElementById('as-zone').value,",
  "      menages_prevus: Number(document.getElementById('as-men').value) || 0",
  "    };",
  "    try {",
  "      await TAKATA.request('POST', '/tech/tournees', body);",
  "      toast('Tournée assignée ✅ le technicien la voit dans son compte');",
  "      renderRoute();",
  "    } catch (err) { toast(err.message || 'Erreur', true); }",
  "  }",
  "",
  "  async function traiterDemande(id) {",
  "    try {",
  "      await TAKATA.request('POST', `/tech/demandes/${id}/traiter`);",
  "      toast('Demande marquée traitée ✅');",
  "      renderRoute();",
  "    } catch (err) { toast(err.message || 'Erreur', true); }",
  "  }",
  "",
  "  window.TAKATA_VIEWS = {"
].join('\n');
v = v.slice(0, beforeExport) + newViews + v.slice(beforeExport + 'window.TAKATA_VIEWS = {'.length);
out.push('  views: vues matériels/tournées/supervision insérées');

// 4. Exports
v = v.replace(
  "    loginView, submitLogin, togglePassword, techDayView, submitTechReport, techHistoryView, techReportDetailView, techCompilationView, dashboardView,",
  "    loginView, submitLogin, togglePassword, techDayView, submitTechReport, techHistoryView, techReportDetailView, techCompilationView, techMatosView, submitTechBesoin, techTourneesView, valideTournee, techSupervisionView, assignTournee, traiterDemande, dashboardView,"
);
out.push('  views: exports mis à jour');

fs.writeFileSync(vf, v, 'utf8');
console.log(out.join('\n'));
console.log(miss ? 'FRONT PARTIEL' : 'FRONT OK');