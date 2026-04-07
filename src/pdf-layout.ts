/**
 * PDFLayout — auto-layout methods built on top of PDFBase.
 *
 * Provides: h1–h4, p, spacer, hr, table, img
 * All methods advance an internal cursor and auto-break pages.
 */

import { PDFBase } from "./pdf-base.ts";
import { estimateTextHeight } from "./layout.ts";
import {
  ImageElement,
  imageSize,
  LineElement,
  RectElement,
  TextElement,
} from "./elements.ts";
import { buildTableElements } from "./table.ts";
import type { Align, ColorInput, TableOptions } from "./types.ts";

export class PDFLayout extends PDFBase {
  // ── Headings ──────────────────────────────────────────────────────────────

  /** Heading level 1 — 28pt bold */
  h1(content: string, opts?: { color?: ColorInput }): this {
    return this._layoutText(content, 28, { bold: true, ...opts });
  }

  /** Heading level 2 — 22pt bold */
  h2(content: string, opts?: { color?: ColorInput }): this {
    return this._layoutText(content, 22, { bold: true, ...opts });
  }

  /** Heading level 3 — 17pt bold */
  h3(content: string, opts?: { color?: ColorInput }): this {
    return this._layoutText(content, 17, { bold: true, ...opts });
  }

  /** Heading level 4 — 14pt bold */
  h4(content: string, opts?: { color?: ColorInput }): this {
    return this._layoutText(content, 14, { bold: true, ...opts });
  }

  // ── Paragraph ────────────────────────────────────────────────────────────

  /**
   * Paragraph text — wraps to content width and auto-breaks pages.
   * Defaults to 11pt left-aligned.
   */
  p(
    content: string,
    opts?: {
      size?: number;
      color?: ColorInput;
      align?: Align;
      lineHeight?: number;
      bold?: boolean;
      italic?: boolean;
      font?: string;
    },
  ): this {
    return this._layoutText(content, opts?.size ?? 11, opts);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /** Vertical blank space */
  spacer(points = 16): this {
    this._cursorY += points;
    return this;
  }

  /** Horizontal rule */
  hr(opts?: { color?: ColorInput; width?: number }): this {
    const x = this._cfg.margin.left;
    const cw = this._contentWidth();
    const lw = opts?.width ?? 0.75;

    this._reserve(lw + 8);

    this._current.push(
      new LineElement(x, this._cursorY, x + cw, this._cursorY)
        .color(opts?.color ?? "#cccccc")
        .width(lw)
        .build(),
    );

    this._cursorY += lw + 8;
    return this;
  }

  // ── Table ─────────────────────────────────────────────────────────────────

  /**
   * Render a table at the current cursor, auto-breaking across pages when
   * rows overflow.
   */
  table(opts: TableOptions): this {
    const x = this._cfg.margin.left;
    const cw = this._contentWidth();
    const fontSize = opts.fontSize ?? 11;
    const cellPad = opts.cellPadding ?? 6;
    const rowH = opts.rowHeight ?? Math.ceil(fontSize * 1.4 + cellPad * 2);
    const headerH = (opts.headers?.length ?? 0) > 0 ? rowH : 0;

    // Clone rows so we can splice without mutating the caller's data
    const remaining = [...opts.rows];
    let firstChunk = true;

    while (firstChunk || remaining.length > 0) {
      firstChunk = false;

      const available = this._pageContentHeight() -
        (this._cursorY - this._cfg.margin.top - this._headerH);
      const maxRows = Math.max(1, Math.floor((available - headerH) / rowH));
      const chunkRows = remaining.splice(0, maxRows);

      const { elements, height } = buildTableElements(
        { ...opts, headers: headerH > 0 ? opts.headers : undefined, rows: chunkRows },
        x,
        this._cursorY,
        cw,
      );

      this._current.push(...elements);
      this._cursorY += height + this._gap;

      if (remaining.length > 0) this._breakPage();
    }

    return this;
  }

  // ── Image ─────────────────────────────────────────────────────────────────

  /**
   * Image at the current cursor position.
   * Width defaults to full content width.
   */
  img(data: Uint8Array, opts?: { width?: number; height?: number }): this {
    const w = opts?.width ?? this._contentWidth();
    const h = opts?.height ?? (() => {
      const dims = imageSize(data);
      return (dims && dims.width > 0) ? Math.round(w * dims.height / dims.width) : 100;
    })();

    this._reserve(h);

    this._current.push(
      new ImageElement(data, this._cfg.margin.left, this._cursorY, w, h).build(),
    );

    this._cursorY += h + this._gap;
    return this;
  }

  // ── List ──────────────────────────────────────────────────────────────────

  /**
   * Bullet or numbered list, page-break aware.
   *
   * @example
   * ```ts
   * pdf.list(["First item", "Second item"], { style: "numbered", indent: 24 });
   * ```
   */
  list(
    items: string[],
    opts?: {
      style?: "bullet" | "numbered";
      indent?: number;
      bullet?: string;
      size?: number;
      color?: ColorInput;
      lineHeight?: number;
      font?: string;
    },
  ): this {
    const style = opts?.style ?? "bullet";
    const indent = opts?.indent ?? 20;
    const size = opts?.size ?? 11;
    const lh = opts?.lineHeight ?? 1.4;
    const bulletChar = opts?.bullet ?? "\u2022"; // •

    const x = this._cfg.margin.left;
    const textW = this._contentWidth() - indent;

    for (let i = 0; i < items.length; i++) {
      const prefix = style === "numbered" ? `${i + 1}.` : bulletChar;
      const content = items[i];
      const h = estimateTextHeight(content, textW, size, lh, false);
      const isLast = i === items.length - 1;

      this._reserve(h);

      // Prefix (bullet or number) at left margin
      const prefixEl = new TextElement(prefix, x, this._cursorY, size);
      if (opts?.color) prefixEl.color(opts.color);
      if (opts?.font) prefixEl.font(opts.font);
      this._current.push(prefixEl.build());

      // Item text, indented and wrapped
      const textEl = new TextElement(content, x + indent, this._cursorY, size)
        .maxWidth(textW);
      if (opts?.color) textEl.color(opts.color);
      if (opts?.font) textEl.font(opts.font);
      this._current.push(...textEl.buildAll(lh));

      // Small gap between items; standard gap after the last one
      this._cursorY += h + (isLast ? this._gap : 4);
    }

    return this;
  }

  // ── Code block ────────────────────────────────────────────────────────────

  /**
   * Monospaced code block with a background fill.
   * Lines are NOT wrapped — use `\n` to break lines explicitly.
   *
   * @example
   * ```ts
   * pdf.code("const x = 42;\nconsole.log(x);", { size: 10 });
   * ```
   */
  code(
    content: string,
    opts?: {
      font?: string;
      size?: number;
      color?: ColorInput;
      background?: ColorInput;
      padding?: number;
    },
  ): this {
    const font = opts?.font ?? "Liberation Mono";
    const size = opts?.size ?? 10;
    const lh = 1.4;
    const pad = opts?.padding ?? 10;
    const bg = opts?.background ?? "#f6f8fa";

    const x = this._cfg.margin.left;
    const cw = this._contentWidth();
    const lines = content.split("\n");
    const blockH = pad * 2 + lines.length * size * lh;

    this._reserve(blockH);

    const y = this._cursorY;

    // Background fill
    this._current.push(new RectElement(x, y, cw, blockH).fill(bg).build());

    // One text element per line — no wrapping, monospace font
    // y + pad = visual top of text; add cap-height offset (≈0.72 em) for baseline
    const baselineOffset = size * 0.72;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length === 0) continue; // blank lines still count toward height
      const lineEl = new TextElement(
        lines[i],
        x + pad,
        y + pad + baselineOffset + i * size * lh,
        size,
      ).font(font);
      if (opts?.color) lineEl.color(opts.color);
      this._current.push(lineEl.build());
    }

    this._cursorY += blockH + this._gap;
    return this;
  }

  // ── Callout ───────────────────────────────────────────────────────────────

  /**
   * Callout / alert box with a colored left accent bar.
   * Built-in types: "info" (blue), "warning" (amber), "error" (red), "success" (green).
   *
   * @example
   * ```ts
   * pdf.callout("Backup your data before proceeding.", { type: "warning" });
   * pdf.callout("Build passed.", { type: "success", title: "All clear" });
   * ```
   */
  callout(
    message: string,
    opts?: {
      type?: "info" | "warning" | "error" | "success";
      title?: string;
      size?: number;
      padding?: number;
    },
  ): this {
    const schemes = {
      info: { bg: "#eff6ff", accent: "#3b82f6", defaultTitle: "Info" },
      warning: { bg: "#fffbeb", accent: "#f59e0b", defaultTitle: "Warning" },
      error: { bg: "#fef2f2", accent: "#ef4444", defaultTitle: "Error" },
      success: { bg: "#f0fdf4", accent: "#22c55e", defaultTitle: "Success" },
    };
    const scheme = schemes[opts?.type ?? "info"];
    const pad = opts?.padding ?? 12;
    const size = opts?.size ?? 11;
    const title = opts?.title ?? scheme.defaultTitle;
    const x = this._cfg.margin.left;
    const cw = this._contentWidth();
    const innerW = cw - pad * 2 - 4; // 4pt for accent bar

    const lh = 1.4;
    const titleH = estimateTextHeight(title, innerW, size, lh, true);
    const msgH = estimateTextHeight(message, innerW, size, lh, false);
    const totalH = pad + titleH + 4 + msgH + pad;

    this._reserve(totalH);
    const y = this._cursorY;

    // Background
    this._current.push(new RectElement(x, y, cw, totalH).fill(scheme.bg).build());
    // Left accent bar
    this._current.push(new RectElement(x, y, 4, totalH).fill(scheme.accent).build());

    // Title (bold)
    const titleEl = new TextElement(title, x + pad + 4, y + pad, size)
      .maxWidth(innerW)
      .bold();
    this._current.push(...titleEl.buildAll(lh));

    // Message
    const msgEl = new TextElement(message, x + pad + 4, y + pad + titleH + 4, size)
      .maxWidth(innerW);
    this._current.push(...msgEl.buildAll(lh));

    this._cursorY += totalH + this._gap;
    return this;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _layoutText(
    content: string,
    size: number,
    opts?: {
      bold?: boolean;
      italic?: boolean;
      color?: ColorInput;
      align?: Align;
      lineHeight?: number;
      font?: string;
    },
  ): this {
    const cw = this._contentWidth();
    const lh = opts?.lineHeight ?? 1.4;
    const bold = opts?.bold ?? false;
    const h = estimateTextHeight(content, cw, size, lh, bold);

    this._reserve(h);

    const el = new TextElement(content, this._cfg.margin.left, this._cursorY, size)
      .maxWidth(cw);

    if (bold) el.bold();
    if (opts?.italic) el.italic();
    if (opts?.color) el.color(opts.color);
    if (opts?.align) el.align(opts.align);
    if (opts?.font) el.font(opts.font);

    this._current.push(...el.buildAll(lh));
    this._cursorY += h + this._gap;
    return this;
  }
}
