// tests/debug_reports_error.js — stack exacte de l'erreur de la vue Rapports
const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 880, isMobile: true });
  page.on('pageerror', (e) => { console.log('[pageerror]'); console.log(e.stack || e.message); });
  await page.goto('http://localhost:8080/#/login', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  await page.evaluate(async () => { await TAKATA.login('admin', 'admin123'); location.hash = '#/admin/reports'; if (typeof renderRoute === 'function') renderRoute(); });
  await new Promise((r) => setTimeout(r, 3000));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });