// dates.js — Utilitaires de dates Takata Kwetu
// Corrige D-03 : débordement setMonth (31 janv. + 1 mois → 3 mars) et dates UTC décalées (toISOString).
'use strict';

// Date locale au format AAAA-MM-JJ (jamais UTC : évite la date J-1 entre 00h et 02h en RDC, UTC+2)
function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Ajoute k mois en bornant le jour au dernier jour du mois cible
// (31 janv. + 1 mois → 28/29 févr., pas 2/3 mars)
function addMonthsClamped(base, k) {
  const target = new Date(base.getFullYear(), base.getMonth() + k, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(base.getDate(), lastDay));
  return target;
}

// Échéancier de n redevances : la 1re échéance (acompte) est due aujourd'hui,
// les suivantes sont décalées d'un mois en bornant le jour.
function buildScheduleDates(n, base = new Date()) {
  const dates = [localDateStr(base)];
  for (let k = 1; k < n; k++) dates.push(localDateStr(addMonthsClamped(base, k)));
  return dates;
}

module.exports = { localDateStr, addMonthsClamped, buildScheduleDates };
