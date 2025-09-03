export type PresenceType = 1 | 2; // 1=primary, 2=secondary

export type Device = {
  mac: string;  // normalized "AA:BB:CC:DD:EE:FF"
  label?: string | null;
  ownerId?: number | null;
  ownerName?: string | null;
  presenceType?: PresenceType | null;
};
