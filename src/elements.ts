/**
 * PDF element builders.
 *
 * Each class is a fluent builder that produces a RawElement (the JSON
 * structure Krilla/Rust expects). Factory functions provide the ergonomic
 * entry points.
 *
 * Rule: builders are immutable-ish — every method mutates `this` and returns
 * `this` for chaining. Call `.build()` to get the raw JSON, or pass the
 * builder directly to `pdf.add()` which calls `.build()` automatically.
 */

import { parseColor } from "./colors.ts";
import { alignmentOffset, estimateLineWidth, wrapLines } from "./layout.ts";
import type {
  Align,
  Buildable,
  ColorInput,
  ImageDimensions,
  RawElement,
  RGBA,
} from "./types.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Encode a Uint8Array to a base64 string (works in Deno, Node 16+, and browsers). */
function toBase64(data: Uint8Array): string {
  let binary = "";
  const len = data.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

// ─── Image dimension parser ───────────────────────────────────────────────────

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

// ─── Text ─────────────────────────────────────────────────────────────────────

export class TextElement implements Buildable {
  private _x: number;
  private _y: number;
  private _size: number;
  private _color: RGBA = { r: 0, g: 0, b: 0, a: 1 };
  private _bold = false;
  private _italic = false;
  private _font = "Liberation Sans";
  private _align: Align = "Left";
  private _maxWidth: number | null = null;
  private _underline = false;
  private _strikethrough = false;

  constructor(readonly content: string, x = 0, y = 0, size = 12) {
    this._x = x;
    this._y = y;
    this._size = size;
  }

  at(x: number, y: number): this {
    this._x = x;
    this._y = y;
    return this;
  }
  size(s: number): this {
    this._size = s;
    return this;
  }
  color(c: ColorInput): this {
    this._color = parseColor(c);
    return this;
  }
  bold(): this {
    this._bold = true;
    return this;
  }
  italic(): this {
    this._italic = true;
    return this;
  }
  font(name: string): this {
    this._font = name;
    return this;
  }
  align(a: Align): this {
    this._align = a;
    return this;
  }
  center(): this {
    return this.align("Center");
  }
  right(): this {
    return this.align("Right");
  }
  justify(): this {
    return this.align("Justify");
  }
  maxWidth(w: number): this {
    this._maxWidth = w;
    return this;
  }
  opacity(a: number): this {
    this._color = { ...this._color, a };
    return this;
  }
  underline(): this {
    this._underline = true;
    return this;
  }
  strikethrough(): this {
    this._strikethrough = true;
    return this;
  }

  // Read-only accessors used by the layout engine
  get fontSize(): number {
    return this._size;
  }
  get isBold(): boolean {
    return this._bold;
  }
  get wrappingWidth(): number | null {
    return this._maxWidth;
  }

  build(): RawElement {
    return {
      Text: {
        content: this.content,
        position: { x: this._x, y: this._y },
        font_family: this._font,
        font_size: this._size,
        color: this._color,
        bold: this._bold,
        italic: this._italic,
        align: this._align,
        max_width: this._maxWidth,
      },
    };
  }

  /**
   * Break text into wrapped lines and return one RawElement per line.
   * Handles alignment via x-offset so each line is drawn at "Left" internally.
   * Appends underline / strikethrough lines as Shape elements when requested.
   * Falls back to [this.build()] if no maxWidth is set.
   */
  buildAll(lineHeightMultiplier = 1.4): RawElement[] {
    if (this._maxWidth === null) {
      return [this.build()];
    }

    const lines = wrapLines(this.content, this._maxWidth, this._size, this._bold);
    const lineSpacing = this._size * lineHeightMultiplier;
    const decorWidth = Math.max(0.5, this._size * 0.06);
    const result: RawElement[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const xOff = alignmentOffset(
        estimateLineWidth(line, this._size, this._bold),
        this._maxWidth,
        this._align,
      );
      const lineX = this._x + xOff;
      const lineY = this._y + i * lineSpacing;
      const lineW = estimateLineWidth(line, this._size, this._bold);

      result.push({
        Text: {
          content: line,
          position: { x: lineX, y: lineY },
          font_family: this._font,
          font_size: this._size,
          color: this._color,
          bold: this._bold,
          italic: this._italic,
          align: "Left",
          max_width: null,
        },
      });

      // Underline: slightly below baseline
      if (this._underline && line.length > 0) {
        result.push({
          Shape: {
            Line: {
              start: { x: lineX, y: lineY + this._size * 0.15 },
              end: { x: lineX + lineW, y: lineY + this._size * 0.15 },
              color: this._color,
              width: decorWidth,
            },
          },
        });
      }

      // Strikethrough: at mid cap-height
      if (this._strikethrough && line.length > 0) {
        result.push({
          Shape: {
            Line: {
              start: { x: lineX, y: lineY - this._size * 0.3 },
              end: { x: lineX + lineW, y: lineY - this._size * 0.3 },
              color: this._color,
              width: decorWidth,
            },
          },
        });
      }
    }

    return result;
  }
}

// ─── Rect ─────────────────────────────────────────────────────────────────────

export class RectElement implements Buildable {
  private _fill: RGBA | null = null;
  private _stroke: RGBA | null = null;
  private _strokeWidth = 0;
  private _radius = 0;

  constructor(
    private _x: number,
    private _y: number,
    private _w: number,
    private _h: number,
  ) {}

  at(x: number, y: number): this {
    this._x = x;
    this._y = y;
    return this;
  }
  dimensions(w: number, h: number): this {
    this._w = w;
    this._h = h;
    return this;
  }
  fill(c: ColorInput): this {
    this._fill = parseColor(c);
    return this;
  }
  stroke(c: ColorInput, width?: number): this {
    this._stroke = parseColor(c);
    if (width !== undefined) this._strokeWidth = width;
    return this;
  }
  strokeWidth(w: number): this {
    this._strokeWidth = w;
    return this;
  }
  radius(r: number): this {
    this._radius = r;
    return this;
  }
  /** Rounded corners — defaults to 8pt radius */
  round(r = 8): this {
    return this.radius(r);
  }

  build(): RawElement {
    return {
      Shape: {
        Rectangle: {
          rect: { x: this._x, y: this._y, width: this._w, height: this._h },
          fill_color: this._fill,
          stroke_color: this._stroke,
          stroke_width: this._strokeWidth,
          border_radius: this._radius,
        },
      },
    };
  }
}

// ─── Circle ───────────────────────────────────────────────────────────────────

export class CircleElement implements Buildable {
  private _fill: RGBA | null = null;
  private _stroke: RGBA | null = null;
  private _strokeWidth = 0;

  constructor(
    private _cx: number,
    private _cy: number,
    private _r: number,
  ) {}

  at(x: number, y: number): this {
    this._cx = x;
    this._cy = y;
    return this;
  }
  radius(r: number): this {
    this._r = r;
    return this;
  }
  fill(c: ColorInput): this {
    this._fill = parseColor(c);
    return this;
  }
  stroke(c: ColorInput, width?: number): this {
    this._stroke = parseColor(c);
    if (width !== undefined) this._strokeWidth = width;
    return this;
  }
  strokeWidth(w: number): this {
    this._strokeWidth = w;
    return this;
  }

  build(): RawElement {
    return {
      Shape: {
        Circle: {
          center: { x: this._cx, y: this._cy },
          radius: this._r,
          fill_color: this._fill,
          stroke_color: this._stroke,
          stroke_width: this._strokeWidth,
        },
      },
    };
  }
}

// ─── Line ─────────────────────────────────────────────────────────────────────

export class LineElement implements Buildable {
  private _color: RGBA = { r: 0, g: 0, b: 0, a: 1 };
  private _width = 1;

  constructor(
    private _x1: number,
    private _y1: number,
    private _x2: number,
    private _y2: number,
  ) {}

  from(x: number, y: number): this {
    this._x1 = x;
    this._y1 = y;
    return this;
  }
  to(x: number, y: number): this {
    this._x2 = x;
    this._y2 = y;
    return this;
  }
  color(c: ColorInput): this {
    this._color = parseColor(c);
    return this;
  }
  width(w: number): this {
    this._width = w;
    return this;
  }

  build(): RawElement {
    return {
      Shape: {
        Line: {
          start: { x: this._x1, y: this._y1 },
          end: { x: this._x2, y: this._y2 },
          color: this._color,
          width: this._width,
        },
      },
    };
  }
}

// ─── Path ─────────────────────────────────────────────────────────────────────

type PointInput = [number, number] | { x: number; y: number };

function toXY(p: PointInput): { x: number; y: number } {
  return Array.isArray(p) ? { x: p[0], y: p[1] } : p;
}

export class PathElement implements Buildable {
  private _pts: { x: number; y: number }[];
  private _fill: RGBA | null = null;
  private _stroke: RGBA | null = null;
  private _strokeWidth = 1;
  private _closed = true;

  constructor(points: PointInput[] = []) {
    this._pts = points.map(toXY);
  }

  point(x: number, y: number): this {
    this._pts.push({ x, y });
    return this;
  }
  points(ps: PointInput[]): this {
    this._pts.push(...ps.map(toXY));
    return this;
  }
  fill(c: ColorInput): this {
    this._fill = parseColor(c);
    return this;
  }
  stroke(c: ColorInput, width?: number): this {
    this._stroke = parseColor(c);
    if (width !== undefined) this._strokeWidth = width;
    return this;
  }
  strokeWidth(w: number): this {
    this._strokeWidth = w;
    return this;
  }
  closed(v = true): this {
    this._closed = v;
    return this;
  }
  open(): this {
    this._closed = false;
    return this;
  }

  build(): RawElement {
    return {
      Shape: {
        Path: {
          points: this._pts,
          fill_color: this._fill,
          stroke_color: this._stroke,
          stroke_width: this._strokeWidth,
          closed: this._closed,
        },
      },
    };
  }
}

// ─── Image ────────────────────────────────────────────────────────────────────

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

// ─── Factory functions ────────────────────────────────────────────────────────

/** Create a text element */
export function text(content: string, x = 0, y = 0, size = 12): TextElement {
  return new TextElement(content, x, y, size);
}

/** Alias for text() */
export const txt = text;

/** Create a rectangle */
export function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: {
    fill?: ColorInput;
    stroke?: ColorInput;
    strokeWidth?: number;
    radius?: number;
  },
): RectElement {
  const el = new RectElement(x, y, w, h);
  if (opts?.fill !== undefined) el.fill(opts.fill);
  if (opts?.stroke !== undefined) el.stroke(opts.stroke, opts.strokeWidth);
  if (opts?.radius !== undefined) el.radius(opts.radius);
  return el;
}

/** Create a circle */
export function circle(
  x: number,
  y: number,
  r: number,
  opts?: { fill?: ColorInput; stroke?: ColorInput; strokeWidth?: number },
): CircleElement {
  const el = new CircleElement(x, y, r);
  if (opts?.fill !== undefined) el.fill(opts.fill);
  if (opts?.stroke !== undefined) el.stroke(opts.stroke, opts.strokeWidth);
  return el;
}

/** Create a line */
export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts?: { color?: ColorInput; width?: number },
): LineElement {
  const el = new LineElement(x1, y1, x2, y2);
  if (opts?.color !== undefined) el.color(opts.color);
  if (opts?.width !== undefined) el.width(opts.width);
  return el;
}

/** Create a polygon/path */
export function path(
  points: PointInput[],
  opts?: {
    fill?: ColorInput;
    stroke?: ColorInput;
    strokeWidth?: number;
    closed?: boolean;
  },
): PathElement {
  const el = new PathElement(points);
  if (opts?.fill !== undefined) el.fill(opts.fill);
  if (opts?.stroke !== undefined) el.stroke(opts.stroke, opts.strokeWidth);
  if (opts?.closed !== undefined) el.closed(opts.closed);
  return el;
}

/** Create an image element from raw bytes */
export function image(
  data: Uint8Array,
  opts?: { x?: number; y?: number; width?: number; height?: number },
): ImageElement {
  return new ImageElement(data, opts?.x ?? 0, opts?.y ?? 0, opts?.width, opts?.height);
}

// ─── Link ─────────────────────────────────────────────────────────────────────

/**
 * Hyperlink annotation — places a clickable region over an area of the page.
 * Use with manual layout: position the rect to match the text you want to link.
 */
export class LinkElement implements Buildable {
  constructor(
    private _url: string,
    private _x: number,
    private _y: number,
    private _w: number,
    private _h: number,
    private _text: string | null = null,
  ) {}

  at(x: number, y: number): this {
    this._x = x;
    this._y = y;
    return this;
  }
  size(w: number, h: number): this {
    this._w = w;
    this._h = h;
    return this;
  }
  label(t: string): this {
    this._text = t;
    return this;
  }

  build(): RawElement {
    return {
      Link: {
        url: this._url,
        rect: { x: this._x, y: this._y, width: this._w, height: this._h },
        text: this._text,
      },
    };
  }
}

/** Create a hyperlink annotation */
export function link(
  url: string,
  x: number,
  y: number,
  w: number,
  h: number,
): LinkElement {
  return new LinkElement(url, x, y, w, h);
}
