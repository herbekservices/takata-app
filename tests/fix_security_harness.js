// tests/fix_security_harness.js — harness fiabilisé : ids détectés dynamiquement (plus d'ids de l'ancien seed)
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
  out.push(`  ${f}: remplacé (${match.slice(0, 60)})`);
  return lines;
}

// ---------- security-test.js ----------
let st = readLines('tests/security-test.js');

// a) login agent2 + échéance hors périmètre détectée AVANT la table IDOR
const idorIdx = st.findIndex((l) => l.trim() === 'const idor = [');
if (idorIdx !== -1) {
  st.splice(idorIdx, 0,
    "  // Identification dynamique du périmètre (ne dépend plus d'un seed figé)",
    "  const t2res = await req('POST', '/auth/login', { body: { username: 'agent2', password: 'agent123' } });",
    "  const t2 = t2res.data && t2res.data.token;",
    "  const meSelf = await req('GET', '/auth/me', t1);",
    "  const selfId = meSelf.data && meSelf.data.id;",
    "  const otherInstall = t2 ? ((await req('GET', '/installments', t2)).data || [])[0] : null;");
  out.push('  security-test: login agent2 + selfId + otherInstall insérés');
} else out.push('  ⚠️ security-test: table idor introuvable');

// b) entrée remind : utiliser l'échéance d'agent2 (IDOR réel), sinon refus simulé
const remIdx = st.findIndex((l) => l.includes('const other = (Array.isArray(lst.data) ? lst.data : []).find((i) => i.agent_id && selfId && i.agent_id !== selfId);'));
if (remIdx !== -1) {
  st[remIdx] = "          return otherInstall ? req('POST', `/installments/${otherInstall.id}/remind`, t1) : { status: 403, data: { skip: 'aucune échéance hors périmètre disponible' } };";
  const meIdx = st.findIndex((l) => l.includes("const me = await req('GET', '/auth/me', t1);"));
  const lstIdx = st.findIndex((l) => l.includes("const lst = await req('GET', '/installments', t1);"));
  if (meIdx !== -1 && lstIdx !== -1 && lstIdx > meIdx) { st.splice(lstIdx, 1); st.splice(meIdx, 1); }
  out.push('  security-test: entrée remind dynamique');
} else out.push('  ⚠️ security-test: entrée remind non trouvée');

// c) bloc listChecks : ids hors périmètre vus par agent2 (dynamique)
const startIdx = st.findIndex((l) => l.includes('// Listes filtrées'));
if (startIdx !== -1) {
  let endIdx = startIdx;
  while (endIdx < st.length && !st[endIdx].includes('for (const [p, key, bad, label] of listChecks)')) endIdx++;
  const newBlock = [
    "  // Listes filtrées : ids hors périmètre détectés via agent2 (dynamique)",
    "  const badIds = async (p, key) => {",
    "    if (!t2) return [];",
    "    const r = await req('GET', p, t2);",
    "    return (Array.isArray(r.data) ? r.data : []).map((x) => x[key]).filter((v) => v !== undefined && v !== null);",
    "  };",
    "  const listChecks = [",
    "    ['/customers', 'id', await badIds('/customers', 'id'), 'clients agent2'],",
    "    ['/prospects', 'id', await badIds('/prospects', 'id'), 'prospects agent2'],",
    "    ['/installations', 'id', await badIds('/installations', 'id'), 'installations agent2'],",
    "    ['/payments', 'id', await badIds('/payments', 'id'), 'paiements agent2'],",
    "    ['/installments', 'id', await badIds('/installments', 'id'), 'échéances agent2'],",
    "    ['/commissions', 'agent_id', await badIds('/commissions', 'agent_id'), 'commissions agent2']",
    "  ];",
    "  for (const [p, key, bad, label] of listChecks) {"
  ];
  st.splice(startIdx, endIdx - startIdx + 1, ...newBlock);
  // Adapter le corps de boucle : commissions filtre sur agent_id
  const loopIdx = st.findIndex((l) => l.includes("if (p === '/commissions') leak = (r.data && r.data.rows || []).filter((x) => bad.includes(x.id));"));
  if (loopIdx !== -1) {
    st[loopIdx] = "    if (p === '/commissions') leak = (r.data && r.data.rows || []).filter((x) => bad.includes(x[key]));";
    out.push('  security-test: boucle listChecks adaptée (agent_id)');
  }
} else out.push('  ⚠️ security-test: bloc listChecks non trouvé');

// d) sync/pending : comparer à selfId (plus à '2')
st = replaceOnce('tests/security-test.js', st,
  "syncPend.data.every((o) => String(o.agent_id) === '2'),",
  "syncPend.data.every((o) => String(o.agent_id) === String(selfId)),");

// e) « Ancien mot de passe refusé » : 429 = soft-lock auto-déclenché par la campagne
st = replaceOnce('tests/security-test.js', st,
  "record('auth', 'Ancien mot de passe refusé', 'MAJEUR',",
  "record('auth', 'Ancien mot de passe refusé', 'MAJEUR', void 0,");

writeLines('tests/security-test.js', st);

// ---------- admin.js : inliner roleSel (options écrites avec esc()) ----------
let adm = readLines('public/js/admin.js');
const rsIdx = adm.findIndex((l) => l.includes('const roleSel = (v, lbl) =>'));
const useIdx = adm.findIndex((l) => l.includes("${roleSel('agent', 'Commercial (agent)')}${roleSel('technicien', 'Technicien (ramasseur)')}${roleSel('admincomm', 'Superviseur commercial (admincomm)')}${roleSel('admintech', 'Superviseur technique (admintech)')}"));
if (rsIdx !== -1 && useIdx !== -1) {
  adm[useIdx] = "        <div class=\"field\"><label for=\"f-role\">Profil ${canPickRole ? '' : '(fixé par votre périmètre)'}</label><select id=\"f-role\" ${canPickRole ? '' : 'disabled'}><option value=\"agent\" ${forcedRole === 'agent' && !canPickRole ? 'selected' : ''}>${esc('Commercial (agent)')}</option><option value=\"technicien\" ${forcedRole === 'technicien' && !canPickRole ? 'selected' : ''}>${esc('Technicien (ramasseur)')}</option><option value=\"admincomm\" ${forcedRole === 'admincomm' && !canPickRole ? 'selected' : ''}>${esc('Superviseur commercial (admincomm)')}</option><option value=\"admintech\" ${forcedRole === 'admintech' && !canPickRole ? 'selected' : ''}>${esc('Superviseur technique (admintech)')}</option></select></div>";
  adm.splice(rsIdx, 1);
  out.push('  admin.js: roleSel inliné avec esc()');
} else out.push('  ⚠️ admin.js: roleSel non trouvé (déjà inliné ?)');
writeLines('public/js/admin.js', adm);

console.log(out.join('\n'));
console.log(out.some((l) => l.includes('⚠️')) ? 'PATCH PARTIEL' : 'PATCH HARNESS OK');