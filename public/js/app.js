// app.js — Routeur Takata Kwetu, topbar, navigation basse, PWA, hors-ligne
/* global TAKATA, TAKATA_VIEWS, TAKATA_ADMIN */
(function () {
  const app = document.getElementById('app');
const V = TAKATA_VIEWS;
  const { icon } = V.helpers;
  const A = TAKATA_ADMIN;

  // --- Routes ---
  const ROUTES = [
    [/^\/login$/, (p, q) => V.loginView(), 'Connexion', false, null, null],
    [/^\/$/, (p, q) => V.dashboardView(), 'Accueil', true, 'accueil', 'dashboard'],
    [/^\/dashboard$/, (p, q) => V.dashboardView(), 'Accueil', true, 'accueil', 'dashboard'],
    [/^\/customers$/, (p, q) => V.customersView(p, q), 'Clients', true, 'clients', 'clients'],
    [/^\/customers\/new$/, (p, q) => V.customerFormView({ id: 'new' }), 'Nouveau client', true, 'clients', null],
    [/^\/customers\/(\d+)\/edit$/, (p, q) => V.customerFormView({ id: p[0] }), 'Modifier', true, 'clients', null],
    [/^\/customers\/(\d+)$/, (p, q) => V.customerDetailView({ id: p[0] }), 'Client', true, 'clients', null],
    [/^\/prospects$/, (p, q) => V.prospectsView(p, q), 'Prospects', true, 'prospects', 'prospects'],
    [/^\/prospects\/new$/, (p, q) => V.prospectFormView({ id: 'new' }), 'Nouveau prospect', true, 'prospects', null],
    [/^\/prospects\/(\d+)\/edit$/, (p, q) => V.prospectFormView({ id: p[0] }), 'Prospect', true, 'prospects', null],
    [/^\/installations$/, (p, q) => V.installationsView(), 'Réabonnements', true, 'tournees', 'installations'],
    [/^\/installations\/new$/, (p, q) => V.installationFormView(q), 'Nouveau réabonnement', true, null, null],
    [/^\/installations\/(\d+)$/, (p, q) => V.installationDetailView({ id: p[0] }), 'Réabonnement', true, null, null],
    [/^\/payments$/, (p, q) => V.paymentsView(p, q), 'Paiements', true, 'encaisser', 'payments'],
    [/^\/payments\/new$/, (p, q) => V.paymentFormView(q), 'Encaisser', true, 'encaisser', null],
    [/^\/installments$/, (p, q) => V.installmentsView(p, q), 'Échéances', true, 'echeances', 'installments'],
    [/^\/commissions$/, (p, q) => V.commissionsView(), 'Commissions', true, 'profil', 'commissions'],
    [/^\/stock$/, (p, q) => V.stockView(), 'Stock', true, 'profil', 'stock'],
    [/^\/tech$/, (p, q) => V.techDayView(), 'Rapport du jour', true, 'tech', null],
    [/^\/tech\/historique$/, (p, q) => V.techHistoryView(), 'Mes rapports techniques', true, 'tech', null],
    [/^\/tech\/rapport\/(\d+)$/, (p, q) => V.techReportDetailView({ id: p[0] }), 'Détail rapport technique', true, 'tech', null],
    [/^\/admin\/tech$/, (p, q) => V.techCompilationView(), 'Compilation technique', true, 'tech', 'tech'],
    [/^\/notifications$/, (p, q) => V.notificationsView(), 'Notifications', true, null, 'notifications'],
    [/^\/profile$/, (p, q) => V.profileView(), 'Profil', true, 'profil', 'profile'],
    // Admin
    [/^\/admin$/, (p, q) => A.adminHomeView(), 'Administration', true, 'admin', 'admin'],
    [/^\/admin\/agents$/, (p, q) => A.agentsView(q), 'Agents', true, 'admin', 'admin'],
[/^\/admin\/agents\/new$/, (p, q) => A.agentFormView(), 'Nouveau membre', true, 'admin', null],
    [/^\/admin\/agents\/(\d+)\/edit$/, (p) => A.agentEditView({ id: p[0] }), 'Modifier un membre', true, 'admin', null],
    [/^\/admin\/products$/, (p, q) => A.productsView(), 'Produits', true, 'admin', null],
    [/^\/admin\/products\/new$/, (p, q) => A.productFormView({ id: 'new' }), 'Nouveau produit', true, 'admin', null],
    [/^\/admin\/products\/(\d+)\/edit$/, (p, q) => A.productFormView({ id: p[0] }), 'Produit', true, 'admin', null],
    [/^\/admin\/stock$/, (p, q) => A.adminStockView(), 'Stock', true, 'admin', null],
    [/^\/admin\/commissions$/, (p, q) => A.adminCommissionsView(), 'Commissions', true, 'admin', null],
    [/^\/admin\/reports$/, (p, q) => A.reportsView(), 'Rapports', true, 'admin', null],
    [/^\/admin\/audit$/, (p, q) => A.auditView(q), 'Journal d audit', true, 'admin', null],
  ];

  function parseHash() {
    const raw = (location.hash || '#/').slice(1) || '/';
    const [path, qs] = raw.split('?');
    const q = {};
    if (qs) qs.split('&').forEach((kv) => { const [k, v] = kv.split('='); if (k) q[k] = decodeURIComponent(v || ''); });
    return { path: '/' + path.replace(/^\/+/, ''), q };
  }

  function findRoute(path) {
    for (const r of ROUTES) {
      const m = path.match(r[0]);
      if (m) return { route: r, matches: m };
    }
    return null;
  }

  const SUPER_LIKE = ['admin', 'admingen', 'admincomm', 'admintech'];
  const ROLE_LABELS = { admin: 'Direction', admingen: 'Direction', admincomm: 'Sup. commercial', admintech: 'Sup. technique', agent: 'Commercial', technicien: 'Technicien' };

  // Affiche un écran de chargement immédiat (évite l'écran blanc pendant les fetch)
  function loadingHTML(title, user) {
    const topbar = user ? topbarHTML(title, user) : '';
    return topbar + `<div class="page"><div class="empty">${icon('clock', 30)}<div>Chargement…</div></div></div>`;
  }

  async function renderRoute() {
    const { path, q } = parseHash();
    const found = findRoute(path);
    if (!found) { location.hash = '#/'; return; }
    const [regex, handler, title, needsAuth, navKey, permKey] = found.route;
    const matches = found.matches;

    const user = TAKATA.store.user;
    // Auth gating (la session locale restaurée permet l'accès hors-ligne)
    if (needsAuth && !user) { location.hash = '#/login'; return; }
    if (path === '/login' && user) { location.hash = '#/'; return; }
    // Espace admin réservé aux superviseurs / direction
    if (path.startsWith('/admin') && user && !SUPER_LIKE.includes(user.role)) {
      TAKATA_VIEWS.helpers.toast('Accès réservé à la direction et aux superviseurs', true);
      location.hash = '#/';
      return;
    }
  // La compilation technique est réservée au superviseur technique et à la direction
  if (path === '/admin/tech' && user && !['admintech', 'admin', 'admingen'].includes(user.role)) {
    TAKATA_VIEWS.helpers.toast('Compilation technique : réservée au superviseur technique et à la direction', true);
    location.hash = '#/';
    return;
  }
  // Le technicien n'accède pas aux modules commerciaux (vente/encaissement/prospects)
    if (user && user.role === 'technicien' && ['/prospects', '/payments', '/commissions'].some((p) => path.startsWith(p))) {
      TAKATA_VIEWS.helpers.toast('Module réservé aux équipes commerciales', true);
      location.hash = '#/';
      return;
    }

    // Rendu intermédiaire « chargement » (topbar + nav conservés)
    const topbarInit = needsAuth && user ? topbarHTML(title, user) : '';
    const navInit = needsAuth && user ? navHTML(user, navKey) : '';
    app.innerHTML = topbarInit + `<div class="page"><div class="empty">${icon('clock', 30)}<div>Chargement…</div></div></div>` + navInit;

    let html;
    try {
      html = await handler(matches.slice(1), q);
    } catch (e) {
      html = `<div class="empty"><div class="ic">⚠️</div><div>${esc(e.message || 'Erreur')}</div><br><button class="btn small" onclick="renderRoute()">🔄 Réessayer</button></div>`;
    }

    const topbar = needsAuth && user ? topbarHTML(title, user) : '';
    const nav = needsAuth && user ? navHTML(user, navKey) : '';
    app.innerHTML = topbar + `<div class="page">${html || ''}</div>` + nav;
    window.scrollTo(0, 0);
    updateNotifBadge();
    updateOfflineBanner();
  }

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function topbarHTML(title, user) {
    const roleLabel = ROLE_LABELS[user.role] || user.role;
    return `
      <div class="topbar">
        <button class="nav-arrow nav-back" aria-label="Retour" onclick="history.back()">‹</button>
        <div class="logo" aria-hidden="true">${icon('leaf', 22)}</div>
        <div><h1>Takata Kwetu</h1><div class="sub">${esc(title)} · ${esc(user.full_name.split(' ')[0])} <span style="opacity:.75">(${roleLabel})</span></div></div>
        <div class="row" style="gap:6px;flex:none">
          <button class="btn-icon" aria-label="Notifications" style="position:relative" onclick="location.hash='#/notifications'">${icon('bell')}<span id="notif-badge" style="display:none;position:absolute;top:-2px;right:-2px;background:var(--red);color:#fff;font-size:9px;border-radius:99px;padding:1px 4px">0</span></button>
        </div>
        <button class="nav-arrow nav-forward" aria-label="Avancer" onclick="history.forward()">›</button>
      </div>`;
  }

  function navHTML(user, active) {
    const role = user.role;
    let items;
    if (role === 'technicien') {
items = [['#/', 'home', 'Accueil', 'accueil'], ['#/installations', 'recycle', 'Tournées', 'tournees'], ['#/tech', 'chart', 'Rapports', 'tech'], ['#/stock', 'box', 'Matériel', 'stock'], ['#/profile', 'sliders', 'Profil', 'profil']];
    } else if (SUPER_LIKE.includes(role)) {
      items = [['#/', 'home', 'Accueil', 'accueil'], ['#/admin', 'shield', 'Supervision', 'admin'], ['#/admin/agents', 'users', 'Équipes', 'agents'], (role === 'admintech' ? ['#/admin/tech', 'truck', 'Technique', 'tech'] : ['#/admin/reports', 'chart', 'Rapports', 'reports']), ['#/profile', 'sliders', 'Profil', 'profil']];
    } else {
      items = [['#/', 'home', 'Accueil', 'accueil'], ['#/customers', 'users', 'Clients', 'clients'], ['#/prospects', 'target', 'Prospects', 'prospects'], ['#/installments', 'calendar', 'Échéances', 'echeances'], ['#/profile', 'sliders', 'Profil', 'profil']];
    }
    return `<nav class="bottomnav">${items.map(([href, ic, lbl, key]) => `<a href="${href}" class="${active === key ? 'active' : ''}"><span class="ic" aria-hidden="true">${icon(ic, 20)}</span>${lbl}</a>`).join('')}</nav>`;
  }

  let lastNotifCheck = 0;
  async function updateNotifBadge() {
    if (!TAKATA.store.token || !TAKATA.store.online) return;
    const now = Date.now();
    if (now - lastNotifCheck < 30000) return; // au plus 1 requête toutes les 30 s
    lastNotifCheck = now;
    try {
      const d = await TAKATA.request('GET', '/notifications');
      const badge = document.getElementById('notif-badge');
      if (badge) {
        badge.style.display = d.unread ? 'inline-block' : 'none';
        badge.textContent = d.unread;
      }
    } catch (e) {}
  }

  // --- Indicateur hors-ligne persistant ---
  function updateOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    const pending = TAKATA.queueLength();
    if (!TAKATA.store.online || pending > 0) {
      banner.style.display = 'flex';
      banner.textContent = !TAKATA.store.online
        ? `Hors-ligne — les opérations seront synchronisées plus tard`
        : `⏳ ${pending} opération(s) en attente de synchronisation`;
    } else {
      banner.style.display = 'none';
    }
  }

  TAKATA.onChange((type, val) => {
    if (type === 'sync-error') {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = `⚠️ ${val.length} opération(s) hors-ligne ont échoué (voir détails)`;
        toast.className = 'toast show error';
        setTimeout(() => (toast.className = 'toast'), 3200);
      }
      return;
    }
    if (type === 'online') {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = val ? '🟢 Connexion rétablie' : '🔴 Mode hors-ligne activé';
        toast.className = 'toast show' + (val ? '' : ' error');
        setTimeout(() => (toast.className = 'toast'), 2600);
      }
      if (val) TAKATA.flushQueue().then(() => { if (location.hash !== '#/login') renderRoute(); });
      updateOfflineBanner();
    }
    if (type === 'queue' && window.renderRoute) updateOfflineBanner();
  });

  // --- Mise a jour de l'application (PWA) : proposer des qu'une version est prete ---
  function showUpdateBanner(reg) {
    const b = document.getElementById('update-banner');
    if (!b) return;
    b.style.display = 'flex';
    const btn = document.getElementById('update-btn');
    if (btn && !btn.dataset.wired) {
      btn.dataset.wired = '1';
      btn.addEventListener('click', () => {
        b.style.display = 'none';
        if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        else location.reload();
      });
    }
  }

  // --- Démarrage ---
  window.addEventListener('hashchange', renderRoute);

  async function boot() {
    await TAKATA.loadMe();
    updateOfflineBanner();
    // Service worker : enregistrement + vérification de mise à jour + rechargement au takeover
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        reg.update();
        let reloaded = false;
        let hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // Un nouveau SW (nouvelle version du shell) prend le contrôle : recharger une seule fois,
          // mais PAS au tout premier contrôle (claim initial) qui réinitialiserait la page à vide.
          if (hadController && !reloaded && navigator.serviceWorker.controller) { reloaded = true; location.reload(); }
          hadController = true;
        });
        // Proposer la mise a jour des qu'une nouvelle version est prete
        const announce = () => { if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg); };
        if (reg.waiting) announce();
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => { if (nw.state === 'installed') announce(); });
        });
        const checkUpd = () => { reg.update().catch(() => {}); };
        setInterval(checkUpd, 5 * 60 * 1000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpd(); });
      } catch (e) {}
    }
    // Flush la file si en ligne
    if (TAKATA.store.online && TAKATA.queueLength()) TAKATA.flushQueue();
    renderRoute();
  }

  window.renderRoute = renderRoute;
  boot();
})();