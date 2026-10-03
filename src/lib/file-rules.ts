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

/** A dropped document: a PDF or photo by its bytes, or a Word or Excel file (kept to download). */
export function detectDropFile(b: Uint8Array, name: string): { type: string; ext: string; image: boolean } | null {
  const k = detectFile(b);
  if (k) return k;
  const ext = (name.toLowerCase().match(/\.(docx|xlsx|doc|xls)$/) ?? [])[1];
  const zip = b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  const ole = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
  if (ext === 'docx' && zip) return { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext, image: false };
  if (ext === 'xlsx' && zip) return { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext, image: false };
  if (ext === 'doc' && ole) return { type: 'application/msword', ext, image: false };
  if (ext === 'xls' && ole) return { type: 'application/vnd.ms-excel', ext, image: false };
  return null;
}
