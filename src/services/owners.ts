import { db } from "../db/sqlite";
import type { DeviceOwner, OwnerKind } from "../../types/owners";

const listStmt = db.prepare(`
  SELECT id, name, kind
  FROM device_owners
  ORDER BY CASE WHEN kind='home' THEN 0 ELSE 1 END, name
`);
const insertStmt = db.prepare(`INSERT INTO device_owners (name, kind) VALUES (?, ?)`);
const updateStmt = db.prepare(`UPDATE device_owners SET name = ?, kind = ? WHERE id = ?`);
const deleteStmt = db.prepare(`DELETE FROM device_owners WHERE id = ?`);
const clearDevicesStmt = db.prepare(`UPDATE devices SET owner_id = NULL WHERE owner_id = ?`);

export function listOwners(): DeviceOwner[] {
  return listStmt.all() as DeviceOwner[];
}

export function createOwner(name: string, kind: OwnerKind = "person"): DeviceOwner {
  const nm = name.trim();
  if (!nm) throw new Error("Name is required");
  const info = insertStmt.run(nm, kind);
  return { id: Number(info.lastInsertRowid), name: nm, kind };
}

export function updateOwner(id: number, name: string, kind: OwnerKind): DeviceOwner | null {
  const nm = name.trim();
  if (!nm) throw new Error("Name is required");
  const info = updateStmt.run(nm, kind, id);
  if (info.changes === 0) return null;
  return { id, name: nm, kind };
}

export function deleteOwner(id: number): boolean {
  if (id === 1) throw new Error("Cannot delete the Home owner");
  clearDevicesStmt.run(id);
  const info = deleteStmt.run(id);
  return info.changes > 0;
}
