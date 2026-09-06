/**
 * Layout math — text wrapping, line estimation, alignment offsets.
 *
 * All wrapping is done in TypeScript before elements reach Rust, because
 * Krilla's draw_text() places text at a single point with no built-in wrap
 * or alignment. We decompose multi-line text into individual positioned
 * draw calls.
 *
 * Accuracy: widths come from the font's own glyph metrics (measureChars(),
 * backed by ttf-parser reading the font's hmtx/hhea tables) rather than an
 * average-character guess, so wrapping is accurate for any loaded font, not
 * just Liberation Sans.
 *
 * Cost: measureChars() crosses the WASM boundary, which isn't free — real
 * report-shaped documents (many paragraphs reusing the same handful of
 * distinct characters) were spending more time measuring text than Krilla
 * spends actually rendering it. `charWidths()` below caches every character's
 * width per (font, bold, size) the first time it's measured, for the life of
 * the process — after that, repeated text in the same font/size is free.
 * Both cache dimensions are LRU-bounded (see `LRUMap`): a long-running server
 * generating documents with arbitrary, non-repeating fonts/sizes/text (e.g.
 * font sizes computed per document) can't grow either one without limit.
 */

import { measureChars } from "./wasm.ts";
import type { Align } from "./types.ts";

const DEFAULT_FONT = "Liberation Sans";

// ─── Wrapping engine (internal) ─────────────────────────────────────────────────

/**
 * A Map bounded to `capacity` entries — once full, inserting a new key evicts
 * the least-recently-used one. Used for caches keyed by inputs a caller
 * controls (font family/size, arbitrary text) that could vary without limit
 * over a long-running process; a miss just costs a re-measure, so eviction is
 * always safe, never a correctness issue.
 */
class LRUMap<K, V> {
  private map = new Map<K, V>();
  constructor(private readonly capacity: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value); // refresh recency: move to the most-recent end
    }
    return value;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value as K;
      this.map.delete(oldest);
    }
    this.map.set(key, value);
  }
}

// Generous enough to cover every font/bold/size combination a single
// realistic document uses (a report mixing a few families, weights, and
// heading/body sizes easily reaches a few dozen) without ever coming close in
// normal use — the cap only bites under genuinely unbounded variation.
const MAX_FONT_KEYS = 200;
// Comfortably covers Latin/Cyrillic/Greek plus a healthy CJK subset per font.
const MAX_CHARS_PER_FONT = 4096;

// One width-per-character map per distinct (fontFamily, bold, fontSize) combo.
const _widthCache = new LRUMap<string, LRUMap<string, number>>(MAX_FONT_KEYS);

function _cacheKey(fontFamily: string, bold: boolean, fontSize: number): string {
  return `${fontFamily}\0${bold}\0${fontSize}`;
}

/**
 * Per-character advance widths (points) for `text` in the given font/size.
 * Only characters not already in the cache for this (font, bold, size) cross
 * into WASM — as one batched `measureChars()` call for all of them at once,
 * not one call per character.
 */
function charWidths(
  text: string,
  fontSize: number,
  bold: boolean,
  fontFamily: string,
): Float32Array {
  if (text.length === 0) return new Float32Array(0);

  const key = _cacheKey(fontFamily, bold, fontSize);
  let cache = _widthCache.get(key);
  if (!cache) {
    cache = new LRUMap<string, number>(MAX_CHARS_PER_FONT);
    _widthCache.set(key, cache);
  }

  let missing = "";
  const queued = new Set<string>();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!cache.has(ch) && !queued.has(ch)) {
      missing += ch;
      queued.add(ch);
    }
  }

  if (missing.length > 0) {
    // Wrap-width estimation never varies by italic — italic glyphs render
    // fine, they just measure against the upright metrics (matches the
    // accuracy the old average-width formula already had).
    const measured = measureChars(fontFamily, bold, false, missing, fontSize);
    for (let i = 0; i < missing.length; i++) cache.set(missing[i], measured[i]);
  }

  const result = new Float32Array(text.length);
  for (let i = 0; i < text.length; i++) {
    result[i] = cache.get(text[i])!;
  }
  return result;
}

function sum(widths: Float32Array, start: number, end: number): number {
  let total = 0;
  for (let i = start; i < end; i++) total += widths[i];
  return total;
}

/**
 * Split a single overlong word into width-limited chunks, using real glyph
 * widths already measured for the word's characters (`widths[at..at+len)`).
 * Returns the last chunk's width alongside it so callers don't need to
 * re-measure — every chunk's width was already known while splitting.
 */
function chunkWordByWidth(
  word: string,
  at: number,
  widths: Float32Array,
  maxWidth: number,
): { chunks: string[]; lastWidth: number } {
  const wholeWidth = sum(widths, at, at + word.length);
  if (wholeWidth <= maxWidth || word.length <= 1) {
    return { chunks: [word], lastWidth: wholeWidth };
  }

  const chunks: string[] = [];
  let chunkStart = 0;
  let chunkWidth = 0;

  for (let i = 0; i < word.length; i++) {
    const w = widths[at + i];
    if (chunkWidth + w > maxWidth && i > chunkStart) {
      chunks.push(word.slice(chunkStart, i));
      chunkStart = i;
      chunkWidth = 0;
    }
    chunkWidth += w;
  }
  chunks.push(word.slice(chunkStart));

  return { chunks, lastWidth: chunkWidth };
}

/** Wrap one paragraph (no newlines) into width-limited lines, word by word. */
function wrapParagraph(
  paragraph: string,
  maxWidth: number,
  fontSize: number,
  bold: boolean,
  fontFamily: string,
): string[] {
  const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  // One WASM call for the whole paragraph, one for a single space — every
  // word width below is a slice-sum over these, not a fresh call.
  const widths = charWidths(paragraph, fontSize, bold, fontFamily);
  const spaceWidth = charWidths(" ", fontSize, bold, fontFamily)[0];

  const lines: string[] = [];
  let searchFrom = 0; // resume point for locating each word inside `paragraph`
  let current = "";
  let currentWidth = 0;

  for (const word of words) {
    const at = paragraph.indexOf(word, searchFrom);
    searchFrom = at + word.length;
    const wordWidth = sum(widths, at, at + word.length);

    if (!current) {
      const { chunks, lastWidth } = chunkWordByWidth(word, at, widths, maxWidth);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1];
      currentWidth = lastWidth;
    } else if (currentWidth + spaceWidth + wordWidth <= maxWidth) {
      current += " " + word;
      currentWidth += spaceWidth + wordWidth;
    } else {
      lines.push(current);
      const { chunks, lastWidth } = chunkWordByWidth(word, at, widths, maxWidth);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1];
      currentWidth = lastWidth;
    }
  }
  if (current) lines.push(current);

  return lines;
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/** Break content into lines that fit within maxWidth. Respects `\n`. */
export function wrapLines(
  content: string,
  maxWidth: number,
  fontSize: number,
  bold = false,
  fontFamily = DEFAULT_FONT,
): string[] {
  const result: string[] = [];

  for (const paragraph of content.split("\n")) {
    if (paragraph.trim() === "") {
      result.push("");
      continue;
    }
    result.push(...wrapParagraph(paragraph, maxWidth, fontSize, bold, fontFamily));
  }

  return result.length > 0 ? result : [""];
}

/** Measure the rendered width of a single line of text */
export function estimateLineWidth(
  line: string,
  fontSize: number,
  bold = false,
  fontFamily = DEFAULT_FONT,
): number {
  const widths = charWidths(line, fontSize, bold, fontFamily);
  return sum(widths, 0, widths.length);
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
  fontFamily = DEFAULT_FONT,
): number {
  return wrapLines(content, maxWidth, fontSize, bold, fontFamily).length;
}

/** Estimated block height of a text string after wrapping */
export function estimateTextHeight(
  content: string,
  maxWidth: number,
  fontSize: number,
  lineHeight = 1.4,
  bold = false,
  fontFamily = DEFAULT_FONT,
): number {
  return estimateLineCount(content, maxWidth, fontSize, bold, fontFamily) * fontSize * lineHeight;
}
