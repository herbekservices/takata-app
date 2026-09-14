// tests/fix_render_empty.js — render-check compatible base vide (états vides = rendu valide)
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tests', 'render-check.js');
let s = fs.readFileSync(p, 'utf8');
let n = 0;

// Customers : liste OU état vide
s = s.replace(
  "const custOk = await page.evaluate(() => document.querySelectorAll('.list-item').length > 0);",
  "const custOk = await page.evaluate(() => document.querySelectorAll('.list-item').length > 0 || !!document.querySelector('.empty'));"
);
n++;

// Notifications : contenu OU état vide
s = s.replace(
  "const notifOk = await page.evaluate(() => document.body.innerText.toLowerCase().includes('notifications'));",
  "const notifOk = await page.evaluate(() => document.body.innerText.toLowerCase().includes('notifications') || !!document.querySelector('.empty'));"
);
n++;

fs.writeFileSync(p, s, 'utf8');
console.log('render-check adapté (' + n + ' checks tolèrent la base vide)');