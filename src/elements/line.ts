import { parseColor } from "../colors.ts";
import type { Buildable, ColorInput, LineCap, LineJoin, RawElement, RGBA } from "../types.ts";

// ─── Builder ────────────────────────────────────────────────────────────────────

export class LineElement implements Buildable {
  private _color: RGBA = { r: 0, g: 0, b: 0, a: 1 };
  private _width = 1;
  private _lineCap: LineCap = "Butt";
  private _lineJoin: LineJoin = "Miter";
  private _dashArray: number[] = [];
  private _dashOffset = 0;

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
  lineCap(cap: LineCap): this {
    this._lineCap = cap;
    return this;
  }
  lineJoin(join: LineJoin): this {
    this._lineJoin = join;
    return this;
  }
  /**
   * Draw a dashed line.
   * @param dash  Length of each dash in points.
   * @param gap   Length of each gap in points (defaults to dash length).
   * @param offset Phase offset (default 0).
   * @example line(...).dash(6, 3)  // 6pt dash, 3pt gap
   */
  dash(dash: number, gap?: number, offset = 0): this {
    this._dashArray = [dash, gap ?? dash];
    this._dashOffset = offset;
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
          line_cap: this._lineCap,
          line_join: this._lineJoin,
          dash_array: this._dashArray,
          dash_offset: this._dashOffset,
        },
      },
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

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
