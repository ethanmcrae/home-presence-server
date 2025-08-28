import { db } from "../db/sqlite";
import { normalizeMac } from "../utils/mac";
import type { Device } from "../../types/devices";

const listStmt = db.prepare(`
  SELECT d.mac, d.label, d.owner_id AS ownerId, o.name AS ownerName
  FROM devices d
  LEFT JOIN device_owners o ON o.id = d.owner_id
  ORDER BY d.mac
`);
const getStmt = db.prepare(`
  SELECT d.mac, d.label, d.owner_id AS ownerId, o.name AS ownerName
  FROM devices d
  LEFT JOIN device_owners o ON o.id = d.owner_id
  WHERE d.mac = ?
`);
// Upserts
const upsertOwnerOnlyStmt = db.prepare(`
  INSERT INTO devices (mac, owner_id)
  VALUES (?, ?)
  ON CONFLICT(mac) DO UPDATE SET owner_id = excluded.owner_id
`);
const upsertLabelOnlyStmt = db.prepare(`
  INSERT INTO devices (mac, label)
  VALUES (?, ?)
  ON CONFLICT(mac) DO UPDATE SET label = excluded.label
`);
const upsertBothStmt = db.prepare(`
  INSERT INTO devices (mac, label, owner_id)
  VALUES (?, ?, ?)
  ON CONFLICT(mac) DO UPDATE SET
    label = excluded.label,
    owner_id = excluded.owner_id
`);
const deleteStmt = db.prepare(`DELETE FROM devices WHERE mac = ?`);
const setOwnerStmt = db.prepare(`UPDATE devices SET owner_id = ? WHERE mac = ?`);
const ensureRowStmt = db.prepare(`INSERT OR IGNORE INTO devices (mac) VALUES (?)`);

export function listDevices(): Device[] {
  return listStmt.all() as Device[];
}

export function getDevice(rawMac: string): Device | null {
  const mac = normalizeMac(rawMac);
  if (!mac) return null;
  const row = getStmt.get(mac) as Device | undefined;
  return row ?? null;
}

export function upsertDevice(
  rawMac: string,
  args: { label?: string | null; ownerId?: number | null } = {}
): Device | null {
  const mac = normalizeMac(rawMac);
  if (!mac) return null;

  const hasLabel = Object.prototype.hasOwnProperty.call(args, "label");
  const hasOwner = Object.prototype.hasOwnProperty.call(args, "ownerId");

  const label = hasLabel ? (args.label?.trim() || null) : undefined;
  const ownerId = hasOwner ? (args.ownerId ?? null) : undefined;

  if (hasLabel && hasOwner) {
    upsertBothStmt.run(mac, label, ownerId);
  } else if (hasLabel) {
    upsertLabelOnlyStmt.run(mac, label);
  } else if (hasOwner) {
    upsertOwnerOnlyStmt.run(mac, ownerId);
  } else {
    ensureRowStmt.run(mac);
  }

  return getStmt.get(mac) as Device;
}

export function deleteDevice(rawMac: string): boolean {
  const mac = normalizeMac(rawMac);
  if (!mac) return false;
  const info = deleteStmt.run(mac);
  return info.changes > 0;
}

export function setDeviceOwner(rawMac: string, ownerId: number | null): Device | null {
  const mac = normalizeMac(rawMac);
  if (!mac) return null;
  upsertOwnerOnlyStmt.run(mac, ownerId);
  return getStmt.get(mac) as Device;
}
