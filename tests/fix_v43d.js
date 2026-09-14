// tests/fix_v43d.js — suites alignées sur le nouveau modèle (création/modification = direction uniquement)
const fs = require('fs');
const path = require('path');
const out = [];

function patch(f, rules) {
  const p = path.join(__dirname, '..', f);
  let s = fs.readFileSync(p, 'utf8');
  for (const [match, replacement] of rules) {
    if (s.includes(match)) { s = s.replace(match, replacement); out.push(`  ${f}: ${match.slice(0, 55)}`); }
    else out.push(`  ⚠️ ${f}: NON TROUVÉ → ${match.slice(0, 55)}`);
  }
  fs.writeFileSync(p, s, 'utf8');
}

// ============ audit_all.js ============
patch('tests/audit_all.js', [
  [
    "['POST /admin/agents', { admin: 201, admincomm: 201, admintech: 201, agent: 403, technicien: 403 }],",
    "['POST /admin/agents', { admin: 201, admincomm: 403, admintech: 403, agent: 403, technicien: 403 }],"
  ],
  [
    "['POST /admin/stock/set', { admin: 200, admincomm: 200, admintech: 200, agent: 403, technicien: 403 }],",
    "['POST /admin/stock/set', { admin: 200, admincomm: 403, admintech: 403, agent: 403, technicien: 403 }],"
  ],
  [
    "['PUT /admin/agents/:id (renommage membre du périmètre)', { admin: 200, admincomm: 200, admintech: 200, agent: 403, technicien: 403 }],",
    "['PUT /admin/agents/:id (renommage — direction seule)', { admin: 200, admincomm: 403, admintech: 403, agent: 403, technicien: 403 }],"
  ],
  [
    "['DELETE /admin/agents/:id (409 direction / 200 superviseur / 401 session invalidée / 404 hors périmètre)', { admin: 409, admincomm: 200, admintech: 404, agent: 401, technicien: 403 }],",
    "['DELETE /admin/agents/:id (409 direction / 403 superviseur / 401 session invalidée / 404 hors périmètre)', { admin: 409, admincomm: 403, admintech: 404, agent: 401, technicien: 403 }],"
  ]
]);

// ============ roles_test.js ============
patch('tests/roles_test.js', [
  [
    "check('admincomm ne peut PAS créer un technicien (rôle forcé agent, pas d’élévation)', acCreateTech.status === 201 && acCreateTech.data.role === 'agent', JSON.stringify(acCreateTech.data));",
    "check('admincomm ne peut plus créer de compte (403, réservé à la direction)', acCreateTech.status === 403, JSON.stringify(acCreateTech.data));"
  ],
  [
    "check('admincomm crée un commercial → ' + acCreateAgent.status, acCreateAgent.status === 201);",
    "check('admincomm ne peut plus créer un commercial (403)', acCreateAgent.status === 403, 'status=' + acCreateAgent.status);"
  ],
  [
    "check('admintech ne peut PAS créer un commercial (rôle forcé technicien, pas d’élévation)', atCreateAgent.status === 201 && atCreateAgent.data.role === 'technicien', JSON.stringify(atCreateAgent.data));",
    "check('admintech ne peut plus créer de compte (403, réservé à la direction)', atCreateAgent.status === 403, JSON.stringify(atCreateAgent.data));"
  ],
  [
    "check('admintech crée un technicien', atCreateTech.status === 201);",
    "check('admintech ne peut plus créer un technicien (403)', atCreateTech.status === 403, 'status=' + atCreateTech.status);"
  ]
]);

// ============ e2e_profiles.js ============
patch('tests/e2e_profiles.js', [
  [
    "check('superviseur commercial recrute un commercial (l\\'équipe grandit)', newAgent.status === 201);",
    "check('superviseur commercial ne peut plus créer de compte (403, réservé à la direction)', newAgent.status === 403, 'status=' + newAgent.status);"
  ],
  [
    "check('superviseur met à jour le téléphone du nouveau commercial', phoneEdit.status === 200);",
    "check('superviseur ne peut plus modifier un compte (403)', phoneEdit.status === 403, 'status=' + phoneEdit.status);"
  ],
  [
    "check('superviseur technique recrute un technicien', newTech.status === 201);",
    "check('superviseur technique ne peut plus créer de compte (403)', newTech.status === 403, 'status=' + newTech.status);"
  ]
]);

console.log(out.join('\n'));