// tests/debug_eye2.js — diagnostic détaillé de l'état d'erreur du formulaire
const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 880, isMobile: true });
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('TAKATA')) console.log('[console]', m.text().slice(0, 150)); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 150)));
  await page.goto('http://localhost:8080/#/login', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  await page.type('#login-username', 'admin');
  await page.type('#login-password', 'mauvais-mdp');
  await page.evaluate(() => document.getElementById('login-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await new Promise((r) => setTimeout(r, 1200));
  const state = await page.evaluate(() => ({
    hash: location.hash,
    errUser: document.getElementById('err-user') ? document.getElementById('err-user').innerHTML : '(absent)',
    errPass: document.getElementById('err-pass') ? document.getElementById('err-pass').innerHTML : '(absent)',
    loginError: document.getElementById('login-error') ? document.getElementById('login-error').innerHTML + ' | display=' + document.getElementById('login-error').style.display : '(absent)',
    classUser: document.getElementById('field-user') ? document.getElementById('field-user').className : '(absent)',
    classPass: document.getElementById('field-pass') ? document.getElementById('field-pass').className : '(absent)',
    user: TAKATA.store.user
  }));
  console.log(JSON.stringify(state, null, 2));
  await page.screenshot({ path: 'captures/login_erreur2.png' });
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });