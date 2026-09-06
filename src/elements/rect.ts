import { parseColor } from "../colors.ts";
import type { Buildable, ColorInput, RawElement, RGBA } from "../types.ts";

// ─── Builder ────────────────────────────────────────────────────────────────────

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

// ─── Factory ─────────────────────────────────────────────────────────────────

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
