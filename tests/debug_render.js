// tests/debug_render.js — Diagnostic du rendu des dashboards (puppeteer-core)
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 880, isMobile: true });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await page.goto('http://localhost:8080/#/login', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));

  for (const [u, p] of [['admin', 'admin123'], ['agent1', 'agent123']]) {
    await page.evaluate(async (uu, pp) => {
      await TAKATA.login(uu, pp);
      location.hash = '#/';
      if (typeof renderRoute === 'function') renderRoute();
    }, u, p);
    await new Promise((r) => setTimeout(r, 3000));
    const txt = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 500));
    console.log(`--- ${u} ---`);
    console.log(txt);
  }
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });