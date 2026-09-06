import type { Buildable, RawElement } from "../types.ts";

// ─── Builder ────────────────────────────────────────────────────────────────────

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

// ─── Factory ─────────────────────────────────────────────────────────────────

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
