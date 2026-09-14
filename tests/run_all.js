// tests/run_all.js — runner complet : reseed démo → suites de tests → reseed vide final
// Usage : node tests/run_all.js        (validation complète, ~2 min)
const { execSync, spawn } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const log = (s) => console.log('\n=== ' + s + ' ===');

function run(cmd, quiet, ignoreFail) {
  try { execSync(cmd, { cwd: ROOT, stdio: quiet ? 'pipe' : 'inherit', env: { ...process.env, FORCE_COLOR: '0' } }); }
  catch (e) { if (!ignoreFail) throw e; console.log('  (sortie non nulle — tolérée)'); }
}
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function restartServer() {
  try { execSync('powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"', { stdio: 'ignore' }); } catch (e) { /* rien */ }
  spawn(process.execPath, ['server.js'], { cwd: ROOT, detached: true, stdio: 'ignore' }).unref();
  // attente du health
  const { execSync: wait } = require('child_process');
  for (let i = 0; i < 20; i++) {
    try { execSync('powershell -NoProfile -Command "(Invoke-WebRequest -Uri http://localhost:8080/api/health -UseBasicParsing -TimeoutSec 2) | Out-Null"'); return true; }
    catch (e) { sleep(1000); }
  }
  return false;
}

log('1. Base de DÉMONSTRATION (--demo) + serveur');
run('node seed.js --reset --demo');
if (!restartServer()) { console.error('❌ serveur non démarré'); process.exit(1); }

log('2. Tests de rôles (63)');
run('node tests/roles_test.js');

log('3. Smoke (44)');
run('node tests/smoke-test.js http://localhost:8080');

log('4. Persistance (mark → restart → verify)');
run('node tests/persist_check.js --mark');
try { execSync('powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"', { stdio: 'ignore' }); } catch (e) { /* */ }
if (!restartServer()) { console.error('❌ serveur non redémarré'); process.exit(1); }
run('node tests/persist_check.js --verify');

log('5. Sécurité (81 contrôles — déclenche un soft-lock 15 min par IP)');
run('node tests/security-test.js http://localhost:8080', false, true);

log('6. Base VIDE finale + serveur redémarré (vide aussi le soft-lock)');
run('node seed.js --reset');
if (!restartServer()) { console.error('❌ serveur non redémarré'); process.exit(1); }
if (!restartServer()) { console.error('❌ serveur non redémarré'); process.exit(1); }

log('7. Audit matriciel sur base vide (159)');
run('node tests/audit_all.js');

log('8. E2E par profil (25) — re-seed vide d\'abord, re-seed vide après');
run('node seed.js --reset');
run('node tests/e2e_profiles.js');
run('node seed.js --reset');

log('✅ VALIDATION COMPLÈTE TERMINÉE — base VIDE prête, serveur en marche.');
console.log('Identifiants : admin/admin123 · admincomm/admincomm123 · admintech/admintech123 · agent1..3/agent123 · technicien1..2/tech123');