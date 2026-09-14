// tests/fix_e2e_tech.js — checks stock via supervision (agent_id exposé) + 403 admincomm
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'tests', 'e2e_tech.js');
let s = fs.readFileSync(p, 'utf8');
const out = [];

const old1 = [
  "  const { data: techStock } = await api('GET', '/stock', null, tech.token);",
  "  const sacsTech = techStock.find((s) => s.product_id === sacs.id && s.agent_id === tech1.id);",
  "  const desTech = techStock.find((s) => s.product_id === desinf.id && s.agent_id === tech1.id);"
].join('\n');
const new1 = [
  "  const { data: techStock } = await api('GET', '/admin/stock', null, admintech.token);",
  "  const sacsTech = techStock.find((s) => s.product_id === sacs.id && s.agent_id === tech1.id);",
  "  const desTech = techStock.find((s) => s.product_id === desinf.id && s.agent_id === tech1.id);"
].join('\n');
if (s.includes(old1)) { s = s.replace(old1, new1); out.push('checks stock via supervision ✅'); }
else { out.push('⚠️ bloc stock non trouvé'); }

s = s.replace(
  "check('admincomm : hors périmètre technique (compilation vide)', sumComm.status === 200 && (sumComm.data.totals || {}).menages_servis === 0, JSON.stringify(sumComm.data.totals));",
  "check('admincomm : hors périmètre technique (403)', sumComm.status === 403);"
);
out.push('check admincomm → 403');

fs.writeFileSync(p, s, 'utf8');
console.log(out.join('\n'));