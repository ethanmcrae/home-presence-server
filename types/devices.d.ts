export type Device = {
  mac: string;  // normalized "AA:BB:CC:DD:EE:FF"
  label?: string | null;
  ownerId?: number | null;
  ownerName?: string | null;
};
