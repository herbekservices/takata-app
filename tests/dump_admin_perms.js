// tests/dump_admin_perms.js — état des gardes direction-only dans routes/admin.js
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'admin.js'), 'utf8').split('\n');
s.forEach((l, i) => {
  if (/réservée à la direction|gestion du stock est réservée|saisie du stock est réservée|isSuper\(req\.user\) \|\| isSuper|userKey/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 120));
});