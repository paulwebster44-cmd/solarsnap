/**
 * Minimal PNG decoder for binary segmentation masks.
 *
 * The Hugging Face Inference API returns segmentation masks as base64-encoded
 * PNG images where the class pixels are white (255) and the rest are black (0).
 * This decoder handles all five PNG filter types and supports grayscale, RGB,
 * and RGBA colour modes — covering every format HF models may return.
 *
 * Uses pako (pure-JS DEFLATE) for decompression — no native modules required.
 */

import { inflate } from 'pako';
import { Buffer } from 'buffer';

export interface DecodedMask {
  width: number;
  height: number;
  /**
   * Flat array of pixel values, one byte per pixel (first channel only).
   * For binary masks: 255 = this class present, 0 = absent.
   */
  pixels: Uint8Array;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function readUint32BE(buf: Uint8Array, offset: number): number {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

/**
 * Paeth predictor — used for PNG filter type 4.
 * Defined in the PNG specification (RFC 2083).
 */
function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decodes a base64-encoded PNG mask returned by the HF Inference API.
 * Returns a flat Uint8Array of pixel values (first channel per pixel).
 */
export function decodePNGMask(base64Data: string): DecodedMask {
  // ── 1. Base64 → bytes ─────────────────────────────────────────────────────
  const bytes = new Uint8Array(Buffer.from(base64Data, 'base64'));

  // ── 2. Validate PNG signature ─────────────────────────────────────────────
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Not a valid PNG file');
    }
  }

  // ── 3. Parse PNG chunks ───────────────────────────────────────────────────
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0; // 0=grayscale, 2=RGB, 6=RGBA
  const idatParts: Uint8Array[] = [];

  while (offset + 8 <= bytes.length) {
    const chunkLen = readUint32BE(bytes, offset);
    const chunkType = String.fromCharCode(
      bytes[offset + 4], bytes[offset + 5],
      bytes[offset + 6], bytes[offset + 7],
    );
    const chunkData = bytes.subarray(offset + 8, offset + 8 + chunkLen);

    if (chunkType === 'IHDR') {
      width = readUint32BE(chunkData, 0);
      height = readUint32BE(chunkData, 4);
      // bitDepth = chunkData[8];  // assumed 8-bit
      colorType = chunkData[9];
    } else if (chunkType === 'IDAT') {
      idatParts.push(new Uint8Array(chunkData));
    } else if (chunkType === 'IEND') {
      break;
    }

    offset += 12 + chunkLen; // 4 (length) + 4 (type) + data + 4 (CRC)
  }

  // ── 4. Decompress all IDAT chunks ─────────────────────────────────────────
  const totalLen = idatParts.reduce((s, p) => s + p.length, 0);
  const combined = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of idatParts) { combined.set(part, pos); pos += part.length; }

  const raw = inflate(combined);

  // ── 5. Reconstruct filtered rows into pixel data ──────────────────────────
  // Bytes per pixel: grayscale=1, RGB=3, RGBA=4
  const bpp = colorType === 0 ? 1 : colorType === 2 ? 3 : 4;
  const stride = 1 + width * bpp; // filter byte + pixel data per row

  const pixels = new Uint8Array(width * height);
  const prevRow = new Uint8Array(width * bpp); // previous reconstructed row (zeros initially)
  const currRow = new Uint8Array(width * bpp);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * stride];
    const rowOffset = y * stride + 1;

    for (let x = 0; x < width * bpp; x++) {
      const filt = raw[rowOffset + x];
      const a = x >= bpp ? currRow[x - bpp] : 0;  // pixel to the left
      const b = prevRow[x];                          // pixel directly above
      const c = x >= bpp ? prevRow[x - bpp] : 0;   // pixel above-left

      switch (filterType) {
        case 0: currRow[x] = filt; break;                                      // None
        case 1: currRow[x] = (filt + a) & 0xff; break;                        // Sub
        case 2: currRow[x] = (filt + b) & 0xff; break;                        // Up
        case 3: currRow[x] = (filt + Math.floor((a + b) / 2)) & 0xff; break;  // Average
        case 4: currRow[x] = (filt + paethPredictor(a, b, c)) & 0xff; break;  // Paeth
        default: currRow[x] = filt;
      }
    }

    // Store the first channel value for each pixel
    for (let x = 0; x < width; x++) {
      pixels[y * width + x] = currRow[x * bpp];
    }

    prevRow.set(currRow);
  }

  return { width, height, pixels };
}

/**
 * Counts how many pixels in a decoded mask are "active" (value > 128).
 * Optionally applies a centre-Gaussian weight so pixels near the image centre
 * count more than those at the edges — approximating the relevant sky arc
 * directly in front of the panel.
 *
 * @param mask          - Decoded mask from decodePNGMask()
 * @param useCentreWeight - If true, apply Gaussian centre-weighting
 */
export function countMaskPixels(
  mask: DecodedMask,
  useCentreWeight = true,
): { weightedActive: number; weightedTotal: number } {
  const { width, height, pixels } = mask;
  const cx = width / 2;
  const cy = height / 2;
  // Standard deviation: quarter of the shorter dimension
  const sigma = Math.min(width, height) / 4;
  const twoSigmaSq = 2 * sigma * sigma;

  let weightedActive = 0;
  let weightedTotal = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const weight = useCentreWeight
        ? Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / twoSigmaSq)
        : 1;

      weightedTotal += weight;
      if (pixels[y * width + x] > 128) {
        weightedActive += weight;
      }
    }
  }

  return { weightedActive, weightedTotal };
}
