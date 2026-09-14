// tests/render-check.js — Rendu PWA via Chrome headless (puppeteer-core)
// Vérifie que l'UI se charge (login, dashboards, listes, rapports) et capture des écrans
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:8080';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function loginAs(page, username, password) {
  await page.evaluate(async (u, p) => {
try { await TAKATA.login(u, p); location.hash = '#/'; if (typeof renderRoute === 'function') renderRoute(); }
    catch (e) { console.error('loginAs error: ' + e.message); }
  }, username, password);
  await page.waitForFunction(() => location.hash.startsWith('#/') && !location.hash.includes('login'), { timeout: 10000 }).catch(() => {});
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 880, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });

  const errors = [];
  const badResponses = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) badResponses.push(r.status() + ' ' + r.url()); });

  // 1. Login (formulaire réel)
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, '01-login.png') });
  const loginOk = await page.evaluate(() => !!document.querySelector('.auth-card') && document.body.innerText.includes('TAKATA'));
  console.log('Login page render:', loginOk ? 'OK' : 'FAIL');

  // 2. Connexion admin via le formulaire
  await page.type('input[name=username]', 'admin');
  await page.type('input[name=password]', 'admin123');
  await page.evaluate(() => document.querySelector('#login-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await page.waitForFunction(() => location.hash.startsWith('#/') && !location.hash.includes('login'), { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUT, '02-dashboard-admin.png') });
  await page.waitForSelector('.stat', { timeout: 10000 }).catch(() => {});
  const dashOk = await page.evaluate(() => {
    const t = document.body.innerText;
const tl = t.toLowerCase();
    return tl.includes('accueil') && tl.includes('vue supervision') && tl.includes('encaissé (mois)');
  });
  console.log('Admin dashboard render:', dashOk ? 'OK' : 'FAIL');

  // 3. Vue clients (admin)
  await page.goto(BASE + '/#/customers', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, '03-customers-admin.png') });
  const custOk = await page.evaluate(() => document.querySelectorAll('.list-item').length > 0 || !!document.querySelector('.empty'));
  console.log('Customers list render:', custOk ? 'OK' : 'FAIL');

  // 4. Agent : dashboard
  await loginAs(page, 'agent1', 'agent123');
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUT, '04-dashboard-agent.png') });
  await page.waitForSelector('.stat', { timeout: 10000 }).catch(() => {});
  const agentDash = await page.evaluate(() => document.body.innerText.toLowerCase().includes('encaissé (mois)'));
  console.log('Agent dashboard render:', agentDash ? 'OK' : 'FAIL');

  // 5. Échéances agent
  await page.goto(BASE + '/#/installments', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, '05-installments-agent.png') });
  const instOk = await page.evaluate(() => { const tl = document.body.innerText.toLowerCase(); return tl.includes('échéances') || tl.includes('due le'); });
  console.log('Installments view render:', instOk ? 'OK' : 'FAIL');

  // 6. Rapports admin
  await loginAs(page, 'admin', 'admin123');
  await new Promise((r) => setTimeout(r, 2000));
  await page.goto(BASE + '/#/admin/reports', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT, '06-reports-admin.png') });
  const repOk = await page.evaluate(() => {
    const t = document.body.innerText.toUpperCase();
    return t.includes('EXPORTS CSV') && t.includes('PAR AGENT');
  });
  if (!repOk) console.log('  body=' + JSON.stringify(await page.evaluate(() => document.body.innerText.slice(0, 220))));
  console.log('Reports admin render:', repOk ? 'OK' : 'FAIL');

  // 7. Notifications (admin)
  await page.goto(BASE + '/#/notifications', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  const notifOk = await page.evaluate(() => document.body.innerText.toLowerCase().includes('notifications') || !!document.querySelector('.empty'));
  console.log('Notifications view render:', notifOk ? 'OK' : 'FAIL');

  console.log('JS errors:', errors.length ? errors.slice(0, 8) : 'aucune');
  console.log('Bad responses:', badResponses.length ? badResponses : 'aucune');
  await browser.close();
  const allOk = [loginOk, dashOk, custOk, agentDash, instOk, repOk, notifOk].every(Boolean);
  process.exit(allOk && !errors.length ? 0 : 1);
})();