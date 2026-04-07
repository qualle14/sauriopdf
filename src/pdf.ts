/**
 * PDF document builder — the heart of the library.
 *
 * Two composable modes:
 *   Manual  — pdf.add(text("Hi").at(100, 100))  → explicit coordinates
 *   Layout  — pdf.h1("Title"); pdf.p("Body")     → cursor auto-advances
 *
 * Mix freely. Layout methods advance the cursor; add() does not.
 */

import { PDFLayout } from "./pdf-layout.ts";
import { shiftEl } from "./pdf-base.ts";
import { LineElement, RectElement } from "./elements.ts";
import type { ColorInput, PaddingSpec, SectionOptions } from "./types.ts";

// ─── PDF class ────────────────────────────────────────────────────────────────

export class PDF extends PDFLayout {
  /**
   * Render a boxed section with optional background, border, and padding.
   * The callback receives a sub-PDF instance that uses the same layout API.
   *
   * @example
   * ```ts
   * pdf.section({ background: "#f0f4ff", borderColor: "#93c5fd", padding: 16 }, (s) => {
   *   s.h3("Note").p("This text lives inside the section.");
   * });
   * ```
   */
  section(opts: SectionOptions, fn: (s: PDF) => void): this {
    const rawPad = opts.padding ?? 12;
    const pad: PaddingSpec = typeof rawPad === "number"
      ? { top: rawPad, right: rawPad, bottom: rawPad, left: rawPad }
      : rawPad;

    const sectionX = this._cfg.margin.left;
    const sectionW = this._contentWidth();

    // Build a sub-PDF whose coordinate origin matches the main page.
    // margin.top  = where the cursor starts in absolute page coords
    // margin.left/right = the inner column with padding applied
    // height = huge so page breaks never trigger inside a section
    const sub = new PDF();
    sub._dim = { ...this._dim, height: 999_999 };
    sub._cfg.margin = {
      top: this._cursorY + pad.top,
      bottom: 0,
      left: sectionX + pad.left,
      right: this._dim.width - sectionX - sectionW + pad.right,
    };
    sub._cursorY = this._cursorY + pad.top;

    fn(sub);

    const contentH = sub._cursorY - (this._cursorY + pad.top);
    const sectionH = pad.top + contentH + pad.bottom;

    // Reserve height — may break to a new page
    const startY = this._cursorY;
    this._reserve(sectionH);
    const deltaY = this._cursorY - startY;

    const y = this._cursorY;

    if (opts.background) {
      const r = new RectElement(sectionX, y, sectionW, sectionH).fill(opts.background);
      if (opts.radius) r.radius(opts.radius);
      this._current.push(r.build());
    }
    if (opts.borderColor) {
      const r = new RectElement(sectionX, y, sectionW, sectionH)
        .stroke(opts.borderColor, 0.75);
      if (opts.radius) r.radius(opts.radius);
      this._current.push(r.build());
    }

    // If page broke, shift sub-elements to match new cursor position
    const subEls = deltaY === 0
      ? sub._current
      : sub._current.map((el) => shiftEl(el, 0, deltaY));
    this._current.push(...subEls);

    this._cursorY += sectionH + this._gap;
    return this;
  }

  /**
   * Render N side-by-side columns. Each column is a full PDF sub-document
   * positioned at its column offset. After the callback, the cursor advances
   * past the tallest column.
   *
   * @example
   * ```ts
   * pdf.columns(2, ([left, right]) => {
   *   left.h3("Left").p("Some text here.");
   *   right.h3("Right").p("Other text here.");
   * }, { gap: 20, divider: true });
   * ```
   */
  columns(
    n: number,
    fn: (cols: PDF[]) => void,
    opts?: {
      /** Column widths: values ≤1 are fractions of content width, >1 are points. */
      widths?: number[];
      /** Gap between columns in points (default: 16) */
      gap?: number;
      /** Draw a vertical line between columns. Pass a color or `true` for default. */
      divider?: boolean | ColorInput;
    },
  ): this {
    const gap = opts?.gap ?? 16;
    const cw = this._contentWidth();
    const x = this._cfg.margin.left;

    // Resolve column widths
    const colWidths: number[] = opts?.widths?.length
      ? opts.widths.map((w) => (w <= 1 ? w * cw : w))
      : Array.from({ length: n }, () => (cw - gap * (n - 1)) / n);

    // Build one sub-PDF per column, each clamped to its horizontal slot
    let colX = x;
    const cols: PDF[] = colWidths.map((w, i) => {
      const sub = new PDF();
      sub._dim = { ...this._dim, height: 999_999 };
      sub._cfg.margin = {
        top: this._cursorY,
        bottom: 0,
        left: colX,
        right: this._dim.width - colX - w,
      };
      sub._cursorY = this._cursorY;
      colX += w + (i < n - 1 ? gap : 0);
      return sub;
    });

    fn(cols);

    const maxH = Math.max(0, ...cols.map((col) => col._cursorY - this._cursorY));

    // Reserve space; track potential page-break shift
    const startY = this._cursorY;
    this._reserve(maxH);
    const deltaY = this._cursorY - startY;
    const y = this._cursorY;

    // Commit column elements (shifted if a page break occurred)
    for (const col of cols) {
      const els = deltaY === 0
        ? col._current
        : col._current.map((el) => shiftEl(el, 0, deltaY));
      this._current.push(...els);
    }

    // Optional vertical dividers between columns
    if (opts?.divider) {
      const divColor: ColorInput = opts.divider === true ? "#cccccc" : opts.divider;
      let cx = x;
      for (let i = 0; i < n - 1; i++) {
        cx += colWidths[i];
        const divX = cx + gap / 2;
        this._current.push(
          new LineElement(divX, y, divX, y + maxH).color(divColor).width(0.75).build(),
        );
        cx += gap;
      }
    }

    this._cursorY += maxH + this._gap;
    return this;
  }
}

// ─── Quick helper ─────────────────────────────────────────────────────────────

/**
 * Create and save a PDF in one call.
 * @example
 * ```ts
 * await quickPDF("out.pdf", (pdf) => {
 *   pdf.h1("Hello").p("World");
 * });
 * ```
 */
export async function quickPDF(
  filePath: string,
  builder: (pdf: PDF) => void | Promise<void>,
): Promise<void> {
  const pdf = new PDF();
  await builder(pdf);
  await pdf.save(filePath);
}
