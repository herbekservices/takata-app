// tests/dump_scoped.js — affiche la fonction scopedRoles dans routes/auth.js
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'routes', 'auth.js'), 'utf8').split('\n');
s.forEach((l, i) => {
  if (/scopedRoles|SUPER_ROLES|ADMIN_ROLES|COMM_TEAM|TECH_TEAM|isSuper/.test(l)) console.log((i + 1) + ': ' + l);
});