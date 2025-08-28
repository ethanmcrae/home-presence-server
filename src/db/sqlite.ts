import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "devices.db");
export const db = new Database(dbPath);

// Pragmas chosen for durability with good performance.
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

// Device owners: seeded with a non-deletable "Home".
db.exec(`
  CREATE TABLE IF NOT EXISTS device_owners (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'person' CHECK(kind IN ('person','home'))
  );
  INSERT OR IGNORE INTO device_owners (id, name, kind) VALUES (1, 'Home', 'home');
`);

const devicesTable = db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='devices'`)
  .get();

if (!devicesTable) {
  // Fresh schema: nullable label, owner FK with ON DELETE SET NULL.
  db.exec(`
    CREATE TABLE devices (
      mac      TEXT PRIMARY KEY,
      label    TEXT,
      owner_id INTEGER REFERENCES device_owners(id) ON DELETE SET NULL
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_devices_owner_id ON devices(owner_id);`);
} else {
  // Existing schema: inspect and migrate if needed.
  type Col = { name: string; notnull: number };
  const cols = db.prepare(`PRAGMA table_info('devices')`).all() as Col[];
  const hasOwnerId = cols.some(c => c.name === "owner_id");
  const labelCol = cols.find(c => c.name === "label");
  const labelIsNotNull = labelCol?.notnull === 1;

  const fks = db.prepare(`PRAGMA foreign_key_list('devices')`).all() as Array<{ table: string; from: string }>;
  const hasOwnerFk = fks.some(fk => fk.table === "device_owners" && fk.from === "owner_id");

  const requiresMigration = labelIsNotNull || !hasOwnerId || !hasOwnerFk;

  if (requiresMigration) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`
        CREATE TABLE devices__new (
          mac      TEXT PRIMARY KEY,
          label    TEXT,
          owner_id INTEGER REFERENCES device_owners(id) ON DELETE SET NULL
        );
      `);

      if (hasOwnerId) {
        db.exec(`
          INSERT INTO devices__new (mac, label, owner_id)
          SELECT mac, NULLIF(label, ''), owner_id
          FROM devices;
        `);
      } else {
        db.exec(`
          INSERT INTO devices__new (mac, label, owner_id)
          SELECT mac, NULLIF(label, ''), NULL
          FROM devices;
        `);
      }

      db.exec(`DROP TABLE devices;`);
      db.exec(`ALTER TABLE devices__new RENAME TO devices;`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_devices_owner_id ON devices(owner_id);`);

      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  } else {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_devices_owner_id ON devices(owner_id);`);
  }
}

export default db;
