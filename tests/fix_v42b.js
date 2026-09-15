// tests/fix_v42b.js — corrections mineures de la revue v4 (readme, watchdog backoff, apk description)
const fs = require('fs');
const path = require('path');
const out = [];
let miss = 0;

// 1. readme.md : mode vide documenté + nouvelles suites
const rp = path.join(__dirname, '..', 'readme.md');
let rm = fs.readFileSync(rp, 'utf8');
rm = rm.replace(
  "npm run seed      # base de démonstration propre (déjà fait — base actuelle = seed)",
  "npm run seed      # base PROPRE : comptes + formules uniquement (zéro donnée de démo)\nnpm run seed -- --demo   # (optionnel) base de démonstration pour les tests"
);
rm = rm.replace(
  "Comptes : `admin/admin123` (direction) · `admincomm/admincomm123` · `admintech/admintech123` · `agent1..3/agent123` · `technicien1..2/tech123`.",
  "Comptes : `admin/admin123` (direction) · `admincomm/admincomm123` · `admintech/admintech123` · `agent1..3/agent123` · `technicien1..2/tech123`.\n\n> La base est **vide par défaut** : les clients, abonnements et paiements réels se saisiront depuis l'application. Pour une démo : `npm run seed -- --demo`."
);
rm = rm.replace(
  "| `npm run test:roles` |",
  "| `npm run test:audit` | Audit matriciel **159 contrôles** : 5 profils × 29 routes/options sur base vide |\n| `npm run test:e2e` | **25 scénarios métier** : prospect→client→séance→encaissement (complet 500 FC), technicien, superviseurs, direction |\n| `npm run test:roles` |"
);
rm = rm.replace(
  "| `npm run test:roles` | **33 vérifications**",
  "| `npm run test:roles` | **52 vérifications**"
);
fs.writeFileSync(rp, rm, 'utf8');
out.push('readme.md : mode vide + suites ajoutées');

// 2. roles_test : le total passé de 33 à 52 — vérifier la mention dans readme (déjà fait via replace ci-dessus si présent)
if (rm.includes('52 vérifications')) out.push('readme.md : mention 52 contrôles OK');
else out.push('⚠️ readme : mention 52 à vérifier');

// 3. server-watchdog.js : backoff plafonné + reset si run stable
const wp = path.join(__dirname, '..', 'server-watchdog.js');
let wd = fs.readFileSync(wp, 'utf8');
const newWd = wd.replace(
  "let restarts = 0;\nfunction start() {",
  "let restarts = 0;\nlet lastStart = Date.now();\nfunction start() {"
).replace(
  "  child.on('exit', (code) => {\n    restarts++;\n    console.log(`[${new Date().toLocaleTimeString('fr-FR')}] ⚠️ Serveur arrêté (code ${code}) — redémarrage automatique #${restarts} dans 3 s…`);\n    setTimeout(start, 3000);\n  });",
  "  child.on('exit', (code) => {\n    const uptime = Date.now() - lastStart;\n    if (uptime > 60000) restarts = 0; // run stable : on remet le compteur à zéro\n    restarts++;\n    const delay = Math.min(3000 * Math.pow(2, Math.min(restarts - 1, 4)), 30000); // 3s → 30s max\n    console.log(`[${new Date().toLocaleTimeString('fr-FR')}] ⚠️ Serveur arrêté (code ${code}, tournait ${Math.round(uptime / 1000)}s) — redémarrage #${restarts} dans ${Math.round(delay / 1000)} s…`);\n    setTimeout(start, delay);\n  });"
).replace(
  "  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname), stdio: 'inherit' });",
  "  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname), stdio: 'inherit' });\n  lastStart = Date.now();"
);
fs.writeFileSync(wp, newWd, 'utf8');
out.push('server-watchdog.js : backoff 3s→30s + reset si run stable > 60s');
if (newWd === wd) out.push('⚠️ watchdog : remplacements non appliqués');

// 4. apk/package.json : retirer la référence fantôme www/config.js
const ap = path.join(__dirname, '..', 'apk', 'package.json');
let apj = fs.readFileSync(ap, 'utf8');
apj = apj.replace(
  '"description": "Client Android Takata Kwetu (Capacitor) — se connecte au serveur Takata Kwetu configuré dans www/config.js"',
  '"description": "Client Android Takata Kwetu (Capacitor) — pointe vers le serveur Takata Kwetu configuré dans capacitor.config.json (server.url)"'
);
fs.writeFileSync(ap, apj, 'utf8');
out.push('apk/package.json : description corrigée');

console.log(out.join('\n'));