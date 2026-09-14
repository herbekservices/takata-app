// tests/fix_case.js — checks de rendu insensibles à la casse (les .lbl sont en majuscules CSS)
const fs = require('fs');
const P = (f) => require('path').join(__dirname, '..', f);
let rc = fs.readFileSync(P('tests/render-check.js'), 'utf8');

rc = rc.replace(
  "return t.includes('Accueil') && t.includes('Vue supervision') && t.includes('Encaissé (mois)');",
  "const tl = t.toLowerCase();\n    return tl.includes('accueil') && tl.includes('vue supervision') && tl.includes('encaissé (mois)');"
);
rc = rc.replace(
  "const agentDash = await page.evaluate(() => document.body.innerText.includes('Encaissé (mois)'));",
  "const agentDash = await page.evaluate(() => document.body.innerText.toLowerCase().includes('encaissé (mois)'));"
);
rc = rc.replace(
  "const notifOk = await page.evaluate(() => document.body.innerText.includes('Notifications'));",
  "const notifOk = await page.evaluate(() => document.body.innerText.toLowerCase().includes('notifications'));"
);
rc = rc.replace(
  "const instOk = await page.evaluate(() => document.body.innerText.includes('Échéances') || document.body.innerText.includes('due le'));",
  "const instOk = await page.evaluate(() => { const tl = document.body.innerText.toLowerCase(); return tl.includes('échéances') || tl.includes('due le'); });"
);
fs.writeFileSync(P('tests/render-check.js'), rc, 'utf8');
console.log('render-check.js : 4 checks insensibles à la casse');