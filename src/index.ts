import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getPresenceSnapshot } from "./presence";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());

// Simple healthcheck
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Presence endpoint
app.get("/api/presence", async (_req, res) => {
  try {
    const snapshot = await getPresenceSnapshot();
    res.json(snapshot);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to get snapshot" });
  }
});

app.listen(port, () => {
  console.log(`home-presence-server listening on http://localhost:${port}`);
});
