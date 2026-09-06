import { parseColor } from "../colors.ts";
import type { Buildable, ColorInput, RawElement, RGBA } from "../types.ts";

// ─── Builder ────────────────────────────────────────────────────────────────────

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

// ─── Factory ─────────────────────────────────────────────────────────────────

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
