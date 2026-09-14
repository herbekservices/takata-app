// tests/fixup_v3.js — Réparation des 3 cassures de syntaxe du patch v3
const fs = require('fs');
const path = require('path');
const P = (f) => path.join(__dirname, '..', f);
const out = [];

// ---- 1. routes/agent.js : bloc de garde propre ----
let agent = fs.readFileSync(P('routes/agent.js'), 'utf8').split('\n');
const gIdx = agent.findIndex((l) => l.includes('const guardCommercial = (req, res, next) => {') && l.includes('isCommercialScope'));
if (gIdx !== -1) {
  // La ligne fusionnée commence par le commentaire "// Périmètres..." : remonter au commentaire
  const commentIdx = gIdx - 1;
  agent.splice(commentIdx, (gIdx - commentIdx) + 4,
    '// Périmètres : données commerciales = direction + superviseur commercial ;',
    '// données techniques = superviseur technique + techniciens.',
    "const isCommercialScope = (u) => isSuper(u) || u.role === 'admincomm';",
    "const isTechScope = (u) => u.role === 'admintech' || isTechnician(u);",
    'const guardCommercial = (req, res, next) => {',
    "  if (isTechScope(req.user)) return res.status(403).json({ error: 'Action réservée aux équipes commerciales.' });",
    '  next();',
    '};');
  out.push('agent.js : bloc de gardes réécrit (8 lignes)');
} else out.push('⚠️ agent.js : garde déjà propre');

// ---- 2. routes/sync.js : supprimer la fermeture orpheline + insérer la garde applyOp ----
let sync = fs.readFileSync(P('routes/sync.js'), 'utf8').split('\n');
const orphanIdx = sync.findIndex((l, i) =>
  l.trim() === '}' && i > 0 && sync[i - 1].includes('.run(user.id, info.lastInsertRowid, installation_id || null, comm);'));
if (orphanIdx !== -1) {
  sync.splice(orphanIdx, 1);
  out.push('sync.js : fermeture orpheline supprimée');
} else out.push('⚠️ sync.js : pas de fermeture orpheline');
const applyIdx = sync.findIndex((l) => l.trim() === 'function applyOp(user, op, payload) {');
if (applyIdx !== -1 && !sync.some((l) => l.includes('COMMERCIAL_OPS.includes(op)'))) {
  sync.splice(applyIdx + 1, 0,
    "  if (isTechBlocked(user) && COMMERCIAL_OPS.includes(op)) throw new Error('Opération réservée aux équipes commerciales.');");
  out.push('sync.js : garde applyOp insérée');
} else out.push('⚠️ sync.js : garde applyOp déjà présente ou fonction introuvable');

// ---- 3. seed.js : réparer la ligne du renouvellement ----
let seed = fs.readFileSync(P('seed.js'), 'utf8').split('\n');
const badIdx = seed.findIndex((l) => l.startsWith("SELECT id FROM installments WHERE installation_id = ? AND status = 'pending'"));
if (badIdx !== -1) {
  seed[badIdx] = "  const renouv = db.prepare(`SELECT id FROM installments WHERE installation_id = ? AND status = 'pending' AND due_date >= date('now','localtime') ORDER BY due_date LIMIT 1`).get(abs1);";
  out.push('seed.js : ligne renouvellement réparée');
} else out.push('⚠️ seed.js : ligne déjà réparée');

fs.writeFileSync(P('routes/agent.js'), agent.join('\n'), 'utf8');
fs.writeFileSync(P('routes/sync.js'), sync.join('\n'), 'utf8');
fs.writeFileSync(P('seed.js'), seed.join('\n'), 'utf8');
console.log(out.join('\n'));