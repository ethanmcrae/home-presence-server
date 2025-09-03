export function normalizeOptionalText(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined; // don't change
  if (v === null) return null;           // clear
  const t = v.trim();
  return t === "" ? null : t;            // empty string → NULL
}

export function normalizePresenceType(v: unknown): 1 | 2 | null | undefined {
  if (v === undefined) return undefined;       // no change
  if (v === null || v === "") return null;     // clear
  const n = Number(v);
  return n === 1 || n === 2 ? (n as 1 | 2) : null; // coerce invalid → null (or throw if you prefer)
}
