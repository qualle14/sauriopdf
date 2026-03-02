/**
 * Layout math — text wrapping, line estimation, alignment offsets.
 *
 * All wrapping is done in TypeScript before elements reach Rust,
 * because Krilla's draw_text() places text at a single point with no
 * built-in wrap or alignment. We decompose multi-line text into individual
 * positioned draw calls.
 *
 * Accuracy: we approximate using average character widths for Latin fonts.
 * This is good enough for page-break decisions and layout. Future improvement:
 * expose actual glyph advance widths from Rust for pixel-perfect metrics.
 */

import type { Align } from "./types.ts";

/** Break content into lines that fit within maxWidth. Respects `\n`. */
export function wrapLines(
  content: string,
  maxWidth: number,
  fontSize: number,
  bold = false,
): string[] {
  const avgCharWidth = bold ? fontSize * 0.58 : fontSize * 0.52;
  const charsPerLine = Math.max(1, Math.floor(maxWidth / avgCharWidth));
  const result: string[] = [];

  for (const paragraph of content.split("\n")) {
    if (paragraph.trim() === "") {
      result.push("");
      continue;
    }

    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    let current = "";

    for (const word of words) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= charsPerLine) {
        current += " " + word;
      } else {
        result.push(current);
        current = word;
      }
    }
    if (current) result.push(current);
  }

  return result.length > 0 ? result : [""];
}

/** Estimate the rendered width of a single line of text */
export function estimateLineWidth(
  line: string,
  fontSize: number,
  bold = false,
): number {
  const avgCharWidth = bold ? fontSize * 0.58 : fontSize * 0.52;
  return line.length * avgCharWidth;
}

/**
 * X offset for alignment within a container.
 * Returns 0 for Left (no offset needed).
 */
export function alignmentOffset(
  lineWidth: number,
  containerWidth: number,
  align: Align,
): number {
  switch (align) {
    case "Center":
      return Math.max(0, (containerWidth - lineWidth) / 2);
    case "Right":
      return Math.max(0, containerWidth - lineWidth);
    default: // Left, Justify
      return 0;
  }
}

/** Total line count after wrapping (used for height estimation) */
export function estimateLineCount(
  content: string,
  maxWidth: number,
  fontSize: number,
  bold = false,
): number {
  return wrapLines(content, maxWidth, fontSize, bold).length;
}

/** Estimated block height of a text string after wrapping */
export function estimateTextHeight(
  content: string,
  maxWidth: number,
  fontSize: number,
  lineHeight = 1.4,
  bold = false,
): number {
  return estimateLineCount(content, maxWidth, fontSize, bold) * fontSize * lineHeight;
}
