// admin.js — Vues administrateur : agents, produits, stock, rapports, exports
/* global TAKATA, TAKATA_VIEWS */
(function () {
const { esc, money, date, toast, icon } = TAKATA_VIEWS.helpers;
  const get = async (p) => {
    try { return await TAKATA.request('GET', p); }
    catch (e) { toast(e.message || 'Erreur', true); return null; }
  };
  const errState = (icon) => `<div class="empty"><div class="ic">${icon}</div><div>Impossible de charger les données.</div><br><button class="btn small" onclick="renderRoute()">🔄 Réessayer</button></div>`;
  const emptyState = (icon, text) => `<div class="empty"><div class="ic">${icon}</div><div>${esc(text)}</div></div>`;

  // ============ VUE GÉNÉRALE ============
  async function adminHomeView() {
    const o = await get('/admin/overview');
    if (!o) return errState(icon('chart'));
    return `
      <div class="stats">
        <a class="stat" href="#/admin/agents"><div class="num">${o.agents}</div><div class="lbl">Membres actifs</div></a>
        <a class="stat" href="#/customers"><div class="num">${o.customers}</div><div class="lbl">Abonnés</div></a>
        <a class="stat" href="#/prospects"><div class="num">${o.prospects}</div><div class="lbl">Prospects</div></a>
        <a class="stat" href="#/installations"><div class="num">${o.installations}</div><div class="lbl">Réabonnements</div></a>
        <a class="stat" href="#/admin/reports"><div class="num">${money(o.totalPaid)}</div><div class="lbl">Encaissements totaux</div></a>
        <a class="stat" href="#/admin/commissions"><div class="num">${money(o.pendingCommissions)}</div><div class="lbl">Commissions à valider</div></a>
        <a class="stat" href="#/installments?status=overdue"><div class="num">${o.overdue}</div><div class="lbl">Réabonnements en retard</div></a>
        <a class="stat" href="#/admin/stock"><div class="num">${money(o.stockValue)}</div><div class="lbl">Valeur du stock</div></a>
      </div>
      <div class="section-title">Top du périmètre (encaissements)</div>
      <div class="list">
        ${o.topAgents.map((a, i) => `<div class="card" style="margin:6px 14px"><div class="row"><div style="flex:1"><b>${i + 1}. ${esc(a.full_name)}</b> <span class="muted">· ${esc(a.region || '—')} · ${esc(a.role)}</span></div><b style="color:var(--green-dark)">${money(a.collected)}</b></div></div>`).join('') || emptyState('🏅', 'Aucun membre')}
      </div>
      <div class="card"><h3>${icon('check')} Actions rapides</h3>
        <div class="row" style="flex-wrap:wrap">
          <a class="btn small" href="#/admin/agents">${icon('users', 15)} Équipes</a>
          <a class="btn small secondary" href="#/admin/products">${icon('box', 15)} Formules</a>
          <a class="btn small secondary" href="#/admin/stock">${icon('sliders', 15)} Stock</a>
          <a class="btn small secondary" href="#/admin/reports">${icon('chart', 15)} Rapports</a>
        </div>
      </div>
    `;
  }

  const ROLE_LABEL = { agent: 'Commercial', technicien: 'Technicien', admincomm: 'Sup. commercial', admintech: 'Sup. technique', admin: 'Direction (hérité)', admingen: 'Direction' };

  // ============ AGENTS (équipes) ============
  async function agentsView(params, q) {
    const rows = await get('/admin/agents');
    if (!rows) return errState(icon('users'));
    const prof = (q && q.profile) || '';
    const isDir = ['admin', 'admingen'].includes((TAKATA.store.user || {}).role);
    const groups = {
      '': { test: () => true, label: 'Tous' },
      'comm': { test: (a) => a.role === 'agent', label: 'Commerciaux' },
      'tech': { test: (a) => a.role === 'technicien', label: 'Techniciens' },
      'sup': { test: (a) => ['admincomm', 'admintech'].includes(a.role), label: 'Superviseurs' },
      'dir': { test: (a) => ['admin', 'admingen'].includes(a.role), label: 'Direction' }
    };
    const list = prof && groups[prof] ? rows.filter(groups[prof].test) : rows;
    const roleBadge = (a) => {
      if (a.role === 'agent') return `<span class="badge green">${icon('users', 12)} Commercial</span>`;
      if (a.role === 'technicien') return `<span class="badge amber">${icon('truck', 12)} Technicien</span>`;
      if (a.role === 'admincomm') return `<span class="badge gray">${icon('users', 12)} Sup. commercial</span>`;
      if (a.role === 'admintech') return `<span class="badge gray">${icon('truck', 12)} Sup. technique</span>`;
      return `<span class="badge green">${icon('shield', 12)} Direction</span>`;
    };
    const tabs = [['', 'Tous'], ['comm', 'Commerciaux'], ['tech', 'Techniciens'], ['sup', 'Superviseurs'], ['dir', 'Direction']];
    return `
      <div style="display:flex;gap:6px;overflow-x:auto;padding:8px 14px">
        ${tabs.map(([v, l]) => `<a class="badge ${(prof || '') === v ? 'green' : 'gray'}" style="flex:none" href="#/admin/agents${v ? '?profile=' + v : ''}">${l}</a>`).join('')}
      </div>
      <div class="page-sub">Commerciaux et techniciens sont des profils distincts : badges et périmètres séparés.</div>
      <div class="list">
        ${list.map((a) => `<div class="card" style="margin:8px 14px">
          <div class="row"><div class="avatar">${esc(a.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2))}</div>
          <div style="flex:1"><div style="font-weight:600">${esc(a.full_name)} <span class="muted">@${esc(a.username)}</span></div>
          <div style="margin-top:2px">${roleBadge(a)} <span class="muted">· ${esc(a.region || '—')} · ${a.customers} clients · ${money(a.collected)}</span></div>
          <div class="muted" style="margin-top:2px">${icon('phone', 13)} ${a.phone ? esc(a.phone) : 'Numéro non renseigné'}</div></div>
          ${a.active ? '<span class="badge green">Actif</span>' : '<span class="badge red">Désactivé</span>'}</div>
          <hr class="divider">
          <div class="icon-btn-row">
            <a class="btn small secondary" href="#/admin/agents/${a.id}/edit">${icon('edit', 14)} Modifier</a>
            <button class="btn small secondary" onclick="TAKATA_ADMIN.resetPassword(${a.id})">${icon('key', 14)} Mot de passe</button>
            <button class="btn small ${a.active ? 'danger' : 'secondary'}" onclick="TAKATA_ADMIN.toggleAgent(${a.id},${a.active ? 0 : 1})">${a.active ? 'Désactiver' : 'Activer'}</button>
            ${isDir ? `<button class="btn small danger" onclick="TAKATA_ADMIN.deleteAgent(${a.id})">${icon('trash', 14)} Supprimer</button>` : ''}
          </div></div>`).join('') || emptyState(icon('users'), 'Aucun membre dans ce profil')}
      </div>
      ${fab("location.hash='#/admin/agents/new'", 'Nouveau membre')}
    `;
  }

  function fab(action, label) {
    return `<button class="fab" onclick="${action}" title="${esc(label)}">${icon('plus', 24)}</button>`;
  }

  async function agentFormView(params) {
    const me = TAKATA.store.user || {};
    const canPickRole = ['admin', 'admingen'].includes(me.role);
    const forcedRole = me.role === 'admintech' ? 'technicien' : 'agent';
    const roleOptions = [
      ['agent', 'Commercial (agent)'],
      ['technicien', 'Technicien (ramasseur)'],
      ['admincomm', 'Superviseur commercial (admincomm)'],
      ['admintech', 'Superviseur technique (admintech)']
    ].map(([v, lbl]) => {
      const sel = forcedRole === v && !canPickRole ? ' selected' : '';
      return '<option value="' + esc(v) + '"' + sel + '>' + esc(lbl) + '</option>';
    }).join('');
    return `
      <div class="card">
        <div class="page-title" style="margin:0 0 12px">Créer un compte</div>
        <div class="field"><label for="f-name">Nom complet *</label><input id="f-name"></div>
        <div class="field"><label for="f-username">Nom d'utilisateur *</label><input id="f-username" placeholder="ex. agent4"></div>
        <div class="field"><label for="f-password">Mot de passe * (6+ caractères)</label><input id="f-password" type="password" placeholder="ex. agent123"></div>
        <div class="field"><label for="f-role">Profil ${canPickRole ? '' : '(fixé par votre périmètre)'}</label><select id="f-role" ${canPickRole ? '' : 'disabled'}>${roleOptions}</select></div>
        <div class="field"><label for="f-team">Équipe</label><input id="f-team" placeholder="ex. Commercial / Technique"></div>
        <div class="field"><label for="f-phone">Téléphone</label><input id="f-phone" type="tel" placeholder="+243 ..."></div>
        <div class="field"><label for="f-region">Région</label><input id="f-region" placeholder="ex. Ville"></div>
        <button class="btn" onclick="TAKATA_ADMIN.createAgent()">Créer le compte</button>
      </div>`;
  }

  async function createAgent() {
    const me = TAKATA.store.user || {};
    const canPickRole = ['admin', 'admingen'].includes(me.role);
    const roleEl = document.getElementById('f-role');
    const body = {
      full_name: document.getElementById('f-name').value,
      username: document.getElementById('f-username').value,
      password: document.getElementById('f-password').value,
      phone: document.getElementById('f-phone').value,
      team: document.getElementById('f-team').value,
      region: document.getElementById('f-region').value
    };
    if (roleEl && canPickRole && roleEl.value) body.role = roleEl.value;
    if (!body.full_name || !body.username || body.password.length < 6) return toast('Tous les champs requis (mot de passe 6+ caractères)', true);
    try {
      const r = await TAKATA.request('POST', '/admin/agents', body);
      toast('Compte créé ✅ (' + r.role + ')');
      location.hash = '#/admin/agents';
    } catch (e) { toast(e.message || 'Erreur', true); }
  }

  async function agentEditView(params) {
    const me = TAKATA.store.user || {};
    const isDir = ['admin', 'admingen'].includes(me.role);
    const rows = await get('/admin/agents');
    const a = (rows || []).find((x) => x.id === Number(params.id));
    if (!a) return emptyState(icon('user'), 'Membre introuvable dans votre périmètre');
    return `
      <div class="card">
        <div class="page-title" style="margin:0 0 12px;font-weight:600">Modifier le compte — ${esc(a.full_name)}</div>
        <div class="field"><label for="e-name">Nom complet</label><input id="e-name" value="${esc(a.full_name)}"></div>
        <div class="field"><label for="e-phone">${icon('phone', 14)} Téléphone (laisser vide pour supprimer le numéro)</label><input id="e-phone" type="tel" value="${esc(a.phone || '')}" placeholder="+243 ..."></div>
        <div class="field"><label for="e-team">Équipe</label><input id="e-team" value="${esc(a.team || '')}" placeholder="ex. Commercial"></div>
        <div class="field"><label for="e-region">Région</label><input id="e-region" value="${esc(a.region || '')}" placeholder="ex. Kolwezi"></div>
        ${isDir && !['admin', 'admingen'].includes(a.role) ? `<div class="field"><label for="e-role">Profil du compte</label><select id="e-role">${[['agent', 'Commercial'], ['technicien', 'Technicien'], ['admincomm', 'Superviseur commercial'], ['admintech', 'Superviseur technique']].map(([v, l]) => `<option value="${v}"${a.role === v ? ' selected' : ''}>${l}</option>`).join('')}</select><div class="hint">La direction seule peut changer le profil. Le membre se reconnectera avec ses nouvelles permissions.</div></div>` : (isDir ? `<div class="field"><label>Profil du compte</label><div class="muted">Direction — profil protégé, non modifiable.</div></div>` : '')}
        <div class="field"><label for="e-pass">Réinitialiser le mot de passe (optionnel, 6+ caractères)</label><input id="e-pass" type="password" placeholder="••••••"></div>
        <button class="btn" onclick="TAKATA_ADMIN.saveAgent(${a.id})">${icon('check', 16)} Enregistrer les modifications</button>
        <br><a class="btn small secondary" style="margin-top:10px" href="#/admin/agents">Retour aux équipes</a>
      </div>`;
  }

  async function saveAgent(id) {
    const me = TAKATA.store.user || {};
    const isDir = ['admin', 'admingen'].includes(me.role);
    const body = {
      full_name: document.getElementById('e-name').value,
      phone: document.getElementById('e-phone').value,
      team: document.getElementById('e-team').value,
      region: document.getElementById('e-region').value
    };
    if (isDir && document.getElementById('e-role')) body.role = document.getElementById('e-role').value;
    const pass = document.getElementById('e-pass') ? document.getElementById('e-pass').value : '';
    if (!body.full_name.trim()) return toast('Le nom complet est requis', true);
    try {
      await TAKATA.request('PUT', '/admin/agents/' + id, body);
      if (pass) await TAKATA.request('POST', '/admin/agents/' + id + '/reset-password', { password: pass });
      toast('Compte mis à jour ✅');
      location.hash = '#/admin/agents';
    } catch (e) { toast(e.message || 'Erreur', true); }
  }

  async function deleteAgent(id) {
    if (!confirm('Supprimer définitivement ce compte ? Irréversible (refusé si le compte possède des données liées).')) return;
    try {
      const r = await TAKATA.request('DELETE', '/admin/agents/' + id);
      toast(r && r.deleted ? 'Compte supprimé définitivement' : 'Compte désactivé : des données lui sont liées');
      renderRoute();
    } catch (e) { toast(e.message || 'Erreur', true); }
  }

  async function toggleAgent(id, active) {
    const msg = active ? 'Activer cet agent ?' : 'Désactiver cet agent ? Ses accès seront suspendus immédiatement.';
    if (!confirm(msg)) return;
    try {
      await TAKATA.request('PUT', `/admin/agents/${id}`, { active });
      toast(active ? 'Agent activé ✅' : 'Agent désactivé');
      renderRoute();
    } catch (e) { toast(e.message, true); }
  }

  async function resetPassword(id) {
    const password = prompt('Nouveau mot de passe (6+ caractères) :');
    if (!password || password.length < 6) return;
    try {
      await TAKATA.request('POST', `/admin/agents/${id}/reset-password`, { password });
      toast('Mot de passe réinitialisé ✅');
    } catch (e) { toast(e.message, true); }
  }

  // ============ PRODUITS ============
  async function productsView() {
    const rows = await get('/admin/products');
    if (!rows) return errState(icon('box'));
    return `
      <div class="list">
        ${rows.map((p) => `<div class="card" style="margin:8px 14px">
          <div class="row"><div style="flex:1"><div style="font-weight:600">${esc(p.name)}</div>
          <div class="muted">${esc(p.category)} · ${money(p.price)} · Commission ${p.commission_rate}%${p.payg ? ' · mensuel ' + p.nb_installments + ' éch.' : ''}</div></div>
          ${p.active ? '<span class="badge green">Actif</span>' : '<span class="badge gray">Inactif</span>'}</div>
          <hr class="divider"><div class="row">
            <button class="btn small secondary" onclick="TAKATA_ADMIN.editProduct(${p.id})">${icon('edit', 14)} Modifier</button>
            ${p.active ? `<button class="btn small danger" onclick="TAKATA_ADMIN.toggleProduct(${p.id},0)">Désactiver</button>` : `<button class="btn small" onclick="TAKATA_ADMIN.toggleProduct(${p.id},1)">Activer</button>`}
          </div></div>`).join('') || emptyState(icon('box'), 'Aucun produit')}
      </div>
      ${fab("location.hash='#/admin/products/new'", 'Nouveau produit')}
    `;
  }

  async function productFormView(params) {
    let p = { name: '', category: 'Formule collecte', price: '', cost: '', commission_rate: 20, payg: 0, nb_installments: 1, active: 1 };
    let isEdit = false;
    if (params.id && params.id !== 'new') {
      const rows = await get('/admin/products');
      p = (rows || []).find((x) => x.id === Number(params.id)) || p;
      isEdit = true;
    }
    return `
      <div class="card">
        <div class="page-title" style="margin:0 0 12px">${isEdit ? 'Modifier la formule' : 'Nouvelle formule'}</div>
        <div class="field"><label for="f-name">Nom *</label><input id="f-name" value="${esc(p.name)}"></div>
        <div class="field"><label for="f-category">Catégorie</label><input id="f-category" value="${esc(p.category)}" placeholder="ex. Formule collecte / Intrant"></div>
        <div class="row"><div class="field"><label for="f-price">Prix (FC) *</label><input id="f-price" type="number" value="${p.price}"></div>
        <div class="field"><label for="f-cost">Coût (FC)</label><input id="f-cost" type="number" value="${p.cost}"></div></div>
        <div class="field"><label for="f-comm">Commission (%)</label><input id="f-comm" type="number" step="0.5" value="${p.commission_rate}"></div>
        <div class="field"><label for="f-payg"><input id="f-payg" type="checkbox" ${p.payg ? 'checked' : ''}> Paiement mensuel récurrent (échéancier)</label></div>
        <div class="field"><label for="f-nb">Nombre d'échéances</label><input id="f-nb" type="number" value="${p.nb_installments}"></div>
        <button class="btn" onclick="TAKATA_ADMIN.saveProduct('${params.id}',${isEdit})">Enregistrer</button>
      </div>`;
  }

  async function saveProduct(id, isEdit) {
    const body = {
      name: document.getElementById('f-name').value,
      category: document.getElementById('f-category').value,
      price: Number(document.getElementById('f-price').value),
      cost: Number(document.getElementById('f-cost').value || 0),
      commission_rate: Number(document.getElementById('f-comm').value || 0),
      payg: document.getElementById('f-payg').checked ? 1 : 0,
      nb_installments: Number(document.getElementById('f-nb').value || 1)
    };
    if (!body.name || !body.price) return toast('Nom et prix requis', true);
    try {
      if (isEdit) await TAKATA.request('PUT', `/admin/products/${id}`, body);
      else await TAKATA.request('POST', '/admin/products', body);
      toast('Produit enregistré ✅');
      location.hash = '#/admin/products';
    } catch (e) { toast(e.message, true); }
  }

  async function toggleProduct(id, active) {
    if (!confirm(active ? 'Réactiver ce produit ?' : 'Désactiver ce produit ? Il ne pourra plus être vendu.')) return;
    try {
      await TAKATA.request('PUT', `/admin/products/${id}`, { active });
      toast(active ? 'Produit activé ✅' : 'Produit désactivé');
      renderRoute();
    } catch (e) { toast(e.message, true); }
  }

  async function editProduct(id) { location.hash = `#/admin/products/${id}/edit`; }

  // ============ STOCK ADMIN ============
  async function adminStockView() {
    const [stock, products, agents] = await Promise.all([get('/admin/stock'), get('/admin/products'), get('/admin/agents')]);
    if (!stock) return errState(icon('box'));
    return `
      <div class="card">
        <div class="page-title" style="margin:0 0 12px;font-weight:600">Mouvement de stock (entrée / sortie)</div>
        <div class="field"><label for="m-product">Produit</label><select id="m-product">${(products || []).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
<div class="field"><label>Attribuer à — cliquez pour sélectionner</label>
        <input type="hidden" id="m-agent" value="">
        <div class="chip-row" id="m-agent-chips">
          <button type="button" class="badge green chip sel" data-id="" onclick="TAKATA_ADMIN.pickAgent(this)">Dépôt central</button>
          ${(agents || []).filter((x) => x.active).map((a) => `<button type="button" class="badge gray chip" data-id="${a.id}" onclick="TAKATA_ADMIN.pickAgent(this)">${esc(a.full_name)}</button>`).join('')}
        </div>
        <div class="hint">Sélection : <b id="m-agent-label">Dépôt central</b></div></div>
        <div class="row"><div class="field"><label for="m-type">Type</label><select id="m-type"><option value="in">Entrée (+)</option><option value="out">Sortie (−)</option><option value="return">Retour</option></select></div>
        <div class="field"><label for="m-qty">Quantité</label><input id="m-qty" type="number" value="1"></div></div>
        <button class="btn" onclick="TAKATA_ADMIN.doMove()">Enregistrer le mouvement</button>
      </div>
      <div class="section-title">Saisie manuelle : quantités possédées</div>
      <div class="list">
        ${stock.map((s) => `<div class="card" style="margin:6px 14px">
          <div class="row"><div style="flex:1"><b>${esc(s.name)}</b><div class="muted">${esc(s.agent)}</div></div>
          <span class="badge ${s.quantity <= 3 ? (s.quantity === 0 ? 'red' : 'amber') : 'green'}">${s.quantity}</span></div>
          <div class="stock-line" style="margin-top:10px">
<input id="sq-${s.id}" class="num" type="number" min="0" step="1" value="${s.quantity}" data-prev="${s.quantity}" inputmode="numeric" aria-label="Quantité possédée de ${esc(s.name)}">
            <button class="btn small" onclick="TAKATA_ADMIN.setStock(${s.id}, ${s.product_id}, ${s.agent_id === null ? 'null' : s.agent_id})">${icon('check', 15)} Valider</button>
          </div>
          <div class="muted" style="font-size:11px;margin-top:4px">Saisissez la quantité réellement possédée puis validez : un ajustement est tracé dans le journal.</div>
        </div>`).join('') || emptyState(icon('box'), 'Aucun stock')}
      </div>
      <div class="section-title">Derniers mouvements</div>
      <div class="list">
        ${(await get('/admin/stock/movements') || []).slice(0, 20).map((m) => `<div class="card" style="margin:6px 14px"><div class="row"><div style="flex:1"><b>${esc(m.product)}</b> <span class="muted">· ${esc(m.agent)}</span></div><b style="color:${m.quantity < 0 ? 'var(--red)' : 'var(--green-dark)'}">${m.quantity > 0 ? '+' : ''}${m.quantity}</b></div><div class="muted" style="font-size:11px">${date(m.created_at)} · ${esc(m.note || m.type)}</div></div>`).join('') || '<div class="empty">Aucun mouvement</div>'}
      </div>
    `;
  }

  async function setStock(rowId, productId, agentId) {
    const input = document.getElementById('sq-' + rowId);
    const qty = Number(input && input.value);
    if (!Number.isInteger(qty) || qty < 0) return toast('Quantité invalide (entier ≥ 0)', true);
    try {
      const r = await TAKATA.request('POST', '/admin/stock/set', { product_id: productId, agent_id: agentId, quantity: qty });
      toast('Stock mis à jour : ' + r.quantity + ' unité(s)');
      renderRoute();
    } catch (e) { toast(e.message || 'Erreur', true); }
  }


  function pickAgent(btn) {
    const row = document.getElementById('m-agent-chips');
    if (row) row.querySelectorAll('.chip').forEach((c) => { c.classList.remove('sel', 'green'); c.classList.add('gray'); });
    btn.classList.add('sel', 'green'); btn.classList.remove('gray');
    const hid = document.getElementById('m-agent'); if (hid) hid.value = btn.dataset.id || '';
    const lbl = document.getElementById('m-agent-label'); if (lbl) lbl.textContent = btn.textContent.trim();
  }

  async function doMove() {
    const body = {
      product_id: Number(document.getElementById('m-product').value),
      agent_id: document.getElementById('m-agent').value ? Number(document.getElementById('m-agent').value) : null,
      type: document.getElementById('m-type').value,
      quantity: Number(document.getElementById('m-qty').value)
    };
    if (!body.product_id || !body.quantity) return toast('Produit et quantité requis', true);
    try {
      await TAKATA.request('POST', '/admin/stock/move', body);
      toast('Mouvement enregistré ✅');
      renderRoute();
    } catch (e) { toast(e.message, true); }
  }

  // ============ COMMISSIONS ADMIN ============
  async function adminCommissionsView() {
    const d = await get('/commissions');
    if (!d) return errState(icon('award'));
    const pending = d.rows.filter((c) => c.status === 'pending');
    return `
      <div class="stats">
        <div class="stat"><div class="num">${money(d.totals.pending)}</div><div class="lbl">À payer</div></div>
        <div class="stat"><div class="num">${money(d.totals.paid)}</div><div class="lbl">Payées</div></div>
      </div>
      <div class="list">
        ${d.rows.map((c) => `<div class="card" style="margin:6px 14px"><div class="row"><div style="flex:1"><b>${esc(c.agent)}</b><div class="muted">${money(c.amount)} · ${date(c.created_at)}</div></div>${badgeC(c.status)}</div></div>`).join('') || emptyState('🏅', 'Aucune commission')}
      </div>
      ${pending.length ? `<div style="padding:0 14px"><button class="btn" onclick="TAKATA_ADMIN.payCommissions()">${icon('wallet')} Payer les ${pending.length} commission(s) en attente</button></div>` : ''}
    `;
  }
  const badgeC = (s) => s === 'paid' ? '<span class="badge green">Validée</span>' : '<span class="badge red">À valider</span>';

  async function payCommissions() {
    const d = await get('/commissions');
    const ids = d.rows.filter((c) => c.status === 'pending').map((c) => c.id);
    if (!ids.length) return;
    const total = d.rows.filter((c) => c.status === 'pending').reduce((a, c) => a + c.amount, 0);
    if (!confirm(`Marquer ${ids.length} commission(s) comme payées pour un total de ${total.toLocaleString('fr-FR')} FC ? Cette action est définitive.`)) return;
    try {
      await TAKATA.request('POST', '/admin/commissions/pay', { ids });
      toast('Commissions marquées payées ✅');
      renderRoute();
    } catch (e) { toast(e.message, true); }
  }

  // ============ RAPPORTS ============
  async function reportsView() {
    const r = await get('/reports/summary');
    if (!r) return errState(icon('chart'));
    const exportsList = [
['customers', 'users', 'Clients'], ['prospects', 'target', 'Prospects'], ['installations', 'recycle', 'Réabonnements'],
['payments', 'wallet', 'Paiements'], ['installments', 'calendar', 'Échéances'], ['agents', 'user', 'Agents'], ['commissions', 'award', 'Commissions']
    ];
    return `
      <div class="card">
        <div class="kv"><span>Encaissements totaux</span><b style="color:var(--green-dark)">${money(r.payments.total)}</b></div>
        <div class="kv"><span>Nombre de paiements</span><b>${r.payments.count}</b></div>
        <div class="kv"><span>Réabonnements en service</span><b>${r.installations}</b></div>
        <div class="kv"><span>Nouveaux clients</span><b>${r.newCustomers}</b></div>
      </div>
      <div class="section-title">Par méthode de paiement</div>
      <div class="list">
        ${r.byMethod.map((m) => `<div class="card" style="margin:6px 14px"><div class="row"><div style="flex:1"><b>${esc(m.method)}</b> <span class="muted">· ${m.count} paiement(s)</span></div><b>${money(m.total)}</b></div></div>`).join('') || emptyState('💸', 'Aucun paiement')}
      </div>
      <div class="section-title">Par agent</div>
      <div class="list">
        ${r.byAgent.map((a) => `<div class="card" style="margin:6px 14px"><div class="row"><div style="flex:1"><b>${esc(a.agent)}</b></div><b style="color:var(--green-dark)">${money(a.total)}</b></div></div>`).join('') || emptyState('👤', 'Aucun agent')}
      </div>
      <div class="section-title">Exports CSV</div>
      <div class="list">
        ${exportsList.map(([t, ic, l]) => `<a class="list-item" href="#" onclick="event.preventDefault();TAKATA_ADMIN.downloadExport('${t}','${l}')"><div class="avatar">${icon(ic, 18)}</div><div class="body"><div class="title">Exporter : ${esc(l)}</div><div class="desc">Fichier CSV compatible Excel</div></div><div class="chevron">↓</div></a>`).join('')}
      </div>
    `;
  }

  async function downloadExport(type, label) {
    try {
      const res = await fetch('/api/reports/export/' + type, { headers: { 'Authorization': 'Bearer ' + TAKATA.store.token } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur ' + res.status }));
        toast(err.error || 'Échec de l\'export', true);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const m = disposition.match(/filename="?([^";]+)"?/);
      const filename = m ? m[1] : `takata_${type}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Export téléchargé ✅');
    } catch (e) { toast('Erreur d\'export', true); }
  }

  // ============ REGISTRE ============

  // ============ JOURNAL D AUDIT (direction) ============
  async function auditView(q) {
    const search = (q && q.q) || '';
    let rows = [];
    try { rows = await TAKATA.audit(300, search); } catch (e) { return emptyState('x', 'Acces refuse', (e && e.message) || 'Reserve a la direction'); }
    const body = rows.map((r) => '<tr>' +
      '<td class="muted" style="white-space:nowrap">' + esc(String(r.at).slice(0, 16)) + '</td>' +
      '<td>' + esc(r.username || '\u2014') + '</td>' +
      '<td>' + esc(r.role || '\u2014') + '</td>' +
      '<td>' + esc(r.action || '') + '</td>' +
      '<td class="muted">' + esc(r.details || '') + '</td>' +
      '<td class="muted" style="font-size:11px">' + esc(r.ip || '') + '</td></tr>').join('');
    const table = rows.length
      ? '<div style="overflow-x:auto"><table class="table"><thead><tr><th>Date</th><th>Utilisateur</th><th>Role</th><th>Action</th><th>Details</th><th>IP</th></tr></thead><tbody>' + body + '</tbody></table></div>'
      : emptyState('inbox', 'Aucune entree', 'Les actions sensibles apparaitront ici.');
    return '<div class="card"><div class="row"><div style="flex:1"><div style="font-weight:600">Journal d audit</div>'+
      '<div class="muted">' + rows.length + ' derniere(s) action(s) : connexions, creations, modifications, suppressions, exports.</div></div></div>'+
      '<div class="row" style="margin:10px 0;gap:8px"><input id="audit-q" placeholder="Rechercher (utilisateur, action...)" value="' + esc(search) + '" style="flex:1">'+
      '<button class="btn small" onclick="location.hash=\'#/admin/audit?q=\'+encodeURIComponent(document.getElementById(\'audit-q\').value)">Filtrer</button></div>' + table + '</div>';
  }
  window.TAKATA_ADMIN = {
auditView, adminHomeView, agentsView, agentFormView, createAgent, saveAgent, agentEditView, deleteAgent, toggleAgent, resetPassword, setStock, downloadExport,
    productsView, productFormView, saveProduct, toggleProduct, editProduct,
    adminStockView, doMove, pickAgent, adminCommissionsView, payCommissions, reportsView
  };
})();