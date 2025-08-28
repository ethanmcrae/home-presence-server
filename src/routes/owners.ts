import { Router } from "express";
import { createOwner, deleteOwner, listOwners, updateOwner } from "../services/owners";

const router = Router();

router.get("/", (_req, res) => res.json(listOwners()));

router.post("/", (req, res) => {
  try {
    const { name, kind = "person" } = req.body ?? {};
    const owner = createOwner(String(name), kind === "home" ? "home" : "person");
    res.status(201).json(owner);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to create owner" });
  }
});

router.put("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, kind = "person" } = req.body ?? {};
    const updated = updateOwner(id, String(name), kind === "home" ? "home" : "person");
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to update owner" });
  }
});

router.delete("/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    const ok = deleteOwner(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to delete owner" });
  }
});

export default router;
