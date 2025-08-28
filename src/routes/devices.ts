import { Router } from "express";
import { getDevice, listDevices, upsertDevice, deleteDevice, setDeviceOwner } from "../services/devices";
import { isValidLabel, normalizeMac } from "../utils/mac";

const router = Router();

// List all devices
router.get("/", (_req, res) => {
  res.json(listDevices());
});

// Get one
router.get("/:mac", (req, res) => {
  const mac = normalizeMac(req.params.mac);
  if (!mac) return res.status(400).json({ error: "Invalid MAC format" });
  const device = getDevice(mac);
  if (!device) return res.status(404).json({ error: "Not found" });
  res.json(device);
});

// Upsert via URL param
router.put("/:mac", (req, res) => {
  const mac = normalizeMac(req.params.mac);
  if (!mac) return res.status(400).json({ error: "Invalid MAC format" });
  const { label } = req.body ?? {};
  if (!isValidLabel(label)) return res.status(400).json({ error: "Invalid label" });
  const device = upsertDevice(mac, { label });
  res.json(device);
});

// Upsert via body
router.post("/", (req, res) => {
  const { mac: rawMac, label } = req.body ?? {};
  const mac = normalizeMac(rawMac);
  if (!mac) return res.status(400).json({ error: "Invalid MAC format" });
  if (!isValidLabel(label)) return res.status(400).json({ error: "Invalid label" });
  const device = upsertDevice(mac, { label });
  res.status(201).json(device);
});

// Delete
router.delete("/:mac", (req, res) => {
  const mac = normalizeMac(req.params.mac);
  if (!mac) return res.status(400).json({ error: "Invalid MAC format" });
  const ok = deleteDevice(mac);
  if (!ok) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

router.put("/:mac/owner", (req, res) => {
  const mac = normalizeMac(req.params.mac);
  if (!mac) return res.status(400).json({ error: "Invalid MAC format" });

  const { ownerId } = req.body ?? {};
  if (!(ownerId === null || ownerId === undefined || Number.isInteger(ownerId))) {
    return res.status(400).json({ error: "ownerId must be a number or null" });
  }

  const device = setDeviceOwner(mac, ownerId ?? null);
  if (!device) return res.status(404).json({ error: "Not found" });
  res.json(device);
});


export default router;
