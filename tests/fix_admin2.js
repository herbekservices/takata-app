// tests/fix_admin2.js — réparation définitive d'agentFormView (roleOptions hors template, sans ${} logique)
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'js', 'admin.js');
let lines = fs.readFileSync(p, 'utf8').split('\n');
const out = [];

const fnStart = lines.findIndex((l) => l.includes('async function agentFormView(params) {'));
const roleStart = lines.findIndex((l) => l.includes('const roleOptions = ['));
const roleEnd = lines.findIndex((l) => l.includes('].map(([v, lbl]) =>'));
const selLine = lines.findIndex((l) => l.includes('<select id="f-role"'));
if (fnStart === -1 || roleStart === -1 || roleEnd === -1 || selLine === -1) {
  console.log('⚠️ ancres manquantes', { fnStart, roleStart, roleEnd, selLine });
  process.exit(1);
}

// 1. Retirer le bloc mal placé (roleStart..roleEnd)
lines.splice(roleStart, roleEnd - roleStart + 1);
out.push('bloc roleOptions retiré du template (lignes ' + (roleStart + 1) + '-' + (roleEnd + 1) + ')');

// 2. Remplacer la ligne du select par ${roleOptions}
const selIdx = lines.findIndex((l) => l.includes('<select id="f-role"'));
lines[selIdx] = '        <div class="field"><label for="f-role">Profil ${canPickRole ? \'\' : \'(fixé par votre périmètre)\'}</label><select id="f-role" ${canPickRole ? \'\' : \'disabled\'}>${roleOptions}</select></div>';
out.push('ligne select remplacée (ligne ' + (selIdx + 1) + ')');

// 3. Insérer roleOptions juste avant le return du template
const returnIdx = (() => {
  for (let i = fnStart; i < lines.length; i++) {
    if (lines[i].trim() === 'return `') return i;
  }
  return -1;
})();
if (returnIdx === -1) { console.log('⚠️ return du template non trouvé'); process.exit(1); }
const block = [
  "    const roleOptions = [",
  "      ['agent', 'Commercial (agent)'],",
  "      ['technicien', 'Technicien (ramasseur)'],",
  "      ['admincomm', 'Superviseur commercial (admincomm)'],",
  "      ['admintech', 'Superviseur technique (admintech)']",
  "    ].map(([v, lbl]) => {",
  "      const sel = forcedRole === v && !canPickRole ? ' selected' : '';",
  "      return '<option value=\"' + esc(v) + '\"' + sel + '>' + esc(lbl) + '</option>';",
  "    }).join('');"
];
lines.splice(returnIdx, 0, ...block);
out.push('roleOptions inséré avant le return (ligne ' + (returnIdx + 1) + ')');

fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log(out.join('\n'));