import { parseColor } from "../colors.ts";
import type { Buildable, ColorInput, RawElement, RGBA } from "../types.ts";

// ─── Point helpers ──────────────────────────────────────────────────────────────

type PointInput = [number, number] | { x: number; y: number };

function toXY(p: PointInput): { x: number; y: number } {
  return Array.isArray(p) ? { x: p[0], y: p[1] } : p;
}

// ─── Builder ────────────────────────────────────────────────────────────────────

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

// ─── Factory ─────────────────────────────────────────────────────────────────

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
