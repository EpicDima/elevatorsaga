import { crc32, deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { decodeRgbPng, toPalettePng } from "./palette-png.ts";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

interface PngSpec {
  readonly width: number;
  readonly height: number;
  /** Unfiltered samples, row by row. */
  readonly samples: Uint8Array;
  readonly colorType?: number;
  readonly depth?: number;
  readonly interlace?: number;
  /** Filter type per row, cycled; out-of-range values are written as given. */
  readonly filters?: readonly number[];
  /** Splits the compressed stream across IDAT chunks of this many bytes. */
  readonly idatSize?: number;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** An independent encoder that applies each row filter for real, so decoding has to undo it. */
function encodePng(spec: PngSpec): Buffer {
  const { width, height, samples, colorType = 2, depth = 8, interlace = 0, filters = [0] } = spec;
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const sample = (i: number): number => samples[i] ?? 0;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const filter = filters[y % filters.length] ?? 0;
    rows[y * (stride + 1)] = filter;
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= channels ? sample(i - channels) : 0;
      const b = y > 0 ? sample(i - stride) : 0;
      const c = x >= channels && y > 0 ? sample(i - stride - channels) : 0;
      const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter] ?? 0;
      rows[y * (stride + 1) + 1 + x] = (sample(i) - predictor) & 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = depth;
  header[9] = colorType;
  header[12] = interlace;
  const compressed = deflateSync(rows);
  const size = spec.idatSize ?? compressed.length;
  const idat: Buffer[] = [];
  for (let offset = 0; offset < compressed.length; offset += size) {
    idat.push(chunk("IDAT", compressed.subarray(offset, offset + size)));
  }
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    ...idat,
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/** Reads back an indexed PNG, checking every chunk's CRC on the way. */
function decodeIndexed(png: Buffer): {
  width: number;
  height: number;
  colorType: number;
  palette: number[];
  pixels: number[];
} {
  expect(png.subarray(0, 8).equals(SIGNATURE)).toBe(true);
  let header: Buffer = Buffer.alloc(0);
  let plte: Buffer = Buffer.alloc(0);
  const idat: Buffer[] = [];
  const types: string[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("latin1", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    expect(png.readUInt32BE(offset + 8 + length)).toBe(
      crc32(png.subarray(offset + 4, offset + 8 + length)),
    );
    types.push(type);
    if (type === "IHDR") header = data;
    if (type === "PLTE") plte = data;
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }
  expect(types).toEqual(["IHDR", "PLTE", "IDAT", "IEND"]);
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const palette: number[] = [];
  for (let i = 0; i < plte.length; i += 3) {
    palette.push(plte.readUIntBE(i, 3));
  }
  const rows = inflateSync(Buffer.concat(idat));
  const pixels: number[] = [];
  for (let y = 0; y < height; y++) {
    expect(rows[y * (width + 1)]).toBe(0);
    for (let x = 0; x < width; x++) {
      pixels.push(palette[rows[y * (width + 1) + 1 + x] ?? -1] ?? -1);
    }
  }
  return { width, height, colorType: header[9] ?? -1, palette, pixels };
}

/** A deterministic byte stream. */
function noise(length: number, seed = 1): Uint8Array {
  const bytes = new Uint8Array(length);
  let state = seed;
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    bytes[i] = state >>> 24;
  }
  return bytes;
}

/** RGB samples drawing each pixel from `colors`, in a fixed but scrambled order. */
function samplesFrom(colors: readonly number[], pixelCount: number): Uint8Array {
  const order = noise(pixelCount, 7);
  const samples = new Uint8Array(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    const color = colors[(order[i] ?? 0) % colors.length] ?? 0;
    samples.set([color >> 16, (color >> 8) & 255, color & 255], i * 3);
  }
  return samples;
}

function toColors(samples: Uint8Array, channels: number): number[] {
  const colors: number[] = [];
  for (let i = 0; i < samples.length; i += channels) {
    colors.push(((samples[i] ?? 0) << 16) | ((samples[i + 1] ?? 0) << 8) | (samples[i + 2] ?? 0));
  }
  return colors;
}

function channelError(x: number, y: number): number {
  return Math.max(
    Math.abs((x >> 16) - (y >> 16)),
    Math.abs(((x >> 8) & 255) - ((y >> 8) & 255)),
    Math.abs((x & 255) - (y & 255)),
  );
}

describe("decodeRgbPng", () => {
  it("undoes all five row filters across split IDAT chunks", () => {
    const samples = noise(9 * 10 * 3);
    const png = encodePng({
      width: 9,
      height: 10,
      samples,
      filters: [0, 1, 2, 3, 4],
      idatSize: 17,
    });

    const image = decodeRgbPng(png);

    expect([image.width, image.height]).toEqual([9, 10]);
    expect([...image.pixels]).toEqual(toColors(samples, 3));
  });

  it("reads opaque RGBA as its RGB", () => {
    const samples = noise(6 * 5 * 4, 3).map((value, i) => (i % 4 === 3 ? 255 : value));
    const png = encodePng({ width: 6, height: 5, samples, colorType: 6, filters: [4, 3, 2, 1, 0] });

    expect([...decodeRgbPng(png).pixels]).toEqual(toColors(samples, 4));
  });

  it.each([
    ["a non-PNG", Buffer.from("GIF89a"), /Not a PNG/],
    [
      "a 16-bit PNG",
      encodePng({ width: 1, height: 1, samples: new Uint8Array(3), depth: 16 }),
      /8-bit/,
    ],
    [
      "an interlaced PNG",
      encodePng({ width: 1, height: 1, samples: new Uint8Array(3), interlace: 1 }),
      /non-interlaced/,
    ],
    [
      "an indexed PNG",
      encodePng({ width: 1, height: 1, samples: new Uint8Array(3), colorType: 3 }),
      /color type 3/,
    ],
    [
      "a transparent pixel",
      encodePng({ width: 1, height: 1, samples: new Uint8Array([1, 2, 3, 254]), colorType: 6 }),
      /Transparent/,
    ],
    [
      "an unknown row filter",
      encodePng({ width: 1, height: 1, samples: new Uint8Array(3), filters: [5] }),
      /filter 5/,
    ],
  ])("refuses %s", (_name, png, message) => {
    expect(() => decodeRgbPng(png)).toThrow(message);
  });
});

describe("toPalettePng", () => {
  it("is lossless for an image of at most 256 colors", () => {
    const colors = Array.from({ length: 256 }, (_, i) => Math.imul(i, 0x10101) ^ (i << 3));
    const samples = samplesFrom(colors, 40 * 30);
    const png = encodePng({ width: 40, height: 30, samples, filters: [1, 2, 3, 4] });

    const decoded = decodeIndexed(toPalettePng(png));

    expect(decoded).toMatchObject({ width: 40, height: 30, colorType: 3 });
    expect(decoded.pixels).toEqual(toColors(samples, 3));
  });

  it("keeps common colors exact and maps the rest to a near one", () => {
    // A flat fill crossed by a smooth gradient of 1,024 shades.
    const width = 64;
    const height = 48;
    const fill = 0xf2efe9;
    const samples = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const shade = y < 16 ? [x * 4, y * 16, 128] : [0xf2, 0xef, 0xe9];
        samples.set(shade, (y * width + x) * 3);
      }
    }
    const original = toColors(samples, 3);

    const decoded = decodeIndexed(toPalettePng(encodePng({ width, height, samples })));

    expect(decoded.palette).toHaveLength(256);
    expect(decoded.palette[0]).toBe(fill);
    const errors = original.map((color, i) => channelError(color, decoded.pixels[i] ?? -1));
    expect(errors.slice(16 * width).every((error) => error === 0)).toBe(true);
    expect(Math.max(...errors)).toBeLessThanOrEqual(16);
  });

  it("gives the same bytes for RGB and opaque RGBA input", () => {
    const rgb = noise(20 * 20 * 3, 5);
    const rgba = new Uint8Array(20 * 20 * 4);
    for (let i = 0; i < 20 * 20; i++) {
      rgba.set([rgb[i * 3] ?? 0, rgb[i * 3 + 1] ?? 0, rgb[i * 3 + 2] ?? 0, 255], i * 4);
    }

    const fromRgb = toPalettePng(encodePng({ width: 20, height: 20, samples: rgb }));
    const fromRgba = toPalettePng(
      encodePng({ width: 20, height: 20, samples: rgba, colorType: 6, filters: [2] }),
    );

    expect(fromRgba.equals(fromRgb)).toBe(true);
  });
});
