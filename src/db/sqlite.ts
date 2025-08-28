import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "devices.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

// Assigning Custom Device Labels to MAC Addresses

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    mac   TEXT PRIMARY KEY,
    label TEXT NOT NULL
  );
`);

// Assigning Devices to Device Owners

db.exec(`PRAGMA foreign_keys = ON;`);

db.exec(`
  CREATE TABLE IF NOT EXISTS device_owners (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'person' CHECK(kind IN ('person','home'))
  );
  -- seed a special "Home" owner
  INSERT OR IGNORE INTO device_owners (id, name, kind) VALUES (1, 'Home', 'home');
`);

const hasOwnerCol = db.prepare(`
  SELECT 1 FROM pragma_table_info('devices') WHERE name = 'owner_id'
`).get();
if (!hasOwnerCol) {
  db.exec(`ALTER TABLE devices ADD COLUMN owner_id INTEGER;`);
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_devices_owner_id ON devices(owner_id);`);


export default db;
