// views.js — Vues agent & partagées (rendu HTML + câblage)
/* global TAKATA */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FC';
  const date = (s) => s ? String(s).slice(0, 10) : '—';
  const phone = (s) => esc(s || '—');
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const badge = (status) => {
    const map = {
      'actif': ['green', 'Actif'], 'installé': ['green', 'En service'], 'en attente': ['amber', 'En attente'], 'inactif': ['gray', 'Inactif'],
      'nouveau': ['green', 'Nouveau'], 'contacté': ['amber', 'Contacté'], 'converti': ['gray', 'Converti'], 'perdu': ['gray', 'Perdu'],
      'pending': ['amber', 'En attente'], 'paid': ['green', 'Payée'], 'overdue': ['red', 'En retard'],
      'installé2': ['green', 'En service'], 'planifiée': ['amber', 'Planifiée'],
      'cash': ['green', 'Espèces'], 'mobile_money': ['green', 'Mobile Money'], 'bank': ['gray', 'Banque'], 'card': ['gray', 'Carte'],
      'done': ['green', 'OK'], 'error': ['red', 'Erreur']
    };
    const [cls, label] = map[status] || ['gray', esc(status)];
    return `<span class="badge ${cls}">${label}</span>`;
  };

  // ---- Icônes SVG premium (inline, stroke, aucune dépendance réseau) ----
  const ICONS = {
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    recycle: '<path d="M7 19H4.815a1.126 1.126 0 0 1-1.027-.671L1.842 14.6a1.126 1.126 0 0 1 .5-1.425l4.5-2.5"/><path d="M2 8l5-5 5 5"/><path d="M16.5 10.5L21 6"/><path d="M19.597 21.482A1.126 1.126 0 0 0 21 20.446v-3.946"/><path d="M9 14l3.5 6h-7"/><path d="M16 14l3-6 3 6h-6.5"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'wifi-off': '<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
    truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'
  };
  function icon(name, size) {
    const pathData = ICONS[name];
    if (!pathData) return '';
    const s = size || 18;
    return '<svg class="ico" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + pathData + '</svg>';
  }

  // Toast
  // Toast
  function toast(msg, isError) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.className = 'toast'), 2600);
  }

  // Récupération avec repli hors-ligne
  async function get(path) {
    try { return await TAKATA.request('GET', path); }
    catch (e) {
      if (e instanceof TypeError || e.status === 0) {
        toast('Hors ligne : données non disponibles', true);
        return null;
      }
      throw e;
    }
  }

  function fab(action, label) {
    return `<button class="fab" onclick="${action}" title="${esc(label)}">+</button>`;
  }

  function searchBar(ph, value, oninput) {
    return `<div class="searchbar"><input id="search-input" aria-label="${esc(ph)}" placeholder="${esc(ph)}" value="${esc(value || '')}" oninput="${oninput}"></div>`;
  }

  function emptyState(icon, text) {
    return `<div class="empty"><div class="ic">${icon}</div><div>${esc(text)}</div></div>`;
  }

  function listItem(avatar, title, desc, extra, href) {
    const av = String(avatar || '');
    const avatarHtml = av.indexOf('<svg') === 0 ? av : esc(av); // les icônes SVG passent telles quelles, le reste est échappé
    return `<a class="list-item" href="${href}"><div class="avatar">${avatarHtml}</div><div class="body"><div class="title">${title}</div><div class="desc">${desc}</div>${extra || ''}</div><div class="chevron">›</div></a>`;
  }

  // ============ CONNEXION ============
  async function loginView() {
    return `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-logo">${icon('leaf', 30)}</div>
        <div class="auth-title">Takata Kwetu</div>
        
        <form id="login-form" onsubmit="return TAKATA_VIEWS.submitLogin(event)">
          <div class="field" id="field-user">
          <label for="login-username">Nom d'utilisateur</label>
          <input id="login-username" name="username" autocomplete="username" placeholder="ex. agent1" required>
          <div class="field-error" id="err-user"></div>
        </div>
          <div class="field" id="field-code" style="display:none">
            <label for="login-code">Code de vérification (double authentification)</label>
            <input id="login-code" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="6 chiffres" maxlength="6">
            <div class="field-error" id="err-code"></div>
          </div>
          <div class="field" id="field-pass">
          <label for="login-password">Mot de passe</label>
          <div class="pass-wrap">
            <input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="••••••" required>
            <button type="button" class="pass-eye" id="eye-btn" onclick="TAKATA_VIEWS.togglePassword()" aria-label="Afficher ou masquer le mot de passe">${icon('eye', 18)}</button>
          </div>
          <div class="field-error" id="err-pass"></div>
        </div>
        <div class="login-error" id="login-error" style="display:none"></div>
          <button class="btn" type="submit">Se connecter</button>
        </form>
        <div class="auth-foot">Le partenaire de votre confort, au soin de notre environnement.</div>
      </div>
    </div>`;
  }

  function togglePassword() {
    const input = document.getElementById('login-password');
    const btn = document.getElementById('eye-btn');
    if (!input || !btn) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = icon(show ? 'eyeOff' : 'eye', 18);
    btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  }

  function loginError(html) {
    const box = document.getElementById('login-error');
    if (!box) return;
    box.innerHTML = html;
    box.style.display = 'flex';
  }

  function clearLoginErrors() {
    ['err-user', 'err-pass'].forEach((id) => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    ['field-user', 'field-pass'].forEach((id) => { const el = document.getElementById(id); if (el) el.classList.remove('has-error'); });
    const box = document.getElementById('login-error');
    if (box) box.style.display = 'none';
  }

  async function submitLogin(e) {
    if (e) e.preventDefault();
    clearLoginErrors();
    const f = new FormData(e.target);
    const username = f.get('username');
    const password = f.get('password');
    const code = (f.get('code') || '').trim();
    const btn = e.target.querySelector('.btn');
    btn.disabled = true; btn.textContent = 'Connexion…';
    try {
      await TAKATA.login(username, password, code);
      toast('Bienvenue');
      location.hash = '#/';
      if (typeof renderRoute === 'function') renderRoute();
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Se connecter';
      const cross = icon('x', 14);
      if (err.status === 401 && err.data && err.data.twofa) {
        const box = document.getElementById('field-code');
        if (box) box.style.display = '';
        const inp = document.getElementById('login-code');
        if (inp) inp.focus();
        const ec = document.getElementById('err-code');
        if (ec) ec.innerHTML = 'Saisissez le code à 6 chiffres de votre application d authentification.';
        toast('Double authentification requise');
        return;
      }
      if (err.status === 401) {
        document.getElementById('field-user').classList.add('has-error');
        document.getElementById('field-pass').classList.add('has-error');
        document.getElementById('err-user').innerHTML = cross + ' Identifiant ou mot de passe incorrect';
        loginError(cross + ' Identifiant ou mot de passe incorrect. Vérifiez puis réessayez.');
      } else if (err.status === 429) {
        loginError(cross + ' ' + (err.message || 'Trop de tentatives. Patientez un instant puis réessayez.'));
      } else if (err.status === 0) {
        loginError(cross + ' Serveur non joignable — démarrez le serveur Takata Kwetu (start-takata.bat) et réessayez.');
      } else {
        loginError(cross + ' ' + (err.message || 'Erreur de connexion'));
      }
    }
  }

  // ============ TABLEAU DE BORD ============
  async function dashboardView() {
    const d = await get('/dashboard');
    if (!d) return emptyState(icon('wifi-off'), 'Reconnexion requise pour charger le tableau de bord');
    const s = d.stats;
    const role = TAKATA.store.user && TAKATA.store.user.role;
    const isAdmin = ['admin', 'admingen', 'admincomm', 'admintech'].includes(role);
    const isTech = role === 'technicien';
    const grid = isTech ? `
      <div class="stats">
        <a class="stat" href="#/installations"><div class="num">${s.installations}</div><div class="lbl">Réabonnements en service</div></a>
        <a class="stat" href="#/installations"><div class="num">${s.planned}</div><div class="lbl">Tournées planifiées</div></a>
        <a class="stat" href="#/customers"><div class="num">${s.customers}</div><div class="lbl">Abonnés actifs</div></a>
        <a class="stat" href="#/stock"><div class="num">${s.stockAlerts}</div><div class="lbl">Matériel en stock faible</div></a>
      </div>` : `
      <div class="stats">
        <a class="stat" href="#/customers"><div class="num">${s.customers}</div><div class="lbl">Clients abonnés</div></a>
        <a class="stat" href="#/prospects"><div class="num">${s.prospects}</div><div class="lbl">Prospects</div></a>
        <a class="stat" href="#/installations"><div class="num">${s.installations}</div><div class="lbl">Réabonnements</div></a>
        <a class="stat" href="#/payments"><div class="num">${money(s.paidMonth)}</div><div class="lbl">Encaissé (mois)</div></a>
        <a class="stat" href="#/installments?status=overdue"><div class="num" style="color:${s.overdue ? 'var(--red)' : 'var(--green-dark)'}">${s.overdue}</div><div class="lbl">Réabonnements en retard</div></a>
        <a class="stat" href="#/installments?status=overdue10"><div class="num" style="color:${s.overdue10 ? 'var(--red)' : 'var(--green-dark)'}">${s.overdue10}</div><div class="lbl">Réabonnements en retard ≥ 10 j</div></a>
        <a class="stat" href="#/stock"><div class="num">${s.stockAlerts}</div><div class="lbl">Matériel en stock faible</div></a>
        <a class="stat" href="#/commissions"><div class="num">${money(s.pendingCommissions)}</div><div class="lbl">Commissions à venir</div></a>
      </div>`;
    return `
      ${grid}

      ${isAdmin ? `<div class="card"><h3>${icon('shield')} Vue supervision</h3><p class="muted">Accédez aux équipes, rapports et stock depuis l'onglet Supervision.</p></div>` : ''}

      ${isTech ? '' : `<div class="section-title">Derniers encaissements</div>
      <div class="list">
        ${(d.recentPayments || []).map((p) => listItem(icon('wallet'), esc(p.customer), money(p.amount) + ' · ' + date(p.created_at), badge(p.method), '#/payments')).join('') || emptyState(icon('wallet'), 'Aucun encaissement enregistré')}
      </div>`}

      <div class="section-title">Matériel en stock faible</div>
      <div class="list">
        ${(d.lowStock || []).map((p) => listItem(icon('box'), esc(p.name), `${p.quantity} unité(s) restante(s)`, `<span class="badge ${p.quantity === 0 ? 'red' : 'amber'}">${p.quantity === 0 ? 'Rupture' : 'Bientôt épuisé'}</span>`, isAdmin ? '#/admin/stock' : '#/stock')).join('') || emptyState(icon('check'), 'Stocks suffisants')}
      </div>

      ${!isTech && +s.overdue ? `<div class="card" style="border-color:var(--red)"><h3>${icon('alert')} Relances à faire (${s.overdue})</h3><p class="muted">Des réabonnements sont en retard. Pensez à relancer vos clients.</p><br><a class="btn small" href="#/installments">Voir les échéances</a></div>` : ''}
    `;
  }


  async function cancelInstallation(id) {
    if (!confirm('Annuler ce réabonnement ? Les échéances en attente seront supprimées et le stock restitué.')) return;
    try { await TAKATA.request('POST', '/api/installations/' + id + '/cancel', {}); toast('Réabonnement annulé ✅ stock restitué'); renderRoute(); }
    catch (e) { toast(e.message || 'Erreur', true); }
  }
  // ============ CLIENTS ============
  async function customersView(params, q) {
    const search = (q && q.search) || '';
    const role = (TAKATA.store.user || {}).role; const canSeeOwner = ["admin","admincomm","admintech","admingen"].includes(role);
    const rows = await get('/customers?search=' + encodeURIComponent(search));
    if (!rows) return emptyState(icon('wifi-off'), 'Hors ligne — réessayez plus tard');
    const isTech = (TAKATA.store.user || {}).role === 'technicien';
    return `
      ${searchBar('Rechercher un client (nom, téléphone, quartier)', search, "location.hash='#/customers?search='+encodeURIComponent(this.value)")}
      <div class="list">
        ${rows.map((c) => listItem(initials(c.name), esc(c.name), `<b>${phone(c.phone)}</b> · ${esc(c.village)}` + (canSeeOwner && c.agent ? ' · <i>' + esc(c.agent) + '</i>' : ''), badge(c.status), `#/customers/${c.id}`)).join('') || emptyState(icon('users'), 'Aucun client trouvé')}
      </div>
      ${isTech ? '' : fab("location.hash='#/customers/new'", 'Nouveau client')}
    `;
  }

  async function customerDetailView(params) {
    const c = await get('/customers/' + params.id);
    if (!c) return emptyState(icon('user'), 'Client introuvable');
    const isTech = (TAKATA.store.user || {}).role === 'technicien';
    const totalPaid = (c.payments || []).reduce((a, p) => a + p.amount, 0);
    const nextDue = (c.installments || []).find((i) => i.status === 'pending');
    return `
      <div class="card secu-card">
        <div class="row"><div style="flex:1"><div style="font-weight:600">Sécurité · Double authentification</div>
        <div class="muted">Protège votre compte avec un code temporaire (application d authentification).</div></div></div>
        <div id="2fa-box"><p class="muted">Statut : </p></div>
        <div class="row" style="gap:8px;margin-top:8px">
          <button class="btn" onclick="TAKATA_VIEWS.start2fa()">Activer / changer la clé</button>
          <button class="btn secondary" onclick="TAKATA_VIEWS.disable2fa()">Désactiver</button>
        </div>
      </div>
      <div class="card">
        <div class="row"><div class="avatar" style="width:52px;height:52px;font-size:20px">${initials(c.name)}</div>
        <div style="flex:1"><div style="font-weight:600;font-size:16px">${esc(c.name)}</div><div class="muted">${phone(c.phone)}</div></div>
        ${badge(c.status)}</div>
        <hr class="divider">
        <div class="kv"><span>Quartier</span><b>${esc(c.village || '—')}</b></div>
        <div class="kv"><span>Adresse</span><b>${esc(c.address || '—')}</b></div>
        <div class="kv"><span>Agent</span><b>${esc(c.agent || '—')}</b></div>
        <div class="kv"><span>Total payé</span><b style="color:var(--green-dark)">${money(totalPaid)}</b></div>
        ${nextDue ? `<div class="kv"><span>Prochain réabonnement</span><b class="${nextDue.due_date < new Date().toISOString().slice(0,10) ? 'badge red' : ''}">${money(nextDue.amount)} · ${date(nextDue.due_date)}</b></div>` : ''}
        ${isTech ? '' : `<br><div class="row"><a class="btn small" href="#/customers/${c.id}/edit">${icon('edit', 14)} Modifier</a>
        <a class="btn small secondary" href="#/payments/new?customer=${c.id}">${icon('wallet')} Encaisser</a>
        <a class="btn small" href="#/installations/new?customer=${c.id}">Réabonnement (renouveler)</a></div>`}
      </div>

      <div class="section-title">Réabonnements (${c.installations.length})</div>
      <div class="list">
        ${c.installations.map((i) => listItem(icon('recycle'), esc(i.product), `Depuis le ${date(i.install_date)} · ${money(i.price)}`, badge(i.status), `#/installations/${i.id}`)).join('') || emptyState(icon('recycle'), 'Aucun abonnement')}
        ${isTech ? '' : `<a class="btn small secondary" style="margin:4px auto;display:flex;width:auto" href="#/installations/new?customer=${c.id}">+ Souscrire un réabonnement</a>`}
      </div>

      <div class="section-title">Échéancier</div>
      <div class="list">
        ${c.installments.map((i) => listItem(icon('calendar'), money(i.amount), `Due le ${date(i.due_date)}`, badge(i.status), '#/installments')).join('') || emptyState(icon('calendar'), 'Aucune échéance')}
      </div>

      <div class="section-title">Paiements (${c.payments.length})</div>
      <div class="list">
        ${c.payments.map((p) => listItem(icon('wallet'), money(p.amount), date(p.created_at) + ' · ' + p.method, '', '#/payments')).join('') || emptyState(icon('wallet'), 'Aucun paiement')}
      </div>
    `;
  }

  async function customerFormView(params) {
    let c = { name: '', phone: '', village: '', address: '', notes: '' };
    let isEdit = false;
    if (params.id && params.id !== 'new') {
      c = await get('/customers/' + params.id);
      if (!c) return emptyState(icon('user'), 'Client introuvable');
      isEdit = true;
    }
    return `
      <div class="card">
        <div class="page-title" style="margin:0 0 12px">${isEdit ? 'Modifier le client' : 'Nouveau client'}</div>
        <div class="field"><label for="f-name">Nom complet *</label><input id="f-name" value="${esc(c.name)}" placeholder="Nom du client"></div>
        <div class="field"><label for="f-phone">Téléphone</label><input id="f-phone" type="tel" value="${esc(c.phone)}" placeholder="+243 ..."></div>
        <div class="field"><label for="f-village">Quartier</label><input id="f-village" value="${esc(c.village)}"></div>
        <div class="field"><label for="f-address">Adresse</label><input id="f-address" value="${esc(c.address)}"></div>
        <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" rows="2">${esc(c.notes)}</textarea></div>
        <button class="btn" onclick="TAKATA_VIEWS.saveCustomer('${params.id}',${isEdit})">Enregistrer</button>
      </div>`;
  }

  async function saveCustomer(id, isEdit) {
    const body = {
      name: document.getElementById('f-name').value,
      phone: document.getElementById('f-phone').value,
      village: document.getElementById('f-village').value,
      address: document.getElementById('f-address').value,
      notes: document.getElementById('f-notes').value
    };
    if (!body.name.trim()) return toast('Le nom est requis', true);
    try {
      if (isEdit) {
        await TAKATA.offlineAware('PUT', '/customers/' + id, body);
      } else {
        await TAKATA.offlineAware('POST', '/customers', body);
      }
      toast('Client enregistré');
      location.hash = '#/customers';
    } catch (e) { toast(e.message || 'Erreur', true); }
  }

  // ============ PROSPECTS ============
  async function prospectsView(params, q) {
    const search = (q && q.search) || '';
    const status = (q && q.status) || '';
    const rows = await get('/prospects?search=' + encodeURIComponent(search) + (status ? '&status=' + status : ''));
    if (!rows) return emptyState(icon('wifi-off'), 'Hors ligne — réessayez plus tard');
    const filters = ['', 'nouveau', 'contacté', 'converti', 'perdu'];
    const canSeeOwner = ['admin', 'admincomm', 'admintech', 'admingen'].includes((TAKATA.store.user || {}).role);
    return `
      ${searchBar('Rechercher un prospect', search, "location.hash='#/prospects?search='+encodeURIComponent(this.value)")}
      <div style="display:flex;gap:6px;overflow-x:auto;padding:8px 14px">
        ${filters.map((f) => `<a class="badge ${(status || '') === f ? 'green' : 'gray'}" style="flex:none" href="#/prospects${f ? '?status=' + f : ''}">${f ? esc(f) : 'Tous'}</a>`).join('')}
      </div>
      <div class="list">
        ${rows.map((p) => `<div class="list-item" style="cursor:default"><div class="avatar">${initials(p.name)}</div><div class="body"><div class="title">${esc(p.name)}</div><div class="desc">${phone(p.phone)} · ${esc(p.village)} · ${esc(p.interest)}${canSeeOwner && p.agent ? ' · <i>' + esc(p.agent) + '</i>' : ''}</div></div>${badge(p.status)}${p.status !== 'converti' ? `<button class="btn small secondary" style="margin-left:6px" onclick="TAKATA_VIEWS.convertProspect(${p.id},this)">Convertir</button>` : ''}</div>`).join('') || emptyState(icon('target'), 'Aucun prospect trouvé')}
      </div>
      ${fab("location.hash='#/prospects/new'", 'Nouveau prospect')}
    `;
  }

  async function convertProspect(id, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    if (!confirm('Convertir ce prospect en client ?')) {
      if (btn) { btn.disabled = false; btn.textContent = 'Convertir'; }
      return;
    }
    try {
      const r = await TAKATA.request('POST', `/prospects/${id}/convert`);
      let msg = 'Prospect converti en client ✅';
      try { const d = await get('/dashboard'); if (d && d.stats) msg += ' — encaissé cumulé du mois : ' + money(d.stats.paidMonth); } catch (e) {}
      toast(msg);
      location.hash = '#/customers/' + r.customerId;
    } catch (e) {
      toast(e.message || 'Erreur', true);
      if (btn) { btn.disabled = false; btn.textContent = 'Convertir'; }
    }
  }

  async function prospectFormView(params) {
    let p = { name: '', phone: '', village: '', interest: '', follow_up_date: '', notes: '', status: 'nouveau' };
    let isEdit = false;
    if (params.id && params.id !== 'new') {
      const all = await get('/prospects');
      p = (all || []).find((x) => x.id === Number(params.id)) || p;
      isEdit = true;
    }
    return `
      <div class="card">
        <div class="page-title" style="margin:0 0 12px">${isEdit ? 'Modifier le prospect' : 'Nouveau prospect'}</div>
        <div class="field"><label for="f-name">Nom complet *</label><input id="f-name" value="${esc(p.name)}"></div>
        <div class="field"><label for="f-phone">Téléphone</label><input id="f-phone" type="tel" value="${esc(p.phone)}"></div>
        <div class="field"><label for="f-village">Quartier</label><input id="f-village" value="${esc(p.village)}"></div>
        <div class="field"><label for="f-interest">Formule souhaitée</label><input id="f-interest" value="${esc(p.interest)}" placeholder="ex. Abonnement Standard"></div>
        <div class="field"><label for="f-follow">Date de relance</label><input id="f-follow" type="date" value="${esc(p.follow_up_date)}"></div>
        <div class="field"><label for="f-status">Statut</label><select id="f-status">
          ${['nouveau', 'contacté', 'perdu'].map((s) => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select></div>
        <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" rows="2">${esc(p.notes)}</textarea></div>
        <button class="btn" onclick="TAKATA_VIEWS.saveProspect('${params.id}',${isEdit})">Enregistrer</button>
      </div>`;
  }

  async function saveProspect(id, isEdit) {
    const body = {
      name: document.getElementById('f-name').value,
      phone: document.getElementById('f-phone').value,
      village: document.getElementById('f-village').value,
      interest: document.getElementById('f-interest').value,
      follow_up_date: document.getElementById('f-follow').value,
      status: document.getElementById('f-status').value,
      notes: document.getElementById('f-notes').value
    };
    if (!body.name.trim()) return toast('Le nom est requis', true);
    try {
      if (isEdit) await TAKATA.offlineAware('PUT', '/prospects/' + id, body);
      else await TAKATA.offlineAware('POST', '/prospects', body);
      toast('Prospect enregistré');
      location.hash = '#/prospects';
    } catch (e) { toast(e.message || 'Erreur', true); }
  }

  // ============ ABONNEMENTS (contrats de collecte) ============
  async function installationsView() {
    const rows = await get('/installations');
    if (!rows) return emptyState(icon('wifi-off'), 'Hors ligne');
    const isTech = (TAKATA.store.user || {}).role === 'technicien';
    return `
      <div class="list">
        ${rows.map((i) => listItem(icon('recycle'), esc(i.customer), esc(i.product) + ' · ' + date(i.install_date), badge(i.status) + (i.payg ? ' <span class="badge amber">Mensuel</span>' : ''), `#/installations/${i.id}`)).join('') || emptyState(icon('recycle'), 'Aucun réabonnement enregistré')}
      </div>
      ${isTech ? '' : fab("location.hash='#/installations/new'", 'Nouveau réabonnement')}
    `;
  }

  async function installationFormView(params) {
    const products = await get('/products');
    const preCustomer = (params.customer) || '';
    return `
      <div class="card">
        <div class="page-title" style="margin:0 0 12px">Souscrire un réabonnement</div>
        <div class="field"><label for="f-customer">Client *</label><input id="f-customer" list="customer-list" value="${esc(preCustomer)}" placeholder="ID client (ex. 3)"><datalist id="customer-list">${(await customersOptions()).join('')}</datalist><div class="hint">Sélectionnez ou saisissez l'ID du client.</div></div>
        <div class="field"><label for="f-product">Formule *</label><select id="f-product">${(products || []).filter((p) => p.category === 'Formule collecte').map((p) => `<option value="${p.id}">${esc(p.name)} — ${money(p.price)}${p.payg ? ' (mensuel)' : ''}</option>`).join('')}</select></div>
        <div class="field"><label for="f-serial">Référence contrat</label><input id="f-serial" placeholder="ex. TAK-ABS-0080"></div>
        <div class="field"><label for="f-date">Date de début</label><input id="f-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" rows="2"></textarea></div>
        <div class="hint">Prestation de service : l'enregistrement est possible même si le stock est à zéro.</div>
        <button class="btn" onclick="TAKATA_VIEWS.saveInstallation()">Souscrire</button>
      </div>`;
  }

  async function customersOptions() {
    const rows = await get('/customers');
    return (rows || []).map((c) => `<option value="${c.id}">${esc(c.name)} (${phone(c.phone)})</option>`);
  }

  async function saveInstallation() {
    const customerId = document.getElementById('f-customer').value.trim();
    const productId = document.getElementById('f-product').value;
    const serial = document.getElementById('f-serial').value;
    const install_date = document.getElementById('f-date').value;
    const notes = document.getElementById('f-notes').value;
    if (!customerId || !productId) return toast('Client et produit requis', true);
    // Accepte l'ID direct ; sinon cherche le client par nom
    let cid = Number(customerId);
    if (isNaN(cid)) {
      const rows = await get('/customers?search=' + encodeURIComponent(customerId));
      if (rows && rows[0]) cid = rows[0].id;
      else return toast('Client introuvable — vérifiez le nom', true);
    }
    try {
      const r = await TAKATA.offlineAware('POST', '/installations', { customer_id: cid, product_id: Number(productId), serial, install_date, notes });
toast('Réabonnement souscrit');
      location.hash = r && r.queued ? '#/installations' : '#/installations';
    } catch (e) { toast(e.message || 'Erreur', true); }
  }

  // Détail d'une installation
  async function installationDetailView(params) {
    const i = await get('/installations/' + params.id);
    if (!i) return emptyState(icon('recycle'), 'Réabonnement introuvable');
    const totalInstall = (i.installments || []).reduce((a, x) => a + x.amount, 0);
    const paid = (i.installments || []).filter((x) => x.status === 'paid');
    const paidAmt = paid.reduce((a, x) => a + x.amount, 0);
    const pct = totalInstall ? Math.round((paidAmt / totalInstall) * 100) : (i.price ? 100 : 0);
    return `
      <div class="card">
        <div class="row"><div style="flex:1"><div style="font-weight:600;font-size:16px">${esc(i.product)}</div>
        <div class="muted">Client : <a href="#/customers/${i.customer_id}">${esc(i.customer)}</a></div></div>${badge(i.status)}</div>
        <hr class="divider">
        <div class="kv"><span>Début du contrat</span><b>${date(i.install_date)}</b></div>
        <div class="kv"><span>Référence</span><b>${esc(i.serial || '—')}</b></div>
        <div class="kv"><span>Réabonnement (mensuel)</span><b>${money(i.price)}</b></div>
        <div class="kv"><span>Avancement paiements</span><b>${pct}% (${money(paidAmt)} / ${money(totalInstall || i.price)})</b></div>
        ${totalInstall ? `<progress max="100" value="${pct}"></progress>` : ''}
        ${['admin','admingen','admincomm','admintech'].includes((TAKATA.store.user || {}).role) && !i.cancelled ? `<hr class="divider"><button class="btn secondary" onclick="TAKATA_VIEWS.cancelInstallation(${i.id})">Annuler ce réabonnement (restitue le stock)</button>` : ''}
        ${i.cancelled ? '<div class="muted" style="margin-top:8px">Réabonnement annulé le ' + esc(i.cancelled_at || '') + '</div>' : ''}
      </div>
      <div class="section-title">Échéancier (${(i.installments || []).length})</div>
      <div class="list">
        ${(i.installments || []).map((x) => `<div class="card" style="margin:6px 14px"><div class="row"><div style="flex:1"><b>${money(x.amount)}</b><div class="muted">Due le ${date(x.due_date)}</div></div>${badge(x.paid_date ? 'paid' : (x.due_date < new Date().toISOString().slice(0,10) ? 'overdue' : 'pending'))}</div></div>`).join('') || emptyState(icon('calendar'), 'Séance à la carte (paiement unique)')}
      </div>
      ${(TAKATA.store.user || {}).role === 'technicien' ? '' : `<div style="padding:0 14px"><a class="btn" href="#/payments/new?customer=${i.customer_id}">${icon('wallet')} Encaisser un réabonnement</a></div>`}
    `;
  }

  // ============ PAIEMENTS ============
  async function paymentsView(params, q) {
    const customer = (q && q.customer) || '';
    const rows = await get('/payments' + (customer ? '?customer_id=' + customer : ''));
    if (!rows) return emptyState(icon('wifi-off'), 'Hors ligne');
    let customerName = '';
    if (customer) {
      const c = await get('/customers/' + customer);
      customerName = c ? c.name : '';
    }
    return `
      ${customer ? `<div class="page-sub">Paiements de : <b>${esc(customerName)}</b> — <a href="#/payments">tout voir</a></div>` : ''}
      <div class="list">
        ${rows.map((p) => listItem(icon('wallet'), money(p.amount), `<b>${esc(p.customer)}</b> · ${date(p.created_at)}`, badge(p.method), '#/payments')).join('') || emptyState(icon('wallet'), 'Aucun paiement enregistré')}
      </div>
      ${fab("location.hash='#/payments/new'", 'Encaisser un paiement')}
    `;
  }

  async function paymentFormView(params) {
    const preCustomer = params.customer || '';
    const installments = await get('/installments?status=pending');
    const open = (installments || []).filter((i) => i.status === 'pending');
    return `
      <div class="card">
        <div class="page-title" style="margin:0 0 12px">Encaisser un paiement</div>
        <div class="field"><label for="f-customer">Client *</label><input id="f-customer" list="customer-list" value="${esc(preCustomer)}"><datalist id="customer-list">${(await customersOptions()).join('')}</datalist><div class="hint">ID client ou nom.</div></div>
        <div class="field"><label for="f-installment">Échéance concernée (optionnel)</label><select id="f-installment" onchange="TAKATA_VIEWS.pickInstallment(this)"><option value="">— Aucune (paiement libre) —</option>${open.map((i) => `<option value="${i.id}" data-customer="${i.customer_id}" data-amount="${i.amount}">${esc(i.customer)} — ${money(i.amount)} (due ${date(i.due_date)})</option>`).join('')}</select></div>
        <div class="field"><label for="f-amount">Montant (FC) *</label><input id="f-amount" type="number" inputmode="decimal" step="0.01" placeholder="20000"></div>
        <div class="field"><label for="f-method">Méthode</label><select id="f-method"><option value="cash">Espèces</option><option value="mobile_money">Mobile Money</option><option value="bank">Banque</option><option value="card">Carte</option></select></div>
        <div class="field"><label for="f-ref">Référence</label><input id="f-ref" placeholder="ex. REC-2024-01"></div>
        <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" rows="2"></textarea></div>
        <button class="btn" onclick="TAKATA_VIEWS.savePayment()">${icon('wallet')} Encaisser</button>
      </div>`;
  }

  // Pré-remplit le montant (et le client si vide) quand une échéance est choisie
  function pickInstallment(sel) {
    if (!sel || !sel.selectedOptions || !sel.selectedOptions[0]) return;
    const opt = sel.selectedOptions[0];
    const amount = opt.dataset.amount;
    if (amount) document.getElementById('f-amount').value = amount;
    const cid = opt.dataset.customer;
    const cInput = document.getElementById('f-customer');
    if (cid && !cInput.value.trim()) cInput.value = cid;
  }

  async function savePayment() {
    let cid = Number(document.getElementById('f-customer').value.trim());
    if (isNaN(cid)) {
      const name = document.getElementById('f-customer').value.trim();
      const rows = await get('/customers?search=' + encodeURIComponent(name));
      if (rows && rows[0]) cid = rows[0].id;
      else return toast('Client introuvable', true);
    }
    const sel = document.getElementById('f-installment');
    const instId = sel.value ? Number(sel.value) : null;
    const amount = Number(document.getElementById('f-amount').value);
    if (!cid || !amount || amount <= 0) return toast('Client et montant valide requis', true);
    const method = document.getElementById('f-method').value;
    const ref = document.getElementById('f-ref').value;
    const notes = document.getElementById('f-notes').value;
    try {
      await TAKATA.offlineAware('POST', '/payments', { customer_id: cid, amount, method, ref, notes, installment_id: instId });
      toast('Paiement enregistré');
      location.hash = '#/payments';
    } catch (e) { toast(e.message || 'Erreur', true); }
  }

  // ============ ÉCHÉANCES & RELANCES ============
  async function installmentsView(params, q) {
    const status = (q && q.status) || '';
    const rows = await get('/installments' + (status ? '?status=' + status : ''));
    if (!rows) return emptyState(icon('wifi-off'), 'Hors ligne');
    const today = new Date().toISOString().slice(0, 10);
    const filters = [['', 'Toutes'], ['pending', 'Réabonnement en attente'], ['overdue', 'Réabonnement en retard'], ['overdue10', 'Réabonnement en retard ≥ 10 j'], ['paid', 'Payées']];
    return `
      <div style="display:flex;gap:6px;overflow-x:auto;padding:8px 14px">
        ${filters.map(([v, l]) => `<a class="badge ${(status || '') === v ? 'green' : 'gray'}" style="flex:none" href="#/installments${v ? '?status=' + v : ''}">${l}</a>`).join('')}
      </div>
      <div class="list">
        ${rows.map((i) => {
          const isOverdue = i.status === 'pending' && i.due_date < today;
          const st = isOverdue ? 'overdue' : i.status;
          return listItem(icon('calendar'), `${esc(i.customer)}`, money(i.amount) + ' · due le ' + date(i.due_date) + (i.product ? ' · ' + esc(i.product) : ''), badge(st) +
            (i.status === 'pending' ? ` <button class="btn small secondary" style="margin-left:4px" onclick="event.preventDefault();TAKATA_VIEWS.remindInstallment(${i.id})">Relancer</button>` : ''), '#/customers/' + i.customer_id);
        }).join('') || emptyState(icon('calendar'), 'Aucune échéance')}
      </div>
    `;
  }

  async function remindInstallment(id) {
    try {
      await TAKATA.request('POST', `/installments/${id}/remind`);
      toast('Relance enregistrée');
    } catch (e) { toast(e.message || 'Erreur', true); }
  }

  // ============ COMMISSIONS ============
  async function commissionsView() {
    const d = await get('/commissions');
    if (!d) return emptyState(icon('wifi-off'), 'Hors ligne');
    return `
      <div class="stats">
        <div class="stat"><div class="num">${money(d.totals.pending)}</div><div class="lbl">En attente</div></div>
        <div class="stat"><div class="num">${money(d.totals.paid)}</div><div class="lbl">Payées</div></div>
        <div class="stat"><div class="num">${money(d.totals.total)}</div><div class="lbl">Total</div></div>
      </div>
      <div class="list">
        ${d.rows.map((c) => listItem(icon('award'), money(c.amount), date(c.created_at) + ' · ' + esc(c.agent), (c.status === 'paid' ? '<span class=\'badge green\'>Validée</span>' : '<span class=\'badge red\'>À valider</span>'), '#/commissions')).join('') || emptyState(icon('award'), 'Aucune commission')}
      </div>
    `;
  }

  // ============ STOCK (agent) ============
  async function stockView() {
    const rows = await get('/stock');
    if (!rows) return emptyState(icon('wifi-off'), 'Hors ligne');
    const isAdmin = TAKATA.store.user && TAKATA.store.user.role === 'admin';
    return `
      <div class="list">
        ${rows.map((s) => listItem(icon('box'), esc(s.name), money(s.price), `<span class="badge ${s.quantity <= 3 ? (s.quantity === 0 ? 'red' : 'amber') : 'green'}">${s.quantity} unité(s)</span>`, isAdmin ? '#/admin/stock' : '#/stock')).join('') || emptyState(icon('box'), 'Aucun stock')}
      </div>
      ${isAdmin ? `<div class="card"><p class="muted">Gérez le stock (entrées, sorties, répartition) depuis l'espace admin.</p></div>` : ''}
    `;
  }

  // ============ NOTIFICATIONS ============
  async function notificationsView() {
    const d = await get('/notifications');
    if (!d) return emptyState(icon('wifi-off'), 'Hors ligne');
    return `
      <div class="list">
        ${d.rows.map((n) => `<div class="card" style="margin:8px 14px;${!n.read ? 'border-color:var(--green);background:var(--green-light)' : ''}">
          <div style="font-weight:600">${esc(n.title)}</div>
          <div class="muted">${esc(n.body || '')}</div>
          <div class="muted" style="font-size:11px;margin-top:4px">${date(n.created_at)}</div></div>`).join('') || emptyState(icon('bell'), 'Aucune notification')}
      </div>
      ${d.rows.length ? `<div style="text-align:center;margin:6px"><button class="btn ghost" onclick="TAKATA_VIEWS.readAll()">Tout marquer comme lu</button></div>` : ''}
    `;
  }

  async function readAll() {
    await TAKATA.request('POST', '/notifications/read-all');
    renderRoute();
  }

  // --- Double authentification (Profil) ---
  async function start2fa() {
    try {
      const r = await TAKATA.twofaSetup();
      const box = document.getElementById('2fa-box');
      if (box) box.innerHTML = '<p class="muted">1. Ouvrez votre application d authentification (Google Authenticator, Authy…).' +
        '<br>2. Ajoutez un compte avec cette clé : <b style="user-select:all">' + esc(r.secret) + '</b>' +
        '<br>3. Saisissez ensuite le code à 6 chiffres généré :</p>' +
        '<div class="row"><input id="2fa-code" inputmode="numeric" maxlength="6" placeholder="000000" style="flex:1">' +
        '<button class="btn" onclick="TAKATA_VIEWS.enable2fa()">Activer</button></div>' +
        '<p class="muted" style="font-size:11px;margin-top:6px">Clé (au cas où) : ' + esc(r.secret) + '</p>';
      toast('Clé générée — ajoutez-la à votre application');
    } catch (e) { toast(e.message || 'Erreur'); }
  }
  async function enable2fa() {
    const inp = document.getElementById('2fa-code');
    try { await TAKATA.twofaEnable((inp && inp.value || '').trim()); toast('Double authentification activée'); renderRoute(); }
    catch (e) { toast(e.message || 'Code incorrect'); }
  }
  async function disable2fa() {
    const p = prompt('Confirmez votre mot de passe pour désactiver la double authentification :');
    if (!p) return;
    try { await TAKATA.twofaDisable(p); toast('Double authentification désactivée'); renderRoute(); }
    catch (e) { toast(e.message || 'Mot de passe incorrect'); }
  }

  // ============ PROFIL ============
  async function profileView() {
    const u = TAKATA.store.user;
    const pending = TAKATA.queueLength();
    return `
      <div class="card">
        <div class="row"><div class="avatar" style="width:52px;height:52px;font-size:20px">${initials(u.full_name)}</div>
        <div style="flex:1"><div style="font-weight:600;font-size:16px">${esc(u.full_name)}</div><div class="muted">@${esc(u.username)} · ${esc(u.role)}</div></div></div>
        <hr class="divider">
        <div class="kv"><span>Téléphone</span><b>${phone(u.phone)}</b></div>
        <div class="kv"><span>Région</span><b>${esc(u.region || '—')}</b></div>
        <div class="kv"><span>Statut réseau</span><b class="${TAKATA.store.online ? 'badge green' : 'badge red'}">${TAKATA.store.online ? 'En ligne' : 'Hors ligne'}</b></div>
        ${pending ? `<div class="kv"><span>Opérations en attente de sync</span><b class="badge amber">${pending}</b></div>
        <button class="btn small" onclick="TAKATA_VIEWS.syncNow()">${icon('refresh')} Synchroniser maintenant</button>` : ''}
      </div>
      <div class="card">
        <div class="page-title" style="margin:0 0 12px;font-size:15px">Changer le mot de passe</div>
        <div class="field"><label for="p-cur">Mot de passe actuel</label><input id="p-cur" type="password"></div>
        <div class="field"><label for="p-next">Nouveau mot de passe (6+ caractères)</label><input id="p-next" type="password"></div>
        <button class="btn secondary" onclick="TAKATA_VIEWS.changePassword()">Mettre à jour</button>
      </div>
      <div style="padding:0 14px"><button class="btn danger" onclick="TAKATA_VIEWS.doLogout()">Se déconnecter</button></div>
    `;
  }

  async function syncNow() {
    try {
      const r = await TAKATA.flushQueue();
      toast(r.flushed ? `Synchronisé : ${r.flushed} opération(s) ✅` : 'Rien à synchroniser');
      renderRoute();
    } catch (e) { toast('Échec de la synchronisation', true); }
  }

  async function changePassword() {
    const current = document.getElementById('p-cur').value;
    const next = document.getElementById('p-next').value;
    if (!current || next.length < 6) return toast('Vérifiez les champs (6+ caractères)', true);
    try {
      await TAKATA.request('POST', '/auth/change-password', { current, next });
      toast('Mot de passe mis à jour ✅ — reconnexion…');
      setTimeout(() => doLogout(), 900);
    } catch (e) { toast(e.message || 'Erreur', true); }
  }

  function doLogout() {
    TAKATA.logout().finally(() => { location.hash = '#/login'; });
  }

  // ============ REGISTRE ============
    // ============ MATÉRIEL TECHNICIEN : disponibilité + signaler un besoin ============
  async function techMatosView() {
    const stock = await get('/stock');
    if (stock === null) return emptyState('wifiOff', 'Hors ligne — réessayez plus tard');
    const demandes = (await get('/tech/demandes')) || [];
    const ouvertes = demandes.filter((d) => d.statut === 'ouverte');
    return `
      <div class="page-title">Matériel — disponibilité</div>
      <div class="list">
        ${stock.map((p) => `<div class="list-item" style="cursor:default">
          <div class="avatar">${icon('box', 18)}</div>
          <div class="body"><div class="title">${esc(p.name)}</div>
          <div class="desc">${p.disponible ? 'Disponible sur le dépôt (demandez la dotation au superviseur technique)' : 'Indisponible pour le moment'}</div></div>
          ${p.disponible ? '<span class="badge green">Disponible</span>' : '<span class="badge red">Indisponible</span>'}</div>`).join('') || emptyState('box', 'Aucun intrant référencé')}
      </div>
      <div class="section-title">Signaler un besoin de matériel</div>
      <form class="card" onsubmit="return TAKATA_VIEWS.submitTechBesoin(event)">
        <div class="field"><label for="b-product">Intrant demandé</label><select id="b-product">${stock.map((p) => `<option value="${p.product_id}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="b-qte">Quantité souhaitée</label><input id="b-qte" type="number" min="1" value="1"></div>
        <div class="field"><label for="b-motif">Motif</label><textarea id="b-motif" rows="2" placeholder="Ex. : sacs pour la tournée de la semaine…"></textarea></div>
        <button class="btn" type="submit">${icon('check', 16)} Envoyer la demande au superviseur</button>
      </form>
      ${ouvertes.length ? `<div class="section-title">Mes demandes en attente (${ouvertes.length})</div><div class="list">
        ${ouvertes.map((d) => `<div class="list-item" style="cursor:default"><div class="body"><div class="title">${esc(d.produit)} × ${d.quantite}</div><div class="desc">${esc(d.motif || 'Sans motif')}</div></div><span class="badge amber">En attente</span></div>`).join('')}</div>` : ''}
    `;
  }

  async function submitTechBesoin(e) {
    e.preventDefault();
    const body = {
      product_id: Number(document.getElementById('b-product').value),
      quantite: Number(document.getElementById('b-qte').value) || 0,
      motif: document.getElementById('b-motif').value
    };
    if (body.quantite <= 0) return toast('Indiquez la quantité souhaitée', true);
    try {
      await TAKATA.offlineAware('POST', '/tech/demandes', body);
      toast('Demande envoyée au superviseur technique ✅');
      renderRoute();
    } catch (err) { toast(err.message || 'Erreur', true); }
    return false;
  }

  // ============ TOURNÉES : le technicien valide les siennes ============
  async function techTourneesView() {
    const rows = await get('/tech/tournees');
    if (rows === null) return emptyState('wifiOff', 'Hors ligne — réessayez plus tard');
    const enCours = rows.filter((r) => r.statut !== 'validee');
    const faites = rows.filter((r) => r.statut === 'validee');
    return `
      <div class="page-title">Mes tournées</div>
      <div class="section-title">À faire (${enCours.length})</div>
      <div class="list">
        ${enCours.map((r) => `<div class="card" style="margin:8px 14px">
          <div class="row"><div class="avatar">${icon('truck', 18)}</div>
          <div style="flex:1"><div style="font-weight:600">${esc(r.zone || 'Tournée')}</div>
          <div class="muted">${date(r.date)} · ${r.menages_prevus} ménage(s) prévu(s) · assignée par ${esc(r.assigne_par)}</div></div>
          <span class="badge amber">Assignée</span></div>
          <hr class="divider">
          <div class="field"><label for="v-men-${r.id}">Ménages servis réellement</label><input id="v-men-${r.id}" type="number" min="0" value="${r.menages_prevus}"></div>
          <div class="field"><label for="v-obs-${r.id}">Observations</label><textarea id="v-obs-${r.id}" rows="2" placeholder="Ex. : tout est fait, 2 ménages absents…"></textarea></div>
          <button class="btn small" onclick="TAKATA_VIEWS.valideTournee(${r.id})">${icon('check', 15)} Valider la tournée faite</button>
        </div>`).join('') || emptyState('truck', 'Aucune tournée assignée — votre superviseur vous en assignera')}
      </div>
      <div class="section-title">Validées (${faites.length})</div>
      <div class="list">
        ${faites.map((r) => `<div class="list-item" style="cursor:default"><div class="avatar">${icon('check', 18)}</div>
          <div class="body"><div class="title">${esc(r.zone || 'Tournée')} — ${date(r.date)}</div>
          <div class="desc">${r.menages_servis} ménage(s) servi(s)${r.observations ? ' · ' + esc(r.observations).slice(0, 80) : ''}</div></div>
          <span class="badge green">Validée</span></div>`).join('') || emptyState('check', 'Aucune tournée validée')}
      </div>`;
  }

  async function valideTournee(id) {
    const body = {
      menages_servis: Number(document.getElementById('v-men-' + id).value) || 0,
      observations: document.getElementById('v-obs-' + id).value
    };
    try {
      await TAKATA.offlineAware('POST', `/tech/tournees/${id}/valider`, body);
      toast('Tournée validée ✅ le superviseur technique est notifié');
      renderRoute();
    } catch (err) { toast(err.message || 'Erreur', true); }
  }

  // ============ SUPERVISION : assigner les tournées, traiter les demandes (admintech / direction) ============
  async function techSupervisionView() {
    const me = TAKATA.store.user || {};
    const isAdminDir = ['admin', 'admingen'].includes(me.role);
    const [techs, tournees, demandes, stock] = await Promise.all([
      get('/admin/agents'), get('/tech/tournees'), get('/tech/demandes'), get('/admin/stock')
    ]);
    if (techs === null) return emptyState('wifiOff', 'Hors ligne — réessayez plus tard');
    const techniciens = (techs || []).filter((a) => a.role === 'technicien' && a.active);
    const ouverteDemandes = (demandes || []).filter((d) => d.statut === 'ouverte');
    return `
      <div class="page-title">Technique — tournées &amp; matériel</div>
      <div class="card">
        <h3>${icon('truck', 16)} Assigner une tournée à un technicien</h3>
        <div class="field"><label for="as-tech">Technicien</label><select id="as-tech">${techniciens.map((x) => `<option value="${x.id}">${esc(x.full_name)}</option>`).join('')}</select></div>
        <div class="row">
          <div class="field"><label for="as-date">Date</label><input id="as-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label for="as-men">Ménages prévus</label><input id="as-men" type="number" min="0" value="0"></div>
        </div>
        <div class="field"><label for="as-zone">Zone / quartier de la tournée</label><input id="as-zone" placeholder="ex. Quartier Industriel, Av. …"></div>
        <button class="btn small" onclick="TAKATA_VIEWS.assignTournee()">${icon('check', 15)} Assigner la tournée</button>
      </div>
      <div class="section-title">Tournées assignées</div>
      <div class="list">
        ${(tournees || []).map((r) => `<div class="list-item" style="cursor:default"><div class="avatar">${icon('truck', 18)}</div>
          <div class="body"><div class="title">${esc(r.zone || 'Tournée')} — ${date(r.date)}</div>
          <div class="desc">${esc(r.technicien)} · ${r.menages_prevus} prévu(s) · assignée par ${esc(r.assigne_par)}</div></div>
          ${r.statut === 'validee' ? '<span class="badge green">Validée</span>' : '<span class="badge amber">En attente</span>'}</div>`).join('') || emptyState('truck', 'Aucune tournée assignée')}
      </div>
      <div class="section-title">Demandes de matériel (${ouverteDemandes.length} en attente)</div>
      <div class="list">
        ${(demandes || []).map((d) => `<div class="list-item" style="cursor:default"><div class="body"><div class="title">${esc(d.technicien)} — ${esc(d.produit)} × ${d.quantite}</div>
          <div class="desc">${esc(d.motif || 'Sans motif')}</div></div>
          ${d.statut === 'ouverte' ? `<button class="btn small secondary" onclick="TAKATA_VIEWS.traiterDemande(${d.id})">${icon('check', 14)} Traiter</button>` : '<span class="badge green">Traitée</span>'}</div>`).join('') || emptyState('box', 'Aucune demande')}
      </div>
      <div class="section-title">État du stock et matériel alloué</div>
      <div class="list">
        ${(stock || []).map((s) => `<div class="list-item" style="cursor:default">
          <div class="body"><div class="title">${esc(s.name)} — ${esc(s.agent || 'Dépôt central')}</div>
          <div class="desc">Quantité : ${s.quantity}${isAdminDir ? ' · Coût unitaire : ' + money(s.cost) : ''}</div></div>
          ${s.quantity > 0 ? '<span class="badge green">Disponible</span>' : '<span class="badge red">Rupture</span>'}</div>`).join('') || emptyState('box', 'Aucun stock')}
      </div>
      ${isAdminDir ? '<div class="card"><h3>' + icon('sliders', 16) + ' Saisie du stock</h3><p class="muted">La saisie et la modification du stock se font dans Supervision → Stock (réservées à la direction).</p></div>' : ''}
    `;
  }

  async function assignTournee() {
    const body = {
      technicien_id: Number(document.getElementById('as-tech').value),
      date: document.getElementById('as-date').value,
      zone: document.getElementById('as-zone').value,
      menages_prevus: Number(document.getElementById('as-men').value) || 0
    };
    try {
      await TAKATA.request('POST', '/tech/tournees', body);
      toast('Tournée assignée ✅ le technicien la voit dans son compte');
      renderRoute();
    } catch (err) { toast(err.message || 'Erreur', true); }
  }

  async function traiterDemande(id) {
    try {
      await TAKATA.request('POST', `/tech/demandes/${id}/traiter`);
      toast('Demande marquée traitée ✅');
      renderRoute();
    } catch (err) { toast(err.message || 'Erreur', true); }
  }

  // ============ RAPPORTS TECHNIQUES (métier : évacuations, désinfections) ============
  async function techDayView() {
    const me = TAKATA.store.user || {};
    const today = new Date().toISOString().slice(0, 10);
    const allProds = (await get('/products')) || [];
    const stockNow = (await get('/stock')) || [];
    const intrants = allProds.filter((p) => p.category === 'Intrant');
    const prods = intrants.length ? intrants : stockNow.map((s) => ({ id: s.product_id, name: s.name }));
    return `
      <div class="page-title">Rapport du jour — ${esc(me.full_name || '')}</div>
      <form class="card" onsubmit="return TAKATA_VIEWS.submitTechReport(event)">
        <div class="field"><label for="t-date">Date du rapport</label><input id="t-date" type="date" value="${today}"></div>
        <div class="row">
          <div class="field"><label for="t-menages">Ménages servis</label><input id="t-menages" type="number" min="0" value="0"></div>
          <div class="field"><label for="t-poubelles">Poubelles évacuées</label><input id="t-poubelles" type="number" min="0" value="0"></div>
        </div>
        <div class="row">
          <div class="field"><label for="t-courses">Courses de camion vers la décharge</label><input id="t-courses" type="number" min="0" value="0"></div>
          <div class="field"><label for="t-desinf">Désinfections faites</label><input id="t-desinf" type="number" min="0" value="0"></div>
        </div>
        <div class="field"><label for="t-maisons">Maisons désinfectées</label><input id="t-maisons" type="number" min="0" value="0"></div>
        <div class="section-title">Produits utilisés et état de besoin</div>
        ${prods.map((p) => `<div class="mat-row">
          <div class="row" style="justify-content:space-between;align-items:center"><b>${esc(p.name)}</b><button type="button" class="btn small secondary" onclick="var f=this.closest('.mat-row').querySelector('.mat-fields');f.hidden=!f.hidden;this.textContent=f.hidden?'Choisir':'Masquer';">Choisir</button></div>
          <div class="mat-fields" hidden style="margin-top:8px"><div class="row">
            <div class="field"><label for="t-q-${p.id}">Utilisé</label><input id="t-q-${p.id}" type="number" min="0" value="0" step="any"></div>
            <div class="field"><label for="t-b-${p.id}">Besoin (à commander)</label><input id="t-b-${p.id}" type="number" min="0" value="0" step="any"></div>
          </div></div></div>`).join('') || emptyState('box', 'Aucun produit intrant au catalogue')}
        <div class="field"><label for="t-comment">Observations de terrain</label><textarea id="t-comment" rows="4" placeholder="Ex. : incidents de la tournée, état du matériel, remarques…"></textarea></div>
        <button class="btn" type="submit">${icon('check', 16)} Enregistrer le rapport du jour</button>
      </form>`;
  }

  async function submitTechReport(e) {
    e.preventDefault();
    const items = [];
    document.querySelectorAll('[id^="t-q-"]').forEach((inp) => {
      const pid = Number(inp.id.replace('t-q-', ''));
      const qte = Number(inp.value) || 0;
      const besInput = document.getElementById('t-b-' + pid);
      const bes = Number(besInput && besInput.value) || 0;
      if (qte > 0 || bes > 0) items.push({ product_id: pid, quantite_utilisee: qte, etat_de_besoin: bes });
    });
    const body = {
      date: document.getElementById('t-date').value,
      menages_servis: Number(document.getElementById('t-menages').value) || 0,
      poubelles_evacuees: Number(document.getElementById('t-poubelles').value) || 0,
      courses_camion: Number(document.getElementById('t-courses').value) || 0,
      desinfections: Number(document.getElementById('t-desinf').value) || 0,
      maisons_desinfectees: Number(document.getElementById('t-maisons').value) || 0,
      commentaire: document.getElementById('t-comment').value,
      items
    };
    try {
      const r = await TAKATA.offlineAware('POST', '/tech/reports', body);
      toast(r && r.queued ? 'Rapport enregistré hors-ligne (sera synchronisé)' : 'Rapport du jour enregistré ✅');
      location.hash = '#/tech/historique';
    } catch (err) { toast(err.message || 'Erreur', true); }
    return false;
  }

  async function techHistoryView() {
    const reports = await get('/tech/reports');
    if (reports === null) return emptyState('wifiOff', 'Hors ligne — réessayez plus tard');
    return `
      <div class="page-title">Mes rapports techniques</div>
      <div class="list">
        ${reports.map((r) => `<a class="list-item" href="#/tech/rapport/${r.id}">
          <div class="avatar">${icon('truck', 18)}</div>
          <div class="body"><div class="title">${date(r.date)}</div>
          <div class="desc">${r.menages_servis} ménage(s) · ${r.poubelles_evacuees} poubelle(s) · ${r.courses_camion} course(s) camion${r.desinfections ? ' · ' + r.desinfections + ' désinfection(s)' : ''}</div></div>
          <div class="chevron">›</div></a>`).join('') || emptyState('truck', 'Aucun rapport enregistré — créez le rapport du jour')}
      </div>`;
  }

  async function techReportDetailView(params) {
    const reports = await get('/tech/reports');
    const r = (reports || []).find((x) => x.id === Number(params.id));
    if (!r) return emptyState('truck', 'Rapport introuvable');
    return `
      <div class="page-title">Rapport du ${date(r.date)}</div>
      <div class="card">
        <div class="kv"><span>Technicien</span><b>${esc(r.technicien)}</b></div>
        <div class="kv"><span>Ménages servis</span><b>${r.menages_servis}</b></div>
        <div class="kv"><span>Poubelles évacuées</span><b>${r.poubelles_evacuees}</b></div>
        <div class="kv"><span>Courses de camion vers la décharge</span><b>${r.courses_camion}</b></div>
        <div class="kv"><span>Désinfections faites</span><b>${r.desinfections}</b></div>
        <div class="kv"><span>Maisons désinfectées</span><b>${r.maisons_desinfectees}</b></div>
        ${r.commentaire ? `<hr class="divider"><div class="muted">Observations de terrain : ${esc(r.commentaire)}</div>` : ''}
      </div>
      ${(r.items || []).length ? `<div class="section-title">Produits utilisés</div><div class="list">
        ${r.items.map((it) => `<div class="list-item" style="cursor:default"><div class="body"><div class="title">${esc(it.produit)}</div>
        <div class="desc">Utilisé : ${it.quantite_utilisee} · État de besoin : ${it.etat_de_besoin}</div></div></div>`).join('')}</div>` : ''}`;
  }

  async function techCompilationView() {
    const s = await get('/tech/summary');
    if (s === null) return emptyState('wifiOff', 'Hors ligne — réessayez plus tard');
    return `
      <div class="page-title">Compilation technique</div>
      <div class="stats">
        <div class="stat"><div class="num">${s.totals.menages_servis}</div><div class="lbl">Ménages servis</div></div>
        <div class="stat"><div class="num">${s.totals.poubelles_evacuees}</div><div class="lbl">Poubelles évacuées</div></div>
        <div class="stat"><div class="num">${s.totals.courses_camion}</div><div class="lbl">Courses camion</div></div>
        <div class="stat"><div class="num">${s.totals.desinfections}</div><div class="lbl">Désinfections</div></div>
        <div class="stat"><div class="num">${s.totals.maisons_desinfectees}</div><div class="lbl">Maisons désinfectées</div></div>
      </div>
      <div class="section-title">Par technicien</div>
      <div class="list">
        ${(s.per_tech || []).map((x) => `<div class="list-item" style="cursor:default"><div class="avatar">${icon('truck', 18)}</div>
          <div class="body"><div class="title">${esc(x.technicien)}${x.region ? ' · ' + esc(x.region) : ''}</div>
          <div class="desc">${x.menages_servis} ménage(s) · ${x.poubelles_evacuees} poubelle(s) · ${x.courses_camion} course(s) camion · ${x.desinfections} désinfection(s) · ${x.maisons_desinfectees} maison(s) · ${x.nb_rapports} rapport(s)</div></div></div>`).join('') || emptyState('truck', 'Aucun rapport')}
      </div>
      <div class="section-title">Produits consommés, stocks et états de besoin</div>
      <div class="list">
        ${(s.consos || []).map((c) => `<div class="list-item" style="cursor:default">
          <div class="body"><div class="title">${esc(c.produit)}</div>
          <div class="desc">Utilisé : ${c.quantite_utilisee} · État de besoin : ${c.etat_de_besoin} · En stock : ${c.quantite_en_stock}</div></div>
          ${c.etat_de_besoin > c.quantite_en_stock ? '<span class="badge red">À commander</span>' : '<span class="badge green">OK</span>'}</div>`).join('') || emptyState('box', 'Aucune consommation enregistrée')}
      </div>`;
  }

  window.TAKATA_VIEWS = {
    loginView, submitLogin, togglePassword, techDayView, submitTechReport, techHistoryView, techReportDetailView, techCompilationView, techMatosView, submitTechBesoin, techTourneesView, valideTournee, techSupervisionView, assignTournee, traiterDemande, dashboardView, customersView, customerDetailView, customerFormView, saveCustomer,
    prospectsView, prospectFormView, saveProspect, convertProspect,
    installationsView, installationDetailView, installationFormView, saveInstallation,
    paymentsView, paymentFormView, savePayment, pickInstallment,
    installmentsView, remindInstallment,
    commissionsView, stockView, notificationsView, readAll,
    profileView, start2fa, enable2fa, disable2fa, syncNow, changePassword, doLogout,
    helpers: { esc, money, date, phone, initials, badge, toast, emptyState }
  };
  TAKATA_VIEWS.helpers.icon = icon;
  window.renderRoute = () => {}; // défini dans app.js
})();