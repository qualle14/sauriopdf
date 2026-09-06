import type { Buildable, ImageDimensions, RawElement } from "../types.ts";

// ─── Base64 encoding ────────────────────────────────────────────────────────────

/** Encode a Uint8Array to a base64 string (works in Deno, Node 16+, and browsers). */
function toBase64(data: Uint8Array): string {
  let binary = "";
  const len = data.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

// ─── Dimension sniffing ─────────────────────────────────────────────────────────

/**
 * Read pixel dimensions from PNG or JPEG byte data without fully decoding.
 * Returns `null` for unknown formats or truncated data.
 *
 * @example
 * ```ts
 * const dims = imageSize(pngBytes);
 * if (dims) console.log(dims.width, dims.height);
 * ```
 */
export function imageSize(data: Uint8Array): ImageDimensions | null {
  // PNG: signature is \x89PNG\r\n\x1a\n (8 bytes), followed by IHDR chunk.
  // IHDR layout: 4B length | 4B "IHDR" | 4B width | 4B height | ...
  if (
    data.length >= 24 &&
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
  ) {
    const w = ((data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19]) >>> 0;
    const h = ((data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23]) >>> 0;
    return { width: w, height: h };
  }

  // JPEG: starts with FF D8; scan for SOF markers.
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    let i = 2;
    while (i < data.length - 8) {
      if (data[i] !== 0xff) break;
      const marker = data[i + 1];
      // SOF0–SOF3, SOF5–SOF7, SOF9–SOF11, SOF13–SOF15 (exclude DHT=C4, JPG=C8)
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        // [FF marker][2B segment len][1B precision][2B height][2B width]
        const h = (data[i + 5] << 8) | data[i + 6];
        const w = (data[i + 7] << 8) | data[i + 8];
        return { width: w, height: h };
      }
      const segLen = (data[i + 2] << 8) | data[i + 3];
      i += 2 + segLen;
    }
  }

  // WebP: RIFF....WEBP, three sub-formats (VP8, VP8L, VP8X)
  if (
    data.length >= 30 &&
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) {
    const cc = String.fromCharCode(data[12], data[13], data[14], data[15]);
    if (cc === "VP8 ") {
      // Lossy: magic 9D 01 2A at offset 23; width/height at 26-29 (14-bit LE)
      if (data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) {
        const w = ((data[27] << 8) | data[26]) & 0x3fff;
        const h = ((data[29] << 8) | data[28]) & 0x3fff;
        return { width: w, height: h };
      }
    } else if (cc === "VP8L") {
      // Lossless: signature 0x2F at offset 20; width/height packed in next 4 bytes
      if (data[20] === 0x2f && data.length >= 25) {
        const bits = data[21] | (data[22] << 8) | (data[23] << 16) | (data[24] << 24);
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
    } else if (cc === "VP8X") {
      // Extended: canvas width-1 at bytes 24-26 (LE 24-bit), height-1 at 27-29
      const w = (data[24] | (data[25] << 8) | (data[26] << 16)) + 1;
      const h = (data[27] | (data[28] << 8) | (data[29] << 16)) + 1;
      return { width: w, height: h };
    }
  }

  return null;
}

// ─── Builder ────────────────────────────────────────────────────────────────────

export class ImageElement implements Buildable {
  private _x: number;
  private _y: number;
  private _w: number | null;
  private _h: number | null;

  constructor(
    private readonly _data: Uint8Array,
    x = 0,
    y = 0,
    width?: number,
    height?: number,
  ) {
    this._x = x;
    this._y = y;
    this._w = width ?? null;
    this._h = height ?? null;
  }

  at(x: number, y: number): this {
    this._x = x;
    this._y = y;
    return this;
  }
  width(w: number): this {
    this._w = w;
    return this;
  }
  height(h: number): this {
    this._h = h;
    return this;
  }
  size(w: number, h: number): this {
    this._w = w;
    this._h = h;
    return this;
  }

  /**
   * Scale the image to fit within `maxWidth`, preserving aspect ratio.
   * Height is computed from the image's pixel dimensions.
   * Falls back to `maxWidth × 100` if dimensions can't be determined.
   */
  fit(maxWidth: number): this {
    const dims = imageSize(this._data);
    if (dims && dims.width > 0) {
      const scale = Math.min(1, maxWidth / dims.width);
      this._w = Math.round(dims.width * scale);
      this._h = Math.round(dims.height * scale);
    } else {
      this._w = maxWidth;
    }
    return this;
  }

  build(): RawElement {
    // Detect format from magic bytes
    let format = "Png";
    if (this._data[0] === 0xff && this._data[1] === 0xd8) {
      format = "Jpeg";
    } else if (
      this._data[0] === 0x52 && this._data[1] === 0x49 &&
      this._data[2] === 0x46 && this._data[3] === 0x46 &&
      this._data.length > 11 &&
      this._data[8] === 0x57 && this._data[9] === 0x45 &&
      this._data[10] === 0x42 && this._data[11] === 0x50
    ) {
      format = "Webp";
    }

    return {
      Image: {
        data: toBase64(this._data),
        position: { x: this._x, y: this._y },
        width: this._w,
        height: this._h,
        format,
      },
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create an image element from raw bytes */
export function image(
  data: Uint8Array,
  opts?: { x?: number; y?: number; width?: number; height?: number },
): ImageElement {
  return new ImageElement(data, opts?.x ?? 0, opts?.y ?? 0, opts?.width, opts?.height);
}
