// tests/fix_v42d.js — check §7 cohérent + run_all sans timeout.exe
const fs = require('fs');
const path = require('path');
const out = [];
let miss = 0;

// 1. roles_test.js : check §7 basé sur la cohérence
const rp = path.join(__dirname, '..', 'tests', 'roles_test.js');
let rt = fs.readFileSync(rp, 'utf8');
const old = "check('adminGEN overview : ' + ov.customers + ' abonnés / ' + ov.installations + ' abonnements / ' + ov.totalPaid + ' FC encaissés', ov.customers >= 6 && ov.installations >= 4 && ov.totalPaid >= 77500);";
const fresh = [
  "const { data: allPays } = await api('GET', '/payments', null, admin.token);",
  "const paySum = (allPays || []).reduce((acc, p) => acc + Number(p.amount), 0);",
  "check('adminGEN overview : ' + ov.customers + ' abonnés / ' + ov.installations + ' abonnements / ' + ov.totalPaid + ' FC encaissés (cohérent avec la somme réelle ' + paySum + ')', ov.customers >= 6 && ov.installations >= 4 && Number(ov.totalPaid) === paySum);"
].join('\n');
if (rt.includes(old)) { rt = rt.replace(old, fresh); out.push('roles_test: check §7 → cohérence'); }
else { out.push('⚠️ roles_test: ancien check §7 non trouvé'); miss++; }
fs.writeFileSync(rp, rt, 'utf8');

// 2. run_all.js : sleep sans timeout.exe
const up = path.join(__dirname, '..', 'tests', 'run_all.js');
let ra = fs.readFileSync(up, 'utf8');
ra = ra.replace(
  "function restartServer() {",
  "function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }\nfunction restartServer() {"
);
ra = ra.replace(
  "require('child_process').execSync('timeout /t 1 /nobreak >nul');",
  "sleep(1000);"
);
fs.writeFileSync(up, ra, 'utf8');
out.push('run_all: sleep atomique (sans timeout.exe)');

console.log(out.join('\n'));
console.log(miss ? 'PARTIEL' : 'OK');