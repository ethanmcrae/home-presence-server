import { db } from "../db/sqlite";
import { normalizeMac } from "../utils/mac";
import type { Device } from "../../types/devices";

const upsertStmt = db.prepare(`
  INSERT INTO devices (mac, label)
  VALUES (?, ?)
  ON CONFLICT(mac) DO UPDATE SET label = excluded.label
`);
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
const deleteStmt = db.prepare(`DELETE FROM devices WHERE mac = ?`);
const setOwnerStmt = db.prepare(`UPDATE devices SET owner_id = ? WHERE mac = ?`);

export function listDevices(): Device[] {
  console.log(listStmt.all());
  return listStmt.all() as Device[];
}

export function getDevice(rawMac: string): Device | null {
  const mac = normalizeMac(rawMac);
  if (!mac) return null;
  const row = getStmt.get(mac) as Device | undefined;
  return row ?? null;
}

export function upsertDevice(rawMac: string, label: string): Device | null {
  const mac = normalizeMac(rawMac);
  if (!mac) return null;
  upsertStmt.run(mac, label.trim());
  return getStmt.get(mac) as Device;
}

export function deleteDevice(rawMac: string): boolean {
  const mac = normalizeMac(rawMac);
  if (!mac) return false;
  const info = deleteStmt.run(mac);
  return info.changes > 0;
}

export function setDeviceOwner(rawMac: string, ownerId: number | null) {
  const mac = normalizeMac(rawMac);
  if (!mac) return null;
  setOwnerStmt.run(ownerId ?? null, mac);
  return getStmt.get(mac);
}
