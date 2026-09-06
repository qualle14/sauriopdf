import { parseColor } from "../colors.ts";
import { alignmentOffset, estimateLineWidth, wrapLines } from "../layout.ts";
import type { Align, Buildable, ColorInput, RawElement, RGBA } from "../types.ts";

// ─── Builder ────────────────────────────────────────────────────────────────────

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

    const lines = wrapLines(this.content, this._maxWidth, this._size, this._bold, this._font);
    const lineSpacing = this._size * lineHeightMultiplier;
    const decorWidth = Math.max(0.5, this._size * 0.06);
    const result: RawElement[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineW = estimateLineWidth(line, this._size, this._bold, this._font);
      const xOff = alignmentOffset(lineW, this._maxWidth, this._align);
      const lineX = this._x + xOff;
      const lineY = this._y + i * lineSpacing;

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
              line_cap: "Butt",
              line_join: "Miter",
              dash_array: [],
              dash_offset: 0,
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
              line_cap: "Butt",
              line_join: "Miter",
              dash_array: [],
              dash_offset: 0,
            },
          },
        });
      }
    }

    return result;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a text element */
export function text(content: string, x = 0, y = 0, size = 12): TextElement {
  return new TextElement(content, x, y, size);
}

/** Alias for text() */
export const txt = text;
