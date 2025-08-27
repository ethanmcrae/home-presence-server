import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { AsusWrt } from 'node-asuswrt';

// -------- Types --------
export type PresenceRow = {
  mac: string;
  label: string | null;
  display: string;
  connected: boolean;
  band: string | null;
  rssi: number | null;
  ip: string | null;
};

export type PresenceSnapshot = {
  capturedAt: string;        // ISO string
  home: PresenceRow[];       // connected == true
  away: PresenceRow[];       // connected == false
  unknownMacsNeedingLabels: string[];
};

export type PresenceOptions = {
  /**
   * If provided, use these router credentials instead of process.env.
   */
  asus?: {
    baseURL: string;
    username: string;
    password: string;
  };
  /**
   * Optional explicit people map (MAC -> label). If omitted, we’ll try src/people.json.
   */
  peopleMap?: Record<string, string>;
  /**
   * Path to a people.json file. Ignored if `peopleMap` is provided.
   * Defaults to "src/people.json".
   */
  peopleFile?: string;
  /**
   * Optional logger (defaults to no-op). Receives simple string messages.
   */
  logger?: (msg: string) => void;
};

// -------- Internals --------
const noop = () => { };
const logOf = (logger?: (msg: string) => void) => (msg: string) => (logger || noop)(msg);

const normMac = (m?: string) => (m ?? '').replace(/-/g, ':').toUpperCase();

function loadPeopleMapFromDisk(filePath = 'src/people.json', logger?: (msg: string) => void): Record<string, string> {
  const log = logOf(logger);
  try {
    const abs = path.resolve(filePath);
    const raw = fs.readFileSync(abs, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
    log(`people.json at ${abs} did not contain an object; using empty map`);
    return {};
  } catch {
    // Quietly fall back to empty (same behavior as your working script)
    return {};
  }
}

function getAsusEnv(): { baseURL: string; username: string; password: string } {
  const { ASUS_URL, ASUS_USERNAME, ASUS_PASSWORD } = process.env;
  if (!ASUS_URL || !ASUS_USERNAME || !ASUS_PASSWORD) {
    throw new Error('Missing ASUS_URL / ASUS_USERNAME / ASUS_PASSWORD in .env');
  }
  return { baseURL: ASUS_URL, username: ASUS_USERNAME, password: ASUS_PASSWORD };
}

// -------- Public API --------
/**
 * Probes the ASUS router and returns a presence snapshot.
 * Minimal logging by default; pass `logger` to see brief steps.
 */
export async function getPresenceSnapshot(opts: PresenceOptions = {}): Promise<PresenceSnapshot> {
  const log = logOf(opts.logger);

  const creds = opts.asus ?? getAsusEnv();
  const asus = new AsusWrt({
    baseURL: creds.baseURL,
    username: creds.username,
    password: creds.password,
  });

  log('presence: discovering clients…');
  await asus.discoverClients();
  await asus.updateConnectedDevices();

  let rawClients: any[] = (asus as any).allClients;
  if (!Array.isArray(rawClients)) rawClients = [];

  // GT-AXE11000 nuance: a single session object with connectedDevices[]
  let deviceList: any[] = [];
  if (rawClients.length === 1 && Array.isArray((rawClients[0] as any).connectedDevices)) {
    deviceList = rawClients[0].connectedDevices;
    log(`presence: flattened from session.connectedDevices (${deviceList.length})`);
  } else {
    deviceList = rawClients;
    log(`presence: using allClients array shape (${deviceList.length})`);
  }

  const peopleMap =
    opts.peopleMap ??
    loadPeopleMapFromDisk(opts.peopleFile ?? 'src/people.json', opts.logger);

  const present: PresenceRow[] = deviceList
    .map((d) => {
      const mac = normMac(d?.mac);
      const connected =
        typeof d?.online === 'boolean'
          ? d.online
          : Boolean(d?.connected) || Boolean(d?.isOnline);

      const band = d?.connectionMethod ?? d?.band ?? d?.radio ?? null;

      return {
        mac,
        label: mac ? peopleMap[mac] ?? null : null,
        display: (mac && peopleMap[mac]) || d?.nickName || d?.name || mac || 'unknown',
        connected,
        band,
        rssi: d?.rssi ?? null,
        ip: d?.ip ?? d?.ipAddress ?? null,
      } as PresenceRow;
    })
    .filter((x) => x.mac);

  const snapshot: PresenceSnapshot = {
    capturedAt: new Date().toISOString(),
    home: present.filter((p) => p.connected),
    away: present.filter((p) => !p.connected),
    unknownMacsNeedingLabels: present.filter((p) => !p.label).map((p) => p.mac),
  };

  return snapshot;
}

// -------- CLI mode (drop-in behavior) --------
async function runCli() {
  try {
    const snapshot = await getPresenceSnapshot({
      logger: (msg) => console.log(new Date().toISOString(), '-', msg),
    });
    console.log(JSON.stringify(snapshot, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

// Detect ESM "run directly"
const isDirectRun = (() => {
  try {
    const thisFile = pathToFileURL(process.argv[1]).href;
    return import.meta.url === thisFile;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  // Preserve the original script’s behavior when executed directly.
  runCli();
}
