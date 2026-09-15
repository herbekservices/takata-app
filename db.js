// db.js — Base de données SQLite (better-sqlite3) + schéma TAKATA
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.TAKATA_DATA_DIR ? String(process.env.TAKATA_DATA_DIR) : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = process.env.TAKATA_DB ? String(process.env.TAKATA_DB) : path.join(DATA_DIR, 'takata.db');

// Restauration de la base gérée par start.js (avant chargement de ce module).

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000'); // attend jusqu'à 5 s un verrou au lieu d'échouer net (seed/serveur concurrents)

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','agent','technicien','admincomm','admintech','admingen')),
  team TEXT DEFAULT '',
  region TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Kit solaire',
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 5,
  payg INTEGER NOT NULL DEFAULT 0,
  nb_installments INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS stock_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  UNIQUE(product_id, agent_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  agent_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('in','out','installation','return')),
  quantity INTEGER NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  village TEXT DEFAULT '',
  address TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'actif' CHECK (status IN ('actif','installé','en attente','inactif')),
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  village TEXT DEFAULT '',
  interest TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau','contacté','converti','perdu')),
  follow_up_date TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS installations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  agent_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  serial TEXT DEFAULT '',
  install_date TEXT NOT NULL DEFAULT (date('now','localtime')),
  status TEXT NOT NULL DEFAULT 'installé' CHECK (status IN ('planifiée','installé')),
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS installments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  installation_id INTEGER REFERENCES installations(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  agent_id INTEGER NOT NULL REFERENCES users(id),
  due_date TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
  paid_date TEXT DEFAULT '',
  payment_id INTEGER REFERENCES payments(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  agent_id INTEGER NOT NULL REFERENCES users(id),
  installation_id INTEGER REFERENCES installations(id),
  installment_id INTEGER REFERENCES installments(id),
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','mobile_money','bank','card')),
  ref TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES users(id),
  payment_id INTEGER REFERENCES payments(id),
  installation_id INTEGER REFERENCES installations(id),
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tech_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL DEFAULT (date('now','localtime')),
  menages_servis INTEGER NOT NULL DEFAULT 0,
  poubelles_evacuees INTEGER NOT NULL DEFAULT 0,
  courses_camion INTEGER NOT NULL DEFAULT 0,
  desinfections INTEGER NOT NULL DEFAULT 0,
  maisons_desinfectees INTEGER NOT NULL DEFAULT 0,
  commentaire TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tech_report_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES tech_reports(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantite_utilisee REAL NOT NULL DEFAULT 0,
  etat_de_besoin REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tournees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  technicien_id INTEGER NOT NULL REFERENCES users(id),
  assignee_par INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL DEFAULT (date('now','localtime')),
  zone TEXT DEFAULT '',
  menages_prevus INTEGER NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'assignee', /* assignee | validee */
  menages_servis INTEGER NOT NULL DEFAULT 0,
  observations TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tech_demandes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantite REAL NOT NULL DEFAULT 0,
  motif TEXT DEFAULT '',
  statut TEXT NOT NULL DEFAULT 'ouverte', /* ouverte | traitee */
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES users(id),
  op TEXT NOT NULL,
  payload TEXT NOT NULL,
  client_uuid TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','error')),
  error TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  synced_at TEXT DEFAULT ''
);
`);

// Index pour la performance des requêtes courantes
db.exec(`
CREATE INDEX IF NOT EXISTS idx_customers_agent ON customers(agent_id);
CREATE INDEX IF NOT EXISTS idx_prospects_agent ON prospects(agent_id);
CREATE INDEX IF NOT EXISTS idx_installations_agent ON installations(agent_id);
CREATE INDEX IF NOT EXISTS idx_payments_agent ON payments(agent_id);
CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status, due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
`);

// --- Migration rôles v2 (ancienne base : admin/agent seulement) ---
// Détecte l'ancien CHECK et reconstruit la table users avec les nouveaux rôles
// (agent, technicien, admincomm, admintech, admingen) en préservant les données.
// D-01 (corrigé) : la migration est désormais TRANSACTIONNELLE — un crash au
// milieu ne peut plus laisser une base corrompue (incident du 28/08/2026 :
// kill forcé pendant users_old). Reprise automatique si un résidu users_old existe.
(function migrateRoles() {
  // 0) Reprise d'une migration interrompue : remettre users_old en état cohérent
  const legacy = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='users_old'`).get();
  if (legacy) {
    const usersNow = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`).get();
    if (!usersNow) {
      // Crash entre RENAME et CREATE : on restaure, la migration repart ci-dessous.
      db.exec(`ALTER TABLE users_old RENAME TO users;`);
      console.log('♻️  users_old restauré en users (reprise après interruption).');
    } else {
      // Les deux existent : garder la table la plus complète, purger l'autre.
      const cntUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
      const cntOld = db.prepare('SELECT COUNT(*) c FROM users_old').get().c;
      if (cntOld > cntUsers) {
        db.exec(`DROP TABLE users;`);
        db.exec(`ALTER TABLE users_old RENAME TO users;`);
        console.log('♻️  users_old restauré en users (données plus complètes).');
      } else {
        db.exec(`DROP TABLE users_old;`);
        console.log('♻️  Résidu users_old purgé (migration précédente complète).');
      }
    }
  }
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
  if (!row || /technicien/.test(row.sql)) return;
  console.log('♻️  Migration : extension des rôles utilisateurs…');
  const steps = db.transaction(() => {
    db.exec(`ALTER TABLE users RENAME TO users_old;`);
    db.exec(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','agent','technicien','admincomm','admintech','admingen')),
    team TEXT DEFAULT '',
    region TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );`);
    db.exec(`INSERT INTO users (id, username, password_hash, full_name, phone, role, team, region, active, created_at)
      SELECT id, username, password_hash, full_name, phone, role, '', region, active, created_at FROM users_old;`);
    db.exec(`DROP TABLE users_old;`);
  });
  db.pragma('foreign_keys = OFF');
  try { steps(); } finally { db.pragma('foreign_keys = ON'); }
  console.log('✅ Migration des rôles effectuée.');
})();

// --- Sauvegarde quotidienne (D-07) : snapshot cohérent au démarrage, 7 jours glissants ---
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
function backupDatabase() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const file = path.join(BACKUP_DIR, `takata-${stamp}.db`);
    if (fs.existsSync(file)) return file; // déjà sauvegardé aujourd'hui
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('takata-') && f.endsWith('.db')).sort();
    while (files.length > 7) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
    console.log('💾 Sauvegarde : ' + file);
    return file;
  } catch (e) {
    console.error('[TAKATA] Sauvegarde impossible : ' + (e.message || e));
    return null;
  }
}
backupDatabase();

// Fermeture propre (checkpoint WAL) — utilisée par server.js à l'arrêt (D-07)
function closeDatabase() {
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { /* base déjà fermée */ }
  try { db.close(); } catch (e) { /* déjà fermée */ }
}

// --- Premier démarrage : base vide → comptes + formules (jamais de reset si des comptes existent) ---
(function firstBootSeed() {
  try {
    if (process.env.TAKATA_SKIP_BOOT_SEED !== '1' && db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
      console.log('[boot] base sans comptes → initialisation (seed)');
      require('child_process').execFileSync(process.execPath, ['seed.js', '--reset'], { cwd: __dirname, stdio: 'inherit', env: Object.assign({}, process.env, { TAKATA_SKIP_BOOT_SEED: '1' }) });
      console.log('[boot] comptes créés : ' + db.prepare('SELECT COUNT(*) c FROM users').get().c);
    }
  } catch (e) { console.error('[boot] seed initial impossible : ' + e.message); }
})();


// --- Journal d audit (idempotent) ---
db.exec("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (datetime('now','localtime')), user_id INTEGER, username TEXT, role TEXT, action TEXT NOT NULL, entity TEXT DEFAULT '', entity_id TEXT DEFAULT '', details TEXT DEFAULT '', ip TEXT DEFAULT ''); CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);");
// --- Double authentification TOTP (colonnes additives, sans casser l existant) ---
const _userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!_userCols.includes('totp_secret')) db.exec('ALTER TABLE users ADD COLUMN totp_secret TEXT');
if (!_userCols.includes('totp_enabled')) db.exec('ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0');
// --- Annulation d abonnement (migration additive) ---
const _insCols = db.prepare('PRAGMA table_info(installations)').all().map((c) => c.name);
if (!_insCols.includes('cancelled')) db.exec('ALTER TABLE installations ADD COLUMN cancelled INTEGER NOT NULL DEFAULT 0');
if (!_insCols.includes('cancelled_at')) db.exec('ALTER TABLE installations ADD COLUMN cancelled_at TEXT');

module.exports = db;
module.exports.closeDatabase = closeDatabase;
