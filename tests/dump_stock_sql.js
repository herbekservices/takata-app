// tests/dump_stock_sql.js — affiche le SELECT du GET /admin/stock
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'admin.js'), 'utf8').split('\n');
s.forEach((l, i) => {
  if (l.includes('SELECT si.id') || l.includes("router.get('/stock'")) console.log((i + 1) + ': ' + l.trim().slice(0, 140));
});