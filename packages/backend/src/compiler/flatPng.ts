import { unzlibSync } from "fflate";

const signature = [137, 80, 78, 71, 13, 10, 26, 10];

function paeth(left: number, up: number, diagonal: number): number {
  const estimate = left + up - diagonal;
  const a = Math.abs(estimate - left);
  const b = Math.abs(estimate - up);
  const c = Math.abs(estimate - diagonal);
  return a <= b && a <= c ? left : b <= c ? up : diagonal;
}

/** Recognize only uniform, opaque, thin native PNGs. Other assets keep their original encoding. */
export function flatDividerColor(bytes: Uint8Array): string | undefined {
  if (
    bytes.length < 45 ||
    bytes.length > 65_536 ||
    !signature.every((value, index) => bytes[index] === value)
  )
    return;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) return;
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const channels = bytes[25] === 2 ? 3 : bytes[25] === 6 ? 4 : 0;
  if (
    !width ||
    !height ||
    Math.min(width, height) > 2 ||
    width * height > 8192 ||
    bytes[24] !== 8 ||
    !channels ||
    bytes[26] ||
    bytes[27] ||
    bytes[28]
  )
    return;

  const compressed = new Uint8Array(bytes.length);
  let size = 0;
  for (let offset = 33; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset);
    const kind = view.getUint32(offset + 4);
    if (offset + 12 + length > bytes.length) return;
    if (kind === 0x49444154) {
      compressed.set(bytes.subarray(offset + 8, offset + 8 + length), size);
      size += length;
    }
    // Transparency and explicit color profile changes are left to the image renderer.
    if ([0x74524e53, 0x69434350, 0x63494350].includes(kind)) return;
    offset += 12 + length;
  }
  const stride = width * channels;
  const raw = new Uint8Array((stride + 1) * height);
  try {
    if (
      unzlibSync(compressed.subarray(0, size), { out: raw }).length !==
      raw.length
    )
      return;
  } catch {
    return;
  }
  let previous = new Uint8Array(stride);
  const pixel = new Uint8Array(channels);
  for (let y = 0; y < height; y++) {
    const offset = y * (stride + 1);
    const mode = raw[offset];
    if (mode > 4) return;
    const current = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const up = previous[i];
      const left = current[i - channels] ?? 0;
      const corner = previous[i - channels] ?? 0;
      const predictor = [
        0,
        left,
        up,
        (left + up) >> 1,
        paeth(left, up, corner),
      ][mode];
      const value = (raw[offset + i + 1] + predictor) & 255;
      current[i] = value;
      if (y === 0 && i < channels) pixel[i] = value;
      if (value !== pixel[i % channels]) return;
    }
    previous = current;
  }
  if (channels === 4 && pixel[3] !== 255) return;
  return `#${Array.from(pixel.subarray(0, 3), (value) => value.toString(16).padStart(2, "0")).join("")}`;
}
