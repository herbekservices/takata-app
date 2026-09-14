// tests/fix_route_agents.js — restaure l'entrée de route agents cassée dans app.js
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'js', 'app.js');
let lines = fs.readFileSync(p, 'utf8').split('\n');
let fixed = 0;
lines = lines.map((l) => {
  // Ligne cassée : la fonction nue à la place de l'entrée de route
  if (l.trim() === '(p, q) => A.agentsView(q),') { fixed++; return "    [/^\\/admin\\/agents$/, (p, q) => A.agentsView(q), 'Agents', true, 'admin', 'admin'],"; }
  return l;
});
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log(fixed === 1 ? 'route agents restaurée' : '⚠️ ' + fixed + ' lignes touchées');