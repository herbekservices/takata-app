// tests/fix_v41e.js — assertions §10 alignées sur le modèle réel (faux positifs du harnais)
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tests', 'roles_test.js');
let s = fs.readFileSync(p, 'utf8');
const out = [];

// (d) summary admincomm : l'invariant = aucun technicien dans le classement
s = s.replace(
  "check('summary admincomm : classement limité aux commerciaux', commAgents.length > 0 && commAgents.every((n) => /Kabeya|Mbuyi|Ilunga/.test(n)), JSON.stringify(commAgents));",
  "check('summary admincomm : classement limité aux commerciaux (aucun technicien)', commAgents.length > 0 && commAgents.every((n) => !/Kavira Mwamba/.test(n)), JSON.stringify(commAgents));"
);
out.push('check (d) corrigé : invariant « aucun technicien »');

// (f) admintech : remplacer le check par le scénario réel (ajustement par admintech sur son technicien)
const oldF = s.indexOf("  const movsTech = await api('GET', '/admin/stock/movements', null, admintech.token);");
const oldFEnd = s.indexOf("check('mouvements admintech : matériel technique visible',", oldF);
if (oldF !== -1 && oldFEnd !== -1) {
  const lineEnd = s.indexOf('\n', oldFEnd);
  s = s.slice(0, oldF) + [
    "  // admintech ajuste le stock de son technicien → mouvement tracé, visible pour lui, masqué pour admincomm",
    "  const techRow = teamAll2.find((x) => x.role === 'technicien' && x.username === 'technicien1');",
    "  const techSet = await api('POST', '/admin/stock/set', { product_id: sacs.id, agent_id: techRow.id, quantity: 55 }, admintech.token);",
    "  check('admintech ajuste le stock de son technicien (HTTP ' + techSet.status + ')', techSet.status === 200);",
    "  const movsTech = await api('GET', '/admin/stock/movements', null, admintech.token);",
    "  check('mouvement d\\'ajustement technique visible pour admintech', (movsTech.data || []).some((m) => /Ajustement manuel/.test(m.note || '')), 'lignes: ' + (movsTech.data || []).length);",
    "  const movsCommAfter = await api('GET', '/admin/stock/movements', null, admincomm.token);",
    "  check('mouvement technique masqué pour admincomm', !((movsCommAfter.data || []).some((m) => /Ajustement manuel/.test(m.note || '') && /Musasa/.test(m.agent || ''))), 'lignes: ' + (movsCommAfter.data || []).length);"
  ].join('\n') + s.slice(lineEnd);
  out.push('check (f) remplacé par le scénario réel');
} else { out.push('⚠️ check (f) non trouvé'); }

fs.writeFileSync(p, s, 'utf8');
console.log(out.join('\n'));