const MAC_HEX = /^[0-9a-fA-F]{12}$/;

/** Normalize things like "aa-bb.cc dd:ee ff" → "AA:BB:CC:DD:EE:FF" */
export function normalizeMac(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const hex = raw.replace(/[^0-9a-fA-F]/g, "");
  if (!MAC_HEX.test(hex)) return null;
  const upper = hex.toUpperCase();
  return upper.match(/.{1,2}/g)!.join(":");
}

export function isValidLabel(label: unknown): label is string {
  return typeof label === "string" && label.trim().length > 0 && label.length <= 200;
}
