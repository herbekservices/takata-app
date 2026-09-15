// lib/audit.js — Journal d'audit des actions sensibles
'use strict';
const db = require('../db');

// Enregistre une action. Ne doit JAMAIS faire échouer l'action métier.
function logAudit(req, action, entity, entityId, details) {
  try {
    const u = req && req.user ? req.user : null;
    const username = u ? u.username : (req && req.body && req.body.username ? String(req.body.username).slice(0, 60) : null);
    const role = u ? u.role : null;
    const ip = (req && (req.ip || (req.socket && req.socket.remoteAddress))) || '';
    db.prepare(
      `INSERT INTO audit_log (user_id, username, role, action, entity, entity_id, details, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(u ? u.id : null, username, role, String(action), entity || '', entityId == null ? '' : String(entityId), details ? String(details).slice(0, 500) : '', ip);
  } catch (e) {
    // le journal ne casse jamais l'application
  }
}

module.exports = { logAudit };
