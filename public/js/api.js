// api.js — Client API TAKATA : token, fetch, mode hors-ligne (file d'attente)
(function () {
  const API = '/api';
  const TOKEN_KEY = 'takata_token';
  const USER_KEY = 'takata_user';
  const QUEUE_KEY = 'takata_queue';
  const REQUEST_TIMEOUT_MS = 15000;

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  const store = {
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: readJSON(USER_KEY),
    online: navigator.onLine !== false,
    queue: readJSON(QUEUE_KEY) || [],
    listeners: []
  };
  if (!Array.isArray(store.queue)) store.queue = [];

  function saveUser(u) {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  }
  function saveQueue() {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(store.queue.slice(0, 200)));
  }

  function setOnline(v) {
    if (store.online !== v) {
      store.online = v;
      store.listeners.forEach((fn) => fn('online', v));
    }
  }

  function onChange(fn) { store.listeners.push(fn); }

  async function request(method, path, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (store.token) headers['Authorization'] = 'Bearer ' + store.token;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(API + path, {
        method, headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: opts.signal || controller.signal
      });
    } catch (e) {
      clearTimeout(timer);
      throw new ApiError(0, 'Serveur non joignable — vérifiez que le serveur TAKATA est démarré (npm start) ou votre connexion.');
    }
    clearTimeout(timer);
    if (res.status === 401 && !opts.skipAuthRedirect) {
      logout();
      location.hash = '#/login';
      throw new ApiError(401, 'Session expirée');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) throw new ApiError(res.status, (data && data.error) || 'Erreur ' + res.status, data);
    return data;
  }

  class ApiError extends Error {
    constructor(status, message, data) { super(message); this.status = status; this.data = data || null; }
  }

  // Requête avec file hors-ligne pour les écritures
  async function offlineAware(method, path, body) {
    if (store.online) {
      try {
        return await request(method, path, body);
      } catch (e) {
        if (e.status >= 500 || e.status === 0 || e instanceof TypeError) {
          if (method !== 'GET') return enqueue(method, path, body);
          throw e;
        }
        throw e;
      }
    }
    if (method !== 'GET') return enqueue(method, path, body);
    throw new ApiError(0, 'Hors ligne');
  }

  function enqueue(method, path, body) {
    const item = {
      uuid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      method, path, body,
      ts: new Date().toISOString()
    };
    store.queue.push(item);
    saveQueue();
    notifyListeners();
    return { queued: true, uuid: item.uuid };
  }

  async function flushQueue() {
    if (!store.online || store.queue.length === 0) return { flushed: 0, remaining: 0 };
    const ops = store.queue.map((it) => ({
      uuid: it.uuid,
      op: serverOp(it),
      payload: it.body || {},
      created_at: it.ts
    }));
    const payload = { operations: ops };
    const res = await request('POST', '/sync', payload);
    const okUuids = new Set((res.results || []).filter((r) => r.status === 'done').map((r) => r.uuid));
    const errUuids = new Set((res.results || []).filter((r) => r.status === 'error').map((r) => r.uuid));
    const before = store.queue.length;
    store.queue = store.queue.filter((it) => !okUuids.has(it.uuid) && !errUuids.has(it.uuid));
    saveQueue();
    notifyListeners();
    const flushed = before - store.queue.length;
    const errored = (res.results || []).filter((r) => r.status === 'error');
    if (errored.length) {
      store.listeners.forEach((fn) => fn('sync-error', errored));
    }
    return { flushed, remaining: store.queue.length, results: res.results, errored };
  }

  // Mappe {méthode, chemin} -> opération serveur
  function serverOp(it) {
    const map = {
      'POST:/customers': 'create_customer',
      'POST:/prospects': 'create_prospect',
      'POST:/installations': 'create_installation',
      'POST:/payments': 'record_payment'
    };
    if (map[`${it.method}:${it.path}`]) return map[`${it.method}:${it.path}`];
    const putMatch = it.path.match(/^\/customers\/(\d+)$/);
    if (it.method === 'PUT' && putMatch) {
      it.body = Object.assign({}, it.body, { id: Number(putMatch[1]) });
      return 'update_customer';
    }
    const putProsp = it.path.match(/^\/prospects\/(\d+)$/);
    if (it.method === 'PUT' && putProsp) {
      it.body = Object.assign({}, it.body, { id: Number(putProsp[1]) });
      return 'update_prospect';
    }
    return (it.method + ' ' + it.path);
  }

  function notifyListeners() {
    store.listeners.forEach((fn) => fn('queue', store.queue.length));
  }
  function queueLength() { return store.queue.length; }

  async function login(username, password, code) {
    const payload = { username, password };
    if (code) payload.code = code;
    const data = await request('POST', '/auth/login', payload, { skipAuthRedirect: true });
    store.token = data.token;
    store.user = data.user;
    saveUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  }


  // --- Double authentification (TOTP) ---
  async function twofaSetup() { return request('POST', '/auth/2fa/setup', {}); }
  async function twofaEnable(code) { return request('POST', '/auth/2fa/enable', { code }); }
  async function twofaDisable(password) { return request('POST', '/auth/2fa/disable', { password }); }

  // --- Journal d audit (direction) ---
  async function audit(limit, q) { return request('GET', '/admin/audit?limit=' + (limit || 200) + (q ? '&q=' + encodeURIComponent(q) : '')); }
  async function logout() {
    try { if (store.token) await request('POST', '/auth/logout'); } catch (e) {}
    store.token = '';
    store.user = null;
    saveUser(null);
    localStorage.removeItem(TOKEN_KEY);
  }

  // Restaure la session : en cas d'échec réseau, on conserve l'utilisateur en cache
  // (hors-ligne) au lieu de rediriger vers le login. Seul un 401 nette la session.
  async function loadMe() {
    if (!store.token) { store.user = null; saveUser(null); return null; }
    try {
      const data = await request('GET', '/auth/me');
      store.user = data.user;
      saveUser(data.user);
      return data.user;
    } catch (e) {
      if (e.status === 0 || e instanceof TypeError) {
        return store.user; // hors-ligne : on garde la session locale
      }
      store.user = null; saveUser(null);
      return null;
    }
  }

  window.TAKATA = {
    store, request, offlineAware, enqueue, flushQueue, queueLength,
    login, twofaSetup, twofaEnable, twofaDisable, audit, logout, loadMe, onChange, setOnline, ApiError
  };

  window.addEventListener('online', () => { setOnline(true); flushQueue(); });
  window.addEventListener('offline', () => setOnline(false));

  // Nouvelle tentative périodique de vidage de la file (panne serveur sans coupure réseau)
  setInterval(() => { if (store.online && store.queue.length) flushQueue(); }, 30000);
})();
