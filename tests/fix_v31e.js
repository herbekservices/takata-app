// tests/fix_v31e.js — placeholders génériques + SW v5 + cache-busting ?v=5
const fs = require('fs');
const path = require('path');
const out = [];

let a = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'admin.js'), 'utf8');
const n1 = (a.match(/ex\. Lubumbashi/g) || []).length;
a = a.split('ex. Lubumbashi').join('ex. Ville');
fs.writeFileSync(path.join(__dirname, '..', 'public', 'js', 'admin.js'), a, 'utf8');
out.push('admin.js: ' + n1 + ' placeholder(s) → ex. Ville');

let sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
if (sw.includes('takata-v4')) { sw = sw.replace('takata-v4', 'takata-v5'); out.push('sw.js: cache → takata-v5'); }
else out.push('⚠️ sw.js: takata-v4 non trouvé');
fs.writeFileSync(path.join(__dirname, '..', 'public', 'sw.js'), sw, 'utf8');

let h = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const n2 = (h.match(/\?v=4/g) || []).length;
h = h.split('?v=4').join('?v=5');
fs.writeFileSync(path.join(__dirname, '..', 'public', 'index.html'), h, 'utf8');
out.push('index.html: ' + n2 + ' × ?v=4 → ?v=5');

console.log(out.join('\n'));