/** UUID v4 from Web Crypto; Node 18 without global crypto falls back to Math.random (identifiers only, never secrets). */
export function randomUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = (Math.random() * 256) | 0;
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // UUID v4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
