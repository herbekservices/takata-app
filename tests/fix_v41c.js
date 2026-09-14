// tests/fix_v41c.js — 413 propre dans server.js + section 10 de tests (sécurité v3.2)
const fs = require('fs');
const path = require('path');
const out = [];
let miss = 0;

function load(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\n'); }
function save(f, l) { fs.writeFileSync(path.join(__dirname, '..', f), l.join('\n'), 'utf8'); }
function replaceOnce(lines, f, match, replacement) {
  const i = lines.findIndex((l) => l.includes(match));
  if (i === -1) { out.push(`  ⚠️ ${f}: NON TROUVÉ → ${match.slice(0, 70)}`); miss++; return lines; }
  lines[i] = replacement;
  out.push(`  ${f}: ${match.slice(0, 55)}`);
  return lines;
}

// 1. server.js : type entity.too.large → 413 (au lieu de 500)
let sv = load('server.js');
sv = replaceOnce(sv, 'server.js',
  "if (err && err.type === 'entity.parse.failed') {",
  "if (err && err.type === 'entity.too.large') {\n    return res.status(413).json({ error: 'Requête trop volumineuse.' });\n  }\n  if (err && err.type === 'entity.parse.failed') {");
save('server.js', sv);

// 2. roles_test.js : section 10
let t = load('tests/roles_test.js');
const anchorIdx = t.findIndex((l) => l.includes('console.log(`\\n═══ RÉSULTAT'));
if (anchorIdx === -1) { out.push('  ⚠️ roles_test: ancre non trouvée'); miss++; }
else {
  t.splice(anchorIdx, 0,
    "  console.log('── 10. SÉCURITÉ : consolidation, périmètres & protections (v3.2) ──');",
    "  // a) Route register-agent retirée (consolidation de la création de comptes)",
    "  const reg410 = await api('POST', '/auth/register-agent', { username: 'x-test', password: 'xxxxxx', full_name: 'X' }, admin.token);",
    "  check('register-agent retirée (410 → POST /admin/agents)', reg410.status === 410);",
    "  // b) Mutation cross-origin refusée",
    "  const evil = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: JSON.stringify({ username: 'agent1', password: 'agent123' }) });",
    "  check('mutation cross-origin refusée (403)', evil.status === 403);",
    "  // c) Payload surdimensionné refusé",
    "  const big = 'x'.repeat(80 * 1024);",
    "  const bigRes = await api('POST', '/sync', { operations: [{ uuid: 'big-' + ts, op: 'create_customer', payload: { name: big } }] }, admin.token);",
    "  check('payload > 64kb refusé (413)', bigRes.status === 413);",
    "  // d) Summary scopé : admincomm ne voit que les commerciaux",
    "  const sumComm = await api('GET', '/reports/summary', null, admincomm.token);",
    "  const commAgents = (sumComm.data.byAgent || []).map((x) => x.agent);",
    "  check('summary admincomm : classement limité aux commerciaux', commAgents.length > 0 && commAgents.every((n) => /Kabeya|Mbuyi|Ilunga/.test(n)), JSON.stringify(commAgents));",
    "  const sumAdm = await api('GET', '/reports/summary', null, admin.token);",
    "  check('summary adminGEN ≥ admincomm (encaissements)', Number(sumAdm.data.payments.total) >= Number(sumComm.data.payments.total), sumAdm.data.payments.total + ' vs ' + sumComm.data.payments.total);",
    "  // e) sync/pending scopé par équipe",
    "  const pendComm = await api('GET', '/sync/pending', null, admincomm.token);",
    "  const { data: teamAll2 } = await api('GET', '/admin/agents', null, admin.token);",
    "  const agentIds = teamAll2.filter((x) => x.role === 'agent').map((x) => x.id);",
    "  const techIds2 = teamAll2.filter((x) => x.role === 'technicien').map((x) => x.id);",
    "  check('sync/pending admincomm : opérations commerciales uniquement', (pendComm.data || []).every((o) => agentIds.includes(o.agent_id)), JSON.stringify([...new Set((pendComm.data || []).map((o) => o.agent_id))]));",
    "  const pendTech = await api('GET', '/sync/pending', null, admintech.token);",
    "  check('sync/pending admintech : opérations techniques uniquement', (pendTech.data || []).every((o) => techIds2.includes(o.agent_id)), JSON.stringify([...new Set((pendTech.data || []).map((o) => o.agent_id))]));",
    "  // f) Mouvements de stock scopés (matériel technique masqué à admincomm)",
    "  const movsComm = await api('GET', '/admin/stock/movements', null, admincomm.token);",
    "  check('mouvements admincomm : matériel technique masqué', (movsComm.data || []).every((m) => !/Kavira Mwamba/.test(m.agent || '')), 'lignes: ' + (movsComm.data || []).length);",
    "  const movsTech = await api('GET', '/admin/stock/movements', null, admintech.token);",
    "  check('mouvements admintech : matériel technique visible', (movsTech.data || []).some((m) => /Kavira Mwamba/.test(m.agent || '')), 'lignes: ' + (movsTech.data || []).length);",
    "");
  out.push('  roles_test: section 10 insérée (12 checks)');
}
save('tests/roles_test.js', t);

console.log(out.join('\n'));
console.log(miss ? 'FIX V41C PARTIEL' : 'FIX V41C OK');