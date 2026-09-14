// tests/debug_login_text.js — vérifie les textes de la page de connexion
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
  const t = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
  console.log('TEXTE PAGE LOGIN :', t);
  console.log('slogan présent :', t.includes('Le partenaire de votre confort, au soin de notre environnement.'));
  console.log('ancienne phrase absente :', !t.includes('les équipes voient leur périmètre'));
  console.log('« Kolwezi » absent :', !t.includes('Kolwezi'));
  console.log('« Lubumbashi » absent :', !t.includes('Lubumbashi'));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });