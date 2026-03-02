/**
 * SaurioPDF — unit tests.
 * Run with: deno test main_test.ts
 */

import { assertEquals, assertAlmostEquals, assert } from "@std/assert";
import { wrapLines, estimateLineWidth, alignmentOffset, estimateTextHeight } from "./src/layout.ts";
import { parseColor } from "./src/colors.ts";
import { buildTableElements } from "./src/table.ts";
import { text, rect, link } from "./src/elements.ts";

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
  assertEquals(parseColor("red"),   { r: 255, g: 0, b: 0, a: 1 });
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
  const bold   = wrapLines("hello world test long string here now", 80, 12, true);
  // Bold chars are wider so should wrap sooner (more lines)
  assert(bold.length >= normal.length);
});

// ─── Line width estimation ────────────────────────────────────────────────────

Deno.test("estimateLineWidth: proportional to length", () => {
  const w1 = estimateLineWidth("hi", 12);
  const w2 = estimateLineWidth("hihihi", 12);
  assertAlmostEquals(w2 / w1, 3, 0.01);
});

Deno.test("estimateLineWidth: bold is wider than normal", () => {
  const normal = estimateLineWidth("hello", 12, false);
  const bold   = estimateLineWidth("hello", 12, true);
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
  const long  = estimateTextHeight("a ".repeat(200), 400, 12);
  assert(long > short);
});

// ─── Element builders ─────────────────────────────────────────────────────────

Deno.test("text().build() produces correct RawElement", () => {
  const el = text("Hello", 10, 20, 14).bold().build();
  const t  = (el as { Text: Record<string, unknown> }).Text;
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
  const ys = els.map((e) => ((e as { Text: { position: { y: number } } }).Text.position.y));
  assert(ys[1] > ys[0], "second line should be lower");
});

Deno.test("text().buildAll() single line when wide enough", () => {
  const el = text("Hi", 0, 0, 12).maxWidth(500);
  const els = el.buildAll();
  assertEquals(els.length, 1);
});

Deno.test("rect().build() produces correct shape", () => {
  const el = rect(0, 0, 100, 50).fill("red").build();
  const r  = (el as { Shape: { Rectangle: Record<string, unknown> } }).Shape.Rectangle;
  assertEquals((r.rect as { width: number }).width, 100);
  assertEquals((r.fill_color as { r: number }).r, 255);
});

Deno.test("link().build() produces Link element", () => {
  const el = link("https://example.com", 10, 20, 100, 20).build();
  const l  = (el as { Link: Record<string, unknown> }).Link;
  assertEquals(l.url, "https://example.com");
  assertEquals((l.rect as { width: number }).width, 100);
});

// ─── Table builder ────────────────────────────────────────────────────────────

Deno.test("buildTableElements: returns elements and positive height", () => {
  const { elements, height } = buildTableElements(
    { headers: ["A", "B"], rows: [["1", "2"], ["3", "4"]] },
    0, 0, 400,
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
    { rows: [["Hi"]] }, 0, 0, 200,
  );
  const tall = buildTableElements(
    { rows: [["This is a very long string that will need to wrap inside the narrow cell column"]] },
    0, 0, 100,
  );
  assert(tall.height >= short.height);
});

Deno.test("buildTableElements: custom widths applied", () => {
  const { elements } = buildTableElements(
    { headers: ["Col A", "Col B"], rows: [["x", "y"]], widths: [0.6, 0.4] },
    0, 0, 400,
  );
  assert(elements.length > 0);
});
