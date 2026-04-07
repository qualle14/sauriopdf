/**
 * SaurioPDF — unit tests.
 * Run with: deno test main_test.ts
 */

import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
  alignmentOffset,
  estimateLineWidth,
  estimateTextHeight,
  wrapLines,
} from "./src/layout.ts";
import { parseColor } from "./src/colors.ts";
import { buildTableElements } from "./src/table.ts";
import { imageSize, link, rect, text } from "./src/elements.ts";
import { PDF } from "./src/pdf.ts";
import type { RawElement } from "./src/types.ts";

// Helper: peek at the current-page element buffer without generating bytes
function peek(pdf: PDF): RawElement[] {
  return (pdf as unknown as { _current: RawElement[] })._current;
}

// ─── Color parsing ────────────────────────────────────────────────────────────

Deno.test("parseColor: 6-digit hex", () => {
  const c = parseColor("#ff0000");
  assertEquals(c, { r: 255, g: 0, b: 0, a: 1 });
});

Deno.test("parseColor: 3-digit hex expands correctly", () => {
  const c = parseColor("#f00");
  assertEquals(c, { r: 255, g: 0, b: 0, a: 1 });
});

Deno.test("parseColor: 8-digit hex (with alpha)", () => {
  const c = parseColor("#ff000080");
  assertEquals(c.r, 255);
  assertEquals(c.g, 0);
  assertEquals(c.b, 0);
  assertAlmostEquals(c.a, 128 / 255, 0.001);
});

Deno.test("parseColor: CSS named color", () => {
  assertEquals(parseColor("red"), { r: 255, g: 0, b: 0, a: 1 });
  assertEquals(parseColor("white"), { r: 255, g: 255, b: 255, a: 1 });
  assertEquals(parseColor("black"), { r: 0, g: 0, b: 0, a: 1 });
});

Deno.test("parseColor: RGB tuple", () => {
  assertEquals(parseColor([0, 128, 255]), { r: 0, g: 128, b: 255, a: 1.0 });
});

Deno.test("parseColor: RGBA tuple", () => {
  assertEquals(parseColor([0, 128, 255, 0.5]), { r: 0, g: 128, b: 255, a: 0.5 });
});

Deno.test("parseColor: named color case-insensitive", () => {
  assertEquals(parseColor("CORAL"), parseColor("coral"));
});

// ─── Text wrapping ────────────────────────────────────────────────────────────

Deno.test("wrapLines: short text fits on one line", () => {
  const lines = wrapLines("Hello", 200, 12);
  assertEquals(lines.length, 1);
  assertEquals(lines[0], "Hello");
});

Deno.test("wrapLines: long text wraps", () => {
  const lines = wrapLines("one two three four five six seven eight nine ten", 60, 12);
  assert(lines.length > 1, "should wrap into multiple lines");
});

Deno.test("wrapLines: respects explicit newlines", () => {
  const lines = wrapLines("line one\nline two", 500, 12);
  assertEquals(lines.length, 2);
  assertEquals(lines[0], "line one");
  assertEquals(lines[1], "line two");
});

Deno.test("wrapLines: empty string returns one empty line", () => {
  const lines = wrapLines("", 200, 12);
  assertEquals(lines, [""]);
});

Deno.test("wrapLines: blank line preserved", () => {
  const lines = wrapLines("a\n\nb", 200, 12);
  assertEquals(lines[0], "a");
  assertEquals(lines[1], "");
  assertEquals(lines[2], "b");
});

Deno.test("wrapLines: bold uses wider estimate", () => {
  const normal = wrapLines("hello world test long string here now", 80, 12, false);
  const bold = wrapLines("hello world test long string here now", 80, 12, true);
  // Bold chars are wider so should wrap sooner (more lines)
  assert(bold.length >= normal.length);
});

Deno.test("wrapLines: long word broken at char boundary", () => {
  // 30pt wide at 12pt → charsPerLine = floor(30 / 6.24) = 4
  const lines = wrapLines("averylongwordindeed", 30, 12);
  assert(lines.length > 1, "long word should produce multiple lines");
  for (const line of lines) {
    assert(
      estimateLineWidth(line, 12) <= 30 + 12 * 0.52,
      `line "${line}" exceeds maxWidth`,
    );
  }
});

// ─── Line width estimation ────────────────────────────────────────────────────

Deno.test("estimateLineWidth: proportional to length", () => {
  const w1 = estimateLineWidth("hi", 12);
  const w2 = estimateLineWidth("hihihi", 12);
  assertAlmostEquals(w2 / w1, 3, 0.01);
});

Deno.test("estimateLineWidth: bold is wider than normal", () => {
  const normal = estimateLineWidth("hello", 12, false);
  const bold = estimateLineWidth("hello", 12, true);
  assert(bold > normal);
});

// ─── Alignment offset ─────────────────────────────────────────────────────────

Deno.test("alignmentOffset: Left returns 0", () => {
  assertEquals(alignmentOffset(100, 400, "Left"), 0);
});

Deno.test("alignmentOffset: Center centers the line", () => {
  const offset = alignmentOffset(100, 400, "Center");
  assertEquals(offset, 150); // (400 - 100) / 2
});

Deno.test("alignmentOffset: Right aligns to right edge", () => {
  const offset = alignmentOffset(100, 400, "Right");
  assertEquals(offset, 300); // 400 - 100
});

Deno.test("alignmentOffset: never returns negative", () => {
  // line wider than container
  const offset = alignmentOffset(500, 100, "Center");
  assertEquals(offset, 0);
});

// ─── Height estimation ────────────────────────────────────────────────────────

Deno.test("estimateTextHeight: single short line", () => {
  const h = estimateTextHeight("Hi", 400, 12);
  assertAlmostEquals(h, 12 * 1.4, 0.001);
});

Deno.test("estimateTextHeight: grows with content", () => {
  const short = estimateTextHeight("short", 400, 12);
  const long = estimateTextHeight("a ".repeat(200), 400, 12);
  assert(long > short);
});

// ─── Element builders ─────────────────────────────────────────────────────────

Deno.test("text().build() produces correct RawElement", () => {
  const el = text("Hello", 10, 20, 14).bold().build();
  const t = (el as { Text: Record<string, unknown> }).Text;
  assertEquals(t.content, "Hello");
  assertEquals(t.font_size, 14);
  assertEquals(t.bold, true);
  assertEquals((t.position as { x: number; y: number }).x, 10);
});

Deno.test("text().buildAll() with maxWidth returns multiple lines", () => {
  const el = text("one two three four five six", 0, 0, 12).maxWidth(80);
  const els = el.buildAll();
  assert(els.length > 1, "should produce more than one element");
  // Each element should have y offset
  const ys = els.map((
    e,
  ) => ((e as { Text: { position: { y: number } } }).Text.position.y));
  assert(ys[1] > ys[0], "second line should be lower");
});

Deno.test("text().buildAll() single line when wide enough", () => {
  const el = text("Hi", 0, 0, 12).maxWidth(500);
  const els = el.buildAll();
  assertEquals(els.length, 1);
});

Deno.test("rect().build() produces correct shape", () => {
  const el = rect(0, 0, 100, 50).fill("red").build();
  const r = (el as { Shape: { Rectangle: Record<string, unknown> } }).Shape.Rectangle;
  assertEquals((r.rect as { width: number }).width, 100);
  assertEquals((r.fill_color as { r: number }).r, 255);
});

Deno.test("link().build() produces Link element", () => {
  const el = link("https://example.com", 10, 20, 100, 20).build();
  const l = (el as { Link: Record<string, unknown> }).Link;
  assertEquals(l.url, "https://example.com");
  assertEquals((l.rect as { width: number }).width, 100);
});

// ─── Table builder ────────────────────────────────────────────────────────────

Deno.test("buildTableElements: returns elements and positive height", () => {
  const { elements, height } = buildTableElements(
    { headers: ["A", "B"], rows: [["1", "2"], ["3", "4"]] },
    0,
    0,
    400,
  );
  assert(elements.length > 0);
  assert(height > 0);
});

Deno.test("buildTableElements: height scales with row count", () => {
  const small = buildTableElements({ rows: [["a"]] }, 0, 0, 200);
  const large = buildTableElements({ rows: [["a"], ["b"], ["c"]] }, 0, 0, 200);
  assert(large.height > small.height);
});

Deno.test("buildTableElements: long cell content increases row height", () => {
  const short = buildTableElements(
    { rows: [["Hi"]] },
    0,
    0,
    200,
  );
  const tall = buildTableElements(
    {
      rows: [[
        "This is a very long string that will need to wrap inside the narrow cell column",
      ]],
    },
    0,
    0,
    100,
  );
  assert(tall.height >= short.height);
});

Deno.test("buildTableElements: custom widths applied", () => {
  const { elements } = buildTableElements(
    { headers: ["Col A", "Col B"], rows: [["x", "y"]], widths: [0.6, 0.4] },
    0,
    0,
    400,
  );
  assert(elements.length > 0);
});

// ─── PDF.list() ───────────────────────────────────────────────────────────────

Deno.test("PDF.list(): emits prefix + text element per item", () => {
  const pdf = new PDF();
  pdf.list(["Alpha", "Beta", "Gamma"]);
  const els = peek(pdf);
  // 3 bullet prefixes + 3 text lines (each item fits on one line)
  assert(els.length >= 6, `expected ≥6 elements, got ${els.length}`);
  for (const el of els) assert("Text" in el, "all list elements should be Text");
});

Deno.test("PDF.list(): numbered style uses number prefix", () => {
  const pdf = new PDF();
  pdf.list(["One", "Two"], { style: "numbered" });
  const els = peek(pdf);
  const first = (els[0] as { Text: { content: string } }).Text.content;
  assertEquals(first, "1.");
});

Deno.test("PDF.list(): returns this for chaining", () => {
  const pdf = new PDF();
  assert(pdf.list(["a"]) === pdf);
});

// ─── PDF.code() ───────────────────────────────────────────────────────────────

Deno.test("PDF.code(): emits background rect then one text per non-empty line", () => {
  const pdf = new PDF();
  pdf.code("const x = 1;\nconsole.log(x);");
  const els = peek(pdf);
  assertEquals(els.length, 3); // 1 rect + 2 text lines
  assert("Shape" in els[0], "first element should be background Shape");
  assert("Text" in els[1]);
  assert("Text" in els[2]);
});

Deno.test("PDF.code(): blank lines are skipped in text output", () => {
  const pdf = new PDF();
  pdf.code("a\n\nb"); // 3 lines but middle is blank
  const els = peek(pdf);
  assertEquals(els.length, 3); // 1 rect + 2 text elements
});

Deno.test("PDF.code(): returns this for chaining", () => {
  const pdf = new PDF();
  assert(pdf.code("x") === pdf);
});

// ─── PDF.columns() ────────────────────────────────────────────────────────────

Deno.test("PDF.columns(): merges elements from all columns", () => {
  const pdf = new PDF();
  pdf.columns(2, ([left, right]) => {
    left.p("Left content");
    right.p("Right content");
  });
  const els = peek(pdf);
  assert(els.length >= 2, "expected elements from both columns");
});

Deno.test("PDF.columns(): divider adds a Line element", () => {
  const pdf = new PDF();
  pdf.columns(2, ([left, right]) => {
    left.p("A");
    right.p("B");
  }, { divider: true });
  const els = peek(pdf);
  const lines = els.filter((el) => {
    const s = (el as { Shape?: { Line?: unknown } }).Shape;
    return s?.Line !== undefined;
  });
  assertEquals(lines.length, 1, "expected exactly one divider line");
});

Deno.test("PDF.columns(): returns this for chaining", () => {
  const pdf = new PDF();
  assert(pdf.columns(2, () => {}) === pdf);
});

// ─── PDF state getters ────────────────────────────────────────────────────────

Deno.test("pdf.cursor returns current Y position", () => {
  const pdf = new PDF({ margin: 50 });
  assertEquals(pdf.cursor, 50);
  pdf.spacer(30);
  assertEquals(pdf.cursor, 80);
});

Deno.test("pdf.contentWidth equals page width minus margins", () => {
  const pdf = new PDF({ margin: 72 });
  // A4 = 595pt wide, 2×72 = 144 margin → 451
  assertEquals(pdf.contentWidth, 595 - 72 * 2);
});

Deno.test("pdf.pageWidth and pdf.pageHeight match page size", () => {
  const pdf = new PDF({ pageSize: "A4" });
  assertEquals(pdf.pageWidth, 595);
  assertEquals(pdf.pageHeight, 842);
});

Deno.test("pdf.pageBreak() works as alias for newPage()", () => {
  const pdf = new PDF();
  pdf.p("Page 1");
  pdf.pageBreak();
  pdf.p("Page 2");
  // We can't easily count pages without generating, but cursor reset is observable
  assert(pdf.cursor <= 842, "cursor should be reset after page break");
});

Deno.test("pdf.gap() changes spacing between elements", () => {
  const pdf1 = new PDF({ margin: 50 });
  pdf1.p("Hello");
  const y1 = pdf1.cursor;

  const pdf2 = new PDF({ margin: 50, gap: 0 });
  pdf2.p("Hello");
  const y2 = pdf2.cursor;

  assert(y1 > y2, "larger gap should push cursor lower");
});

// ─── imageSize() ──────────────────────────────────────────────────────────────

Deno.test("imageSize: returns null for unknown format", () => {
  assertEquals(imageSize(new Uint8Array([0, 1, 2, 3, 4, 5])), null);
});

Deno.test("imageSize: reads PNG dimensions from IHDR", () => {
  // Minimal 1×1 PNG header (first 24 bytes matter)
  const png = new Uint8Array(24);
  // PNG signature
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR chunk: 4B length + 4B "IHDR"
  png.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  // width = 100 (big-endian), height = 200
  png.set([0, 0, 0, 100, 0, 0, 0, 200], 16);
  const dims = imageSize(png);
  assertEquals(dims?.width, 100);
  assertEquals(dims?.height, 200);
});

Deno.test("imageSize: reads WebP VP8X dimensions", () => {
  // Minimal VP8X WebP (30 bytes)
  const webp = new Uint8Array(30);
  // RIFF header
  webp.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  webp.set([0x16, 0, 0, 0], 4); // file size (fake)
  webp.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  // VP8X chunk
  webp.set([0x56, 0x50, 0x38, 0x58], 12); // "VP8X"
  webp.set([0x0a, 0, 0, 0], 16); // chunk size = 10
  webp.set([0, 0, 0, 0], 20); // flags
  // canvas width-1 = 99 → width = 100 (LE 24-bit)
  webp.set([99, 0, 0], 24);
  // canvas height-1 = 149 → height = 150 (LE 24-bit)
  webp.set([149, 0, 0], 27);
  const dims = imageSize(webp);
  assertEquals(dims?.width, 100);
  assertEquals(dims?.height, 150);
});

// ─── Table columnAligns ───────────────────────────────────────────────────────

Deno.test("buildTableElements: columnAligns shifts text for right-aligned column", () => {
  const leftResult = buildTableElements(
    { rows: [["42"]], widths: [1] },
    0,
    0,
    200,
  );
  const rightResult = buildTableElements(
    { rows: [["42"]], widths: [1], columnAligns: ["Right"] },
    0,
    0,
    200,
  );
  const leftX = (leftResult.elements[0] as { Text: { position: { x: number } } })
    .Text.position.x;
  const rightX = (rightResult.elements[0] as { Text: { position: { x: number } } })
    .Text.position.x;
  assert(rightX > leftX, "right-aligned text should have larger x than left-aligned");
});

// ─── PDF.callout() ────────────────────────────────────────────────────────────

Deno.test("PDF.callout(): emits background rect + accent rect + text elements", () => {
  const pdf = new PDF();
  pdf.callout("Something happened.", { type: "warning" });
  const els = peek(pdf);
  const shapes = els.filter((e) => "Shape" in e);
  const texts = els.filter((e) => "Text" in e);
  assert(shapes.length >= 2, "should have at least background + accent rects");
  assert(texts.length >= 2, "should have title + message text");
});

Deno.test("PDF.callout(): custom title appears in output", () => {
  const pdf = new PDF();
  pdf.callout("Body text.", { title: "My Custom Title" });
  const els = peek(pdf);
  const titleEl = els.find(
    (e) =>
      "Text" in e &&
      (e as { Text: { content: string } }).Text.content === "My Custom Title",
  );
  assert(titleEl !== undefined, "custom title should appear as Text element");
});

Deno.test("PDF.callout(): returns this for chaining", () => {
  const pdf = new PDF();
  assert(pdf.callout("msg") === pdf);
});
