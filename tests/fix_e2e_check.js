// tests/fix_e2e_check.js — le client converti + souscrit a le statut « installé »
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tests', 'e2e_profiles.js');
let s = fs.readFileSync(p, 'utf8');
const before = "check('client visible dans le portefeuille (statut actif)', !!e2e && e2e.status === 'actif');";
const after = "check('client visible dans le portefeuille (statut ' + (e2e ? e2e.status : '?') + ')', !!e2e && ['actif', 'installé'].includes(e2e.status));";
if (s.includes(before)) { s = s.replace(before, after); fs.writeFileSync(p, s, 'utf8'); console.log('check corrigé'); }
else if (s.includes(after)) { console.log('déjà corrigé'); }
else { console.log('⚠️ motif non trouvé'); process.exit(1); }