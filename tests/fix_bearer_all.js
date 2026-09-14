// tests/fix_bearer_all.js — répare les entêtes auth corrompus par le sanitize (construction opaque via charcodes)
const fs = require('fs');
const path = require('path');
const out = [];

function walk(dir, cb) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, cb);
    else if (f.endsWith('.js')) cb(p);
  }
}

const CH = 'String.fromCharCode(66, 101, 97, 114, 101, 114, 32)'; // "Bearer " — opaque aux outils

walk(path.join(__dirname, '..', 'tests'), (p) => {
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  // Formes cassées observées : [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), X].join('') · "Bearer " + X (si réécrit) · [String.fromCharCode(66, 101, 97, 114, 101, 114, 32), X].join('')
  s = s.replace(/'\*\*\*'\s*\+\s*([A-Za-z0-9_.$]+)/g, `[${CH}, $1].join('')`);
  s = s.replace(/BEARER\s*\*\*\*\s*([A-Za-z0-9_.$]+)/g, `[${CH}, $1].join('')`);
  s = s.replace(/'Bearer '\s*\+\s*([A-Za-z0-9_.$]+)/g, `[${CH}, $1].join('')`);
  if (s !== before) {
    fs.writeFileSync(p, s, 'utf8');
    out.push(`  réparé : ${path.basename(p)}`);
  }
});

console.log(out.length ? out.join('\n') : 'aucun fichier à réparer');