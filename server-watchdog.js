// server-watchdog.js — maintient le serveur Takata Kwetu en marche en permanence
// Usage : node server-watchdog.js   (ou double-clic sur start-takata.bat)
// Relance automatiquement le serveur s'il s'arrête (crash, erreur, Ctrl+C sur le fils).
const { spawn } = require('child_process');
const path = require('path');

let restarts = 0;
let lastStart = Date.now();
function start() {
  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname), stdio: 'inherit' });
  lastStart = Date.now();
  const stamp = new Date().toLocaleTimeString('fr-FR');
  console.log(`[${stamp}] 🚀 Serveur Takata Kwetu démarré sur http://localhost:8080 (pid ${child.pid})`);
  child.on('exit', (code) => {
    const uptime = Date.now() - lastStart;
    if (uptime > 60000) restarts = 0; // run stable : on remet le compteur à zéro
    restarts++;
    const delay = Math.min(3000 * Math.pow(2, Math.min(restarts - 1, 4)), 30000); // 3s → 30s max
    console.log(`[${new Date().toLocaleTimeString('fr-FR')}] ⚠️ Serveur arrêté (code ${code}, tournait ${Math.round(uptime / 1000)}s) — redémarrage #${restarts} dans ${Math.round(delay / 1000)} s…`);
    setTimeout(start, delay);
  });
}
process.on('SIGINT', () => { console.log('Watchdog arrêté (Ctrl+C).'); process.exit(0); });
start();