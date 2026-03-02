/**
 * Table renderer.
 *
 * Tables don't exist as a native Krilla primitive — they're composed from
 * rectangles, lines, and text elements computed entirely in TypeScript.
 *
 * Text positioning: Krilla's draw_text() places text at its BASELINE, not at
 * the visual top. To align text within a cell with proper padding we must
 * offset the baseline down by the cap-height (≈ fontSize * CAP_RATIO) so the
 * visual top of the first letter lands exactly at curY + cellPad.
 *
 * Row heights are computed from: 2*cellPad + fontSize + (n-1)*lineH,
 * which accounts for ascender+descender of one full line plus lineH spacing
 * for each additional line.
 */

import { parseColor } from "./colors.ts";
import { wrapLines, estimateLineWidth } from "./layout.ts";
import type { TableOptions, RawElement, RGBA } from "./types.ts";

/** Approximate ratio of cap-height to em-size for Liberation Sans */
const CAP_RATIO = 0.72;

export function buildTableElements(
  opts: TableOptions,
  x: number,
  y: number,
  contentWidth: number,
): { elements: RawElement[]; height: number } {
  const elements: RawElement[] = [];

  const fontSize  = opts.fontSize    ?? 11;
  const cellPad   = opts.cellPadding ?? 6;
  const minRowH   = opts.rowHeight   ?? 0;
  const hasBorder = opts.borders !== false;
  const lineH     = fontSize * 1.4;

  // Resolve column widths
  const colCount = Math.max(
    opts.headers?.length ?? 0,
    ...opts.rows.map((r) => r.length),
  );

  const widths: number[] = opts.widths?.length
    ? opts.widths.map((w) => w <= 1 ? w * contentWidth : w)
    : autoColWidths(opts.headers, opts.rows, colCount, contentWidth, fontSize, cellPad);

  // ── Height helpers ──────────────────────────────────────────────────────────

  function cellLineCount(text: string, colIdx: number, bold: boolean): number {
    const cellW = (widths[colIdx] ?? contentWidth) - cellPad * 2;
    return wrapLines(text, cellW, fontSize, bold).length;
  }

  /**
   * Row height that ensures text with proper cellPad above and below.
   * Formula: 2*cellPad + fontSize + (n-1)*lineH
   *   - fontSize covers ascender (CAP_RATIO) + descender (1-CAP_RATIO) of one line
   *   - (n-1)*lineH is the distance between additional baselines
   */
  function computeRowH(row: string[], bold: boolean): number {
    const maxLines = Math.max(
      1,
      ...row.map((cell, ci) => cellLineCount(cell ?? "", ci, bold)),
    );
    const h = fontSize + (maxLines - 1) * lineH + cellPad * 2;
    return Math.max(minRowH, Math.ceil(h));
  }

  // ── Pre-compute row heights ─────────────────────────────────────────────────

  const headerH    = (opts.headers?.length ?? 0) > 0 ? computeRowH(opts.headers!, true) : 0;
  const rowHeights = opts.rows.map((r) => computeRowH(r, false));

  // ── Colors ─────────────────────────────────────────────────────────────────

  const fg    = parseColor(opts.textColor ?? "#111111");
  const strBg = parseColor(opts.stripedBg ?? "#f4f6f8");
  const rowBg = opts.rowBg ? parseColor(opts.rowBg) : null;

  let curY = y;
  const dividerYs: number[] = [];

  // ── Header ─────────────────────────────────────────────────────────────────

  if (opts.headers && opts.headers.length > 0) {
    const hBg = parseColor(opts.headerBg    ?? "#2c3e50");
    const hFg = parseColor(opts.headerColor ?? "#ffffff");

    elements.push(rectEl(x, curY, contentWidth, headerH, hBg, null, 0));

    let cx = x;
    for (let i = 0; i < opts.headers.length; i++) {
      const cellW     = (widths[i] ?? contentWidth) - cellPad * 2;
      const textX     = cx + cellPad;
      const textY     = curY + cellPad + fontSize * CAP_RATIO; // baseline of line 0
      elements.push(...cellTextEls(opts.headers[i] ?? "", textX, textY, fontSize, hFg, true, cellW, lineH));
      cx += widths[i] ?? 0;
    }

    curY += headerH;
    dividerYs.push(curY);
  }

  // ── Rows ───────────────────────────────────────────────────────────────────

  for (let ri = 0; ri < opts.rows.length; ri++) {
    const row       = opts.rows[ri];
    const thisRowH  = rowHeights[ri];
    const useStripe = opts.striped && ri % 2 === 1;

    if (useStripe || rowBg) {
      elements.push(rectEl(x, curY, contentWidth, thisRowH, useStripe ? strBg : rowBg!, null, 0));
    }

    let cx = x;
    for (let ci = 0; ci < row.length; ci++) {
      const cellW = (widths[ci] ?? contentWidth) - cellPad * 2;
      const textX = cx + cellPad;
      const textY = curY + cellPad + fontSize * CAP_RATIO; // baseline of line 0
      elements.push(...cellTextEls(row[ci] ?? "", textX, textY, fontSize, fg, false, cellW, lineH));
      cx += widths[ci] ?? contentWidth;
    }

    curY += thisRowH;
    if (ri < opts.rows.length - 1) dividerYs.push(curY);
  }

  // ── Borders ────────────────────────────────────────────────────────────────

  if (hasBorder) {
    const bc = parseColor("#cccccc");
    const bw = 0.75;

    elements.push(rectEl(x, y, contentWidth, curY - y, null, bc, 1));
    for (const dy of dividerYs) {
      elements.push(lineEl(x, dy, x + contentWidth, dy, bc, bw));
    }

    let cx = x;
    for (let i = 0; i < widths.length - 1; i++) {
      cx += widths[i];
      elements.push(lineEl(cx, y, cx, curY, bc, bw));
    }
  }

  return { elements, height: curY - y };
}

// ─── Auto column widths ────────────────────────────────────────────────────────

/**
 * Estimate optimal column widths from content when the caller provides none.
 *
 * Strategy per column:
 *  - score = max(longest-word width, full-line width capped at 50% of content)
 *  - add cell padding on both sides
 *  - scale all columns proportionally so their sum equals contentWidth
 */
function autoColWidths(
  headers: string[] | undefined,
  rows: string[][],
  colCount: number,
  contentWidth: number,
  fontSize: number,
  cellPad: number,
): number[] {
  const allRows = [...(headers ? [headers] : []), ...rows];
  const scores = Array<number>(colCount).fill(0);

  for (const row of allRows) {
    for (let ci = 0; ci < colCount; ci++) {
      const cell = row[ci] ?? "";
      const words = cell.split(/\s+/).filter((w) => w.length > 0);
      const longestWord = words.length > 0
        ? Math.max(...words.map((w) => estimateLineWidth(w, fontSize, false)))
        : 0;
      const lineW = estimateLineWidth(cell, fontSize, false);
      scores[ci] = Math.max(scores[ci], longestWord, Math.min(lineW, contentWidth * 0.5));
    }
  }

  const raw = scores.map((s) => s + cellPad * 2);
  const total = raw.reduce((a, b) => a + b, 0);
  const scale = contentWidth / Math.max(total, 1);
  return raw.map((w) => Math.round(w * scale));
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Emit one Text element per wrapped line within a cell.
 * `y` must be the baseline of line 0 (already offset by cellPad + cap-height).
 */
function cellTextEls(
  content: string,
  x: number,
  y: number,
  fontSize: number,
  color: RGBA,
  bold: boolean,
  cellW: number,
  lineH: number,
): RawElement[] {
  const lines = wrapLines(content, cellW, fontSize, bold);
  return lines.map((line, i) => ({
    Text: {
      content:     line,
      position:    { x, y: y + i * lineH },
      font_family: "Liberation Sans",
      font_size:   fontSize,
      color,
      bold,
      italic:      false,
      align:       "Left",
      max_width:   null,
    },
  }));
}

function rectEl(
  x: number, y: number, w: number, h: number,
  fill: RGBA | null, stroke: RGBA | null, strokeWidth: number,
): RawElement {
  return {
    Shape: {
      Rectangle: {
        rect:          { x, y, width: w, height: h },
        fill_color:    fill,
        stroke_color:  stroke,
        stroke_width:  strokeWidth,
        border_radius: 0,
      },
    },
  };
}

function lineEl(
  x1: number, y1: number, x2: number, y2: number,
  color: RGBA, width: number,
): RawElement {
  return {
    Shape: {
      Line: {
        start: { x: x1, y: y1 },
        end:   { x: x2, y: y2 },
        color,
        width,
      },
    },
  };
}
