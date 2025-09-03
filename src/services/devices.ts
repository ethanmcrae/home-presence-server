// src/services/devices.ts
import { db } from "../db/sqlite";
import { normalizeMac } from "../utils/mac";
import type { Device } from "../../types/devices";
import { normalizeOptionalText, normalizePresenceType } from "../utils/objects";

const listStmt = db.prepare(`
  SELECT d.mac, d.label, d.band, d.ip, d.owner_id AS ownerId, d.presence_type AS presenceType
  FROM devices d
  ORDER BY d.mac
`);

const getStmt = db.prepare(`
  SELECT d.mac, d.label, d.band, d.ip, d.owner_id AS ownerId, d.presence_type AS presenceType
  FROM devices d
  WHERE d.mac = ?
`);

const ensureRowStmt = db.prepare(`INSERT OR IGNORE INTO devices (mac) VALUES (?)`);
const updateLabelStmt = db.prepare(`UPDATE devices SET label = ? WHERE mac = ?`);
const updateBandStmt = db.prepare(`UPDATE devices SET band  = ? WHERE mac = ?`);
const updateIpStmt = db.prepare(`UPDATE devices SET ip    = ? WHERE mac = ?`);
const setOwnerStmt = db.prepare(`UPDATE devices SET owner_id = ? WHERE mac = ?`);
const updatePresenceTypeStmt = db.prepare(`UPDATE devices SET presence_type = ? WHERE mac = ?`);
const deleteStmt = db.prepare(`DELETE FROM devices WHERE mac = ?`);

const upsertTx = db.transaction((mac: string, fields: {
  label?: string | null;
  band?: string | null;
  ip?: string | null;
  ownerId?: number | null;
  presenceType?: 1 | 2 | null;
}) => {
  ensureRowStmt.run(mac);

  if (fields.label !== undefined) updateLabelStmt.run(fields.label, mac);
  if (fields.band !== undefined) updateBandStmt.run(fields.band, mac);
  if (fields.ip !== undefined) updateIpStmt.run(fields.ip, mac);
  if (fields.ownerId !== undefined) setOwnerStmt.run(fields.ownerId, mac);
  if (fields.presenceType !== undefined) updatePresenceTypeStmt.run(fields.presenceType, mac);
});

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
  args: { label?: string | null; band?: string | null; ip?: string | null; ownerId?: number | null; presenceType?: 1 | 2 | null } = {}
): Device | null {
  const mac = normalizeMac(rawMac);
  if (!mac) return null;

  const label = normalizeOptionalText(args.label);
  const band = normalizeOptionalText(args.band);
  const ip = normalizeOptionalText(args.ip);

  // Only update owner when provided AND not undefined (null is allowed to clear)
  const ownerProvided = Object.prototype.hasOwnProperty.call(args, "ownerId") && args.ownerId !== undefined;
  // const ownerId = ownerProvided ? (args.ownerId ?? null) : undefined;

  upsertTx(mac, {
    label: normalizeOptionalText(args.label),
    band: normalizeOptionalText(args.band),
    ip: normalizeOptionalText(args.ip),
    ownerId: Object.prototype.hasOwnProperty.call(args, "ownerId") ? (args.ownerId ?? null) : undefined,
    presenceType: normalizePresenceType(args.presenceType),
  });

  return getStmt.get(mac) as Device;
}

export function setDeviceOwner(rawMac: string, ownerId: number | null): Device | null {
  const mac = normalizeMac(rawMac);
  if (!mac) return null;
  upsertTx(mac, { ownerId });
  return getStmt.get(mac) as Device;
}

export function deleteDevice(rawMac: string): boolean {
  const mac = normalizeMac(rawMac);
  if (!mac) return false;
  const info = deleteStmt.run(mac);
  return info.changes > 0;
}
