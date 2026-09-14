// tests/debug_eye.js — vérifie l'œil mot de passe sur la page de connexion
const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 880, isMobile: true });
  await page.goto('http://localhost:8080/#/login', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  const before = await page.evaluate(() => ({
    eye: !!document.getElementById('eye-btn'),
    type: document.getElementById('login-password') ? document.getElementById('login-password').type : null
  }));
  // Clic sur l'œil
  await page.click('#eye-btn');
  await new Promise((r) => setTimeout(r, 300));
  const after = await page.evaluate(() => ({
    type: document.getElementById('login-password') ? document.getElementById('login-password').type : null
  }));
  // Test d'erreur : mauvais mot de passe → croix rouge
  await page.type('#login-username', 'admin');
  await page.type('#login-password', 'mauvais-mdp');
  await page.evaluate(() => document.getElementById('login-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await new Promise((r) => setTimeout(r, 1500));
  const err = await page.evaluate(() => ({
    erreurVisible: document.getElementById('login-error') ? document.getElementById('login-error').innerHTML.slice(0, 120) : '',
    fieldError: document.getElementById('field-pass') ? document.getElementById('field-pass').className : ''
  }));
  console.log('œil présent :', before.eye, '| type avant clic :', before.type, '| après clic :', after.type);
  console.log('erreur 401 affichée :', JSON.stringify(err));
  await page.screenshot({ path: 'captures/login_erreur.png' });
  console.log('capture : captures/login_erreur.png');
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });