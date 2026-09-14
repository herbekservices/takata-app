// tests/fix_v41f.js — réaligne les cas spéciaux du harnais avec les labels renommés
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tests', 'audit_all.js');
let s = fs.readFileSync(p, 'utf8');
const out = [];

// PUT : condition alignée sur le nouveau label
const before = s.includes("label === 'PUT /admin/agents/:id (profil direction → 403)')");
s = s.replace(
  "label === 'PUT /admin/agents/:id (profil direction → 403)'",
  "label === 'PUT /admin/agents/:id (profil direction → 403 / 404 hors périmètre)'"
);
out.push('PUT : condition réalignée (' + before + ')');

// DELETE : condition alignée sur le nouveau label
const before2 = s.includes("label === 'DELETE /admin/agents/:id (compte avec données → 409)'");
s = s.replace(
  "label === 'DELETE /admin/agents/:id (compte avec données → 409)'",
  "label === 'DELETE /admin/agents/:id (409 direction / 200 superviseur / 401 session invalidée / 404 hors périmètre)'"
);
out.push('DELETE : condition réalignée (' + before2 + ')');

fs.writeFileSync(p, s, 'utf8');
console.log(out.join('\n'));