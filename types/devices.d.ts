export type Device = {
  mac: string;  // normalized "AA:BB:CC:DD:EE:FF"
  label: string;
  ownerId?: number | null;
  ownerName?: string | null;
};
