// tests/snap_roles.js — Captures d'écran du rendu 11 Build par rôle (Edge headless + CDP)
// Usage : node tests/snap_roles.js [dossierSortie]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = process.argv[2] || path.join(__dirname, '..', 'captures');
const BASE = 'http://localhost:8080';
const DEB = 9223; // port de debug unique

fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Lancer Edge headless avec debug
const userDir = path.join(process.env.TEMP || '.', 'edge-snap-' + Date.now());
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--window-size=430,900',
  `--remote-debugging-port=${DEB}`, `--user-data-dir=${userDir}`,
  '--no-first-run', '--disable-extensions', '--hide-scrollbars',
  'about:blank'
], { stdio: 'ignore' });

let nextId = 0;
function cdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) {
        ws.removeEventListener('message', onMsg);
        if (m.error) reject(new Error(method + ': ' + JSON.stringify(m.error)));
        else resolve(m.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  // 2. Attendre le port de debug
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEB}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch (e) { await sleep(400); }
  }
  if (!target) throw new Error('Edge CDP indisponible');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });

  await cdp(ws, 'Page.enable');
  await cdp(ws, 'Runtime.enable');
  await cdp(ws, 'Emulation.setDeviceMetricsOverride', { width: 430, height: 900, deviceScaleFactor: 1, mobile: true });

  const shot = async (name) => {
    const r = await cdp(ws, 'Page.captureScreenshot', { format: 'png' });
    const file = path.join(OUT, name + '.png');
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    console.log('📸 ' + file + ' (' + Math.round(r.data.length / 1024) + ' Ko)');
  };

  const evaluate = async (expr) => {
    const r = await cdp(ws, 'Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('evaluate: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result && r.result.value;
  };

  // 3. Ouverture de l'app
  await cdp(ws, 'Page.navigate', { url: BASE + '/' });
  await sleep(2200);

  // 4a. Login (page d'authentification restylée)
  await shot('01_login');

  // 4b. Connexion agent1 → dashboard commercial
  await evaluate(`(async () => {
    await TAKATA.login('agent1', 'agent123');
    location.hash = '#/'; if (typeof renderRoute === 'function') renderRoute();
    return TAKATA.store.user.full_name;
  })()`);
  await sleep(2400);
  await shot('02_dashboard_agent1');

  // 4c. Technicien
  await evaluate(`(async () => {
    await TAKATA.login('technicien1', 'tech123');
    location.hash = '#/'; if (typeof renderRoute === 'function') renderRoute();
    return TAKATA.store.user.full_name;
  })()`);
  await sleep(2400);
  await shot('03_dashboard_technicien');

  // 4d. admincomm → supervision
  await evaluate(`(async () => {
    await TAKATA.login('admincomm', 'admincomm123');
    location.hash = '#/admin'; if (typeof renderRoute === 'function') renderRoute();
    return TAKATA.store.user.full_name;
  })()`);
  await sleep(2400);
  await shot('04_supervision_admincomm');

  // 4e. adminGEN → équipes (gestion des comptes)
  await evaluate(`(async () => {
    await TAKATA.login('admin', 'admin123');
    location.hash = '#/admin/agents'; if (typeof renderRoute === 'function') renderRoute();
    return TAKATA.store.user.full_name;
  })()`);
  await sleep(2400);
  await shot('05_equipes_admingen');

  ws.close();
  edge.kill();
  console.log('✅ Captures terminées dans ' + OUT);
}

main().catch((e) => { console.error('Erreur :', e.message); try { edge.kill(); } catch (x) { /* */ } process.exit(1); });