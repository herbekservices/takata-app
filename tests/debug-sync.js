const db = require('../db');
console.log('cols:', db.prepare('PRAGMA table_info(sync_queue)').all().map(c => c.name).join(','));
console.log('indexes:', JSON.stringify(db.prepare('PRAGMA index_list(sync_queue)').all()));
const r1 = db.prepare("INSERT OR IGNORE INTO sync_queue (agent_id,op,payload,client_uuid,created_at) VALUES (1,'x','{}','dup-1','now')").run();
const r2 = db.prepare("INSERT OR IGNORE INTO sync_queue (agent_id,op,payload,client_uuid,created_at) VALUES (1,'x','{}','dup-1','now')").run();
console.log('r1.changes', r1.changes, 'r2.changes', r2.changes);
console.log('count dup-1:', db.prepare("SELECT COUNT(*) c FROM sync_queue WHERE client_uuid='dup-1'").get().c);
db.prepare("DELETE FROM sync_queue WHERE client_uuid='dup-1'").run();