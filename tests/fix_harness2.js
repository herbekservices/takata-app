// tests/fix_harness2.js — selfId fiable (req attend {token}) + options select inline
const fs = require('fs');
const path = require('path');
const P = (f) => path.join(__dirname, '..', f);
const out = [];

function readLines(f) { return fs.readFileSync(P(f), 'utf8').split('\n'); }
function writeLines(f, l) { fs.writeFileSync(P(f), l.join('\n'), 'utf8'); }
function replaceOnce(f, lines, match, replacement) {
  const i = lines.findIndex((l) => l.includes(match));
  if (i === -1) { out.push(`  ⚠️ ${f}: MOTIF NON TROUVÉ → ${match}`); return lines; }
  lines[i] = replacement;
  out.push(`  ${f}: remplacé (${match.slice(0, 50)})`);
  return lines;
}

// ---- security-test.js : token passé dans un objet { token } ----
let st = readLines('tests/security-test.js');
st = replaceOnce('tests/security-test.js', st,
  "const otherInstall = t2 ? ((await req('GET', '/installments', t2)).data || [])[0] : null;",
  "const otherInstall = t2 ? ((await req('GET', '/installments', { token: t2 })).data || [])[0] : null;");
st = replaceOnce('tests/security-test.js', st,
  "const badIds = async (p, key) => {",
  "const badIds = async (p, key) => {");
const bi = st.findIndex((l) => l.includes("const r = await req('GET', p, t2);"));
if (bi !== -1) { st[bi] = "    const r = await req('GET', p, { token: t2 });"; out.push('  security-test: badIds via {token}'); }
const meIdx = st.findIndex((l) => l.includes("const meSelf = await req('GET', '/auth/me', t1);"));
if (meIdx !== -1) { st[meIdx] = "  const meSelf = await req('GET', '/auth/me', { token: t1 });"; out.push('  security-test: meSelf via {token}'); }
writeLines('tests/security-test.js', st);

// ---- admin.js : options construites en JS pur (une seule interpolation simple) ----
let adm = readLines('public/js/admin.js');
const selIdx = adm.findIndex((l) => l.includes("<select id=\"f-role\" ${canPickRole ? '' : 'disabled'}>"));
if (selIdx !== -1) {
  adm.splice(selIdx, 0,
    "        const roleOptions = [",
    "          ['agent', 'Commercial (agent)'],",
    "          ['technicien', 'Technicien (ramasseur)'],",
    "          ['admincomm', 'Superviseur commercial (admincomm)'],",
    "          ['admintech', 'Superviseur technique (admintech)']",
    "        ].map(([v, lbl]) => `<option value=\"${esc(v)}\"${forcedRole === v && !canPickRole ? ' selected' : ''}>${esc(lbl)}</option>`).join('');"
  );
  const useIdx = adm.findIndex((l) => l.includes("<select id=\"f-role\" ${canPickRole ? '' : 'disabled'}>"));
  adm[useIdx] = adm[useIdx].replace(/\$\{[^}]*\}<\/select>/, '${roleOptions}</select>');
  out.push('  admin.js: options construites hors template');
}
writeLines('public/js/admin.js', adm);

console.log(out.join('\n'));
console.log(out.some((l) => l.includes('⚠️')) ? 'PATCH PARTIEL' : 'PATCH HARNESS2 OK');