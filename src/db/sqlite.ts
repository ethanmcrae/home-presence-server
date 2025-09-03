import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "devices.db");
export const db = new Database(dbPath);

// Pragmas selected for durability with good performance.
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

// Device owners (seed a default "Home").
db.exec(`
  CREATE TABLE IF NOT EXISTS device_owners (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'person' CHECK(kind IN ('person','home'))
  );
  INSERT OR IGNORE INTO device_owners (id, name, kind) VALUES (1, 'Home', 'home');
`);

const hasDevicesTable = db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='devices'`)
  .get();

if (!hasDevicesTable) {
  // Fresh schema: nullable label, band, ip; owner_id with FK (SET NULL).
  db.exec(`
    CREATE TABLE devices (
      mac      TEXT PRIMARY KEY,
      label    TEXT,
      band     TEXT,
      ip       TEXT,
      owner_id INTEGER REFERENCES device_owners(id) ON DELETE SET NULL,
      presence_type INTEGER CHECK (presence_type IN (1,2))  -- NEW, nullable
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_devices_owner_id ON devices(owner_id);`);
} else {
  // Existing schema: inspect and migrate if required.
  type Col = { name: string; notnull: number };
  const cols = db.prepare(`PRAGMA table_info('devices')`).all() as Col[];

  const hasLabel = cols.some(c => c.name === "label");
  const hasBand = cols.some(c => c.name === "band");
  const hasIp = cols.some(c => c.name === "ip");
  const hasOwnerId = cols.some(c => c.name === "owner_id");
  const hasPresenceType = cols.some(c => c.name === "presence_type");

  const labelCol = cols.find(c => c.name === "label");
  const labelIsNotNull = labelCol?.notnull === 1;

  const fks = db.prepare(`PRAGMA foreign_key_list('devices')`).all() as Array<{ table: string; from: string }>;
  const hasOwnerFk = fks.some(fk => fk.table === "device_owners" && fk.from === "owner_id");

  // Rebuild when constraints/FKs need changing; otherwise add missing columns in place.
  const requiresRebuild = labelIsNotNull || !hasOwnerId || !hasOwnerFk || !hasPresenceType;

  if (requiresRebuild) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`
        CREATE TABLE devices__new (
          mac      TEXT PRIMARY KEY,
          label    TEXT,
          band     TEXT,
          ip       TEXT,
          owner_id INTEGER REFERENCES device_owners(id) ON DELETE SET NULL,
          presence_type INTEGER CHECK (presence_type IN (1,2))
        );
      `);

      // Build a SELECT that preserves any existing columns, supplies NULLs for new ones,
      // and normalizes empty-string labels to NULL.
      const selectParts: string[] = [
        "mac",
        hasLabel ? "NULLIF(label, '') AS label" : "NULL AS label",
        hasBand ? "band" : "NULL AS band",
        hasIp ? "ip" : "NULL AS ip",
        hasOwnerId ? "owner_id" : "NULL AS owner_id",
        hasPresenceType ? "presence_type" : "NULL AS presence_type",
      ];

      db.exec(`
        INSERT INTO devices__new (mac, label, band, ip, owner_id, presence_type)
        SELECT ${selectParts.join(", ")}
        FROM devices;
      `);

      db.exec(`DROP TABLE devices;`);
      db.exec(`ALTER TABLE devices__new RENAME TO devices;`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_devices_owner_id ON devices(owner_id);`);

      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  } else {
    // In-place additive changes.
    if (!hasLabel) db.exec(`ALTER TABLE devices ADD COLUMN label TEXT;`);
    if (!hasBand) db.exec(`ALTER TABLE devices ADD COLUMN band TEXT;`);
    if (!hasIp) db.exec(`ALTER TABLE devices ADD COLUMN ip TEXT;`);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_devices_owner_id ON devices(owner_id);`);
  }
}

export default db;
