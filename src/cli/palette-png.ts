/** Re-encodes an opaque 8-bit PNG with a 256-color palette: how `npm run screenshot` stores its capture. */

import { crc32, deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_COLORS = 256;
const COLOR_TYPE_RGB = 2;
const COLOR_TYPE_INDEXED = 3;
const COLOR_TYPE_RGBA = 6;

/** An opaque image as one `0xRRGGBB` per pixel, row by row. */
interface RgbImage {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint32Array;
}

/** Reads an element known to exist, without a non-null assertion. */
function at(array: ArrayLike<number>, index: number): number {
  const value = array[index];
  if (value === undefined) {
    throw new RangeError(`Index ${String(index)} out of bounds`);
  }
  return value;
}

/** The predictor PNG filter type 4 adds back: whichever neighbor is closest to `a + b - c`. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  return pb <= pc ? b : c;
}

/** What a row filter adds back to a byte, given its left (`a`), upper (`b`) and upper-left (`c`) neighbors. */
function predict(filter: number, a: number, b: number, c: number): number {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return a;
    case 2:
      return b;
    case 3:
      return (a + b) >> 1;
    case 4:
      return paeth(a, b, c);
    default:
      throw new Error(`Unknown PNG filter ${String(filter)}`);
  }
}

/** Decodes a non-interlaced, 8-bit, RGB or fully opaque RGBA PNG; anything else throws. */
export function decodeRgbPng(png: Uint8Array): RgbImage {
  const bytes = Buffer.from(png.buffer, png.byteOffset, png.byteLength);
  if (!bytes.subarray(0, SIGNATURE.length).equals(SIGNATURE)) {
    throw new Error("Not a PNG");
  }
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  for (let offset = SIGNATURE.length; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      const [depth, colorType, , , interlace] = data.subarray(8, 13);
      if (depth !== 8 || interlace !== 0) {
        throw new Error("Only non-interlaced 8-bit PNGs are supported");
      }
      if (colorType === COLOR_TYPE_RGB) {
        channels = 3;
      } else if (colorType === COLOR_TYPE_RGBA) {
        channels = 4;
      } else {
        throw new Error(`Unsupported PNG color type ${String(colorType)}`);
      }
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") {
      idat.push(data);
    }
    offset += 12 + length;
  }

  const filtered = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = at(filtered, y * (stride + 1));
    const source = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? at(raw, row + x - channels) : 0;
      const b = y > 0 ? at(raw, row - stride + x) : 0;
      const c = x >= channels && y > 0 ? at(raw, row - stride + x - channels) : 0;
      raw[row + x] = at(filtered, source + x) + predict(filter, a, b, c);
    }
  }

  const pixels = new Uint32Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    const p = i * channels;
    if (channels === 4 && at(raw, p + 3) !== 255) {
      throw new Error("Transparent pixels are not supported");
    }
    pixels[i] = (at(raw, p) << 16) | (at(raw, p + 1) << 8) | at(raw, p + 2);
  }
  return { width, height, pixels };
}

/** Squared RGB distance between two `0xRRGGBB` colors. */
function distance2(x: number, y: number): number {
  const r = (x >> 16) - (y >> 16);
  const g = ((x >> 8) & 255) - ((y >> 8) & 255);
  const b = (x & 255) - (y & 255);
  return r * r + g * g + b * b;
}

/**
 * Picks up to 256 of the image's own colors, each the one worst served so far: squared
 * distance to its nearest pick times the square root of its pixel count.
 */
function choosePalette(pixels: Uint32Array): { palette: number[]; indexOf: Map<number, number> } {
  const counts = new Map<number, number>();
  for (const color of pixels) {
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  const ranked = [...counts].sort(([a, m], [b, n]) => n - m || a - b);
  const colors = ranked.map(([color]) => color);
  const weight = ranked.map(([, count]) => Math.sqrt(count));
  const nearest = new Float64Array(colors.length).fill(Infinity);
  const owner = new Uint8Array(colors.length);
  const palette: number[] = [];
  while (palette.length < Math.min(MAX_COLORS, colors.length)) {
    let pick = 0;
    let worst = -1;
    for (let i = 0; i < colors.length; i++) {
      const score = at(weight, i) * at(nearest, i);
      if (score > worst) {
        worst = score;
        pick = i;
      }
    }
    const picked = at(colors, pick);
    for (let i = 0; i < colors.length; i++) {
      const d = distance2(at(colors, i), picked);
      if (d < at(nearest, i)) {
        nearest[i] = d;
        owner[i] = palette.length;
      }
    }
    palette.push(picked);
  }
  const indexOf = new Map(colors.map((color, i) => [color, at(owner, i)]));
  return { palette, indexOf };
}

/** One PNG chunk: length, type, data and the CRC over type and data. */
function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/**
 * Rewrites `png` with a palette of at most 256 colors, lossless when it already has that few.
 * Rows go unfiltered, which deflates palette indices best.
 */
export function toPalettePng(png: Uint8Array): Buffer {
  const { width, height, pixels } = decodeRgbPng(png);
  const { palette, indexOf } = choosePalette(pixels);

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = COLOR_TYPE_INDEXED;

  const plte = Buffer.alloc(palette.length * 3);
  palette.forEach((color, i) => {
    plte.writeUIntBE(color, i * 3, 3);
  });

  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      rows[y * (width + 1) + 1 + x] = indexOf.get(at(pixels, y * width + x)) ?? 0;
    }
  }

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("PLTE", plte),
    chunk("IDAT", deflateSync(rows, { level: 9, memLevel: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}
