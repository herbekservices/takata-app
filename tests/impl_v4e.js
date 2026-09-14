// tests/impl_v4e.js — PUT /agents/:id : role direction-only (ancres exactes)
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'routes', 'admin.js');
let s = fs.readFileSync(p, 'utf8').split('\n');
const out = [];

let i = s.findIndex((l) => l.includes("const { full_name, phone, region, team, active } = req.body || {};"));
if (i === -1) { console.log('⚠️ déclaration non trouvée'); process.exit(1); }
s[i] = "  const { full_name, phone, region, team, active, role } = req.body || {};\n  let newRole = u.role;\n  if (isSuper(req.user) && role && ['agent', 'technicien', 'admincomm', 'admintech'].includes(String(role))) newRole = String(role);";
out.push('déclaration + newRole (ligne ' + (i + 1) + ')');

let j = s.findIndex((l) => l.includes("UPDATE users SET full_name=?, phone=?, region=?, team=?, active=? WHERE id=?"));
if (j === -1) { console.log('⚠️ UPDATE non trouvé'); process.exit(1); }
s[j] = "  db.prepare('UPDATE users SET full_name=?, phone=?, region=?, team=?, role=?, active=? WHERE id=?')";
let k = s.findIndex((l) => l.includes(".run(full_name || u.full_name, phone ?? u.phone, region ?? u.region, team ?? u.team,"));
if (k === -1) { console.log('⚠️ run non trouvé'); process.exit(1); }
s[k] = "    .run(full_name || u.full_name, phone ?? u.phone, region ?? u.region, team ?? u.team, newRole, active === undefined ? u.active : (active ? 1 : 0), u.id);";
out.push('run avec newRole (ligne ' + (k + 1) + ')');

fs.writeFileSync(p, s.join('\n'), 'utf8');
console.log(out.join('\n'));