// Which files we take, known by their bytes (not the name). Pure, tested.
export const MAX_FILE = 4 * 1024 * 1024;

export function detectFile(b: Uint8Array): { type: string; ext: string; image: boolean } | null {
  const starts = (...xs: number[]) => xs.every((x, i) => b[i] === x);
  if (starts(0x25, 0x50, 0x44, 0x46)) return { type: 'application/pdf', ext: 'pdf', image: false };
  if (starts(0xff, 0xd8, 0xff)) return { type: 'image/jpeg', ext: 'jpg', image: true };
  if (starts(0x89, 0x50, 0x4e, 0x47)) return { type: 'image/png', ext: 'png', image: true };
  if (starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { type: 'image/webp', ext: 'webp', image: true };
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && [0x68, 0x6d].includes(b[8])) return { type: 'image/heic', ext: 'heic', image: true };
  return null;
}
