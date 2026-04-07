/**
 * SaurioPDF — High-performance PDF generation for Deno, Node.js, Bun, and browsers.
 *
 * Powered by Krilla (Rust) compiled to WebAssembly.
 *
 * @example Auto-layout
 * ```ts
 * import { init, PDF, loadLiberationSans } from "./mod.ts";
 *
 * await init();
 * await loadLiberationSans();
 *
 * const pdf = new PDF({ title: "Invoice", margin: 50 });
 *
 * pdf.h1("Invoice #1234")
 *    .spacer(8)
 *    .p("Client: Acme Corp")
 *    .spacer(16)
 *    .table({
 *      headers: ["Product", "Qty", "Total"],
 *      rows:    [["Widget Pro", "2", "$100.00"]],
 *      striped: true,
 *    });
 *
 * await pdf.save("invoice.pdf");
 * ```
 *
 * @example Manual layout
 * ```ts
 * import { init, PDF, text, rect, circle } from "./mod.ts";
 *
 * await init();
 *
 * const pdf = new PDF({ title: "Manual" });
 * pdf.add(
 *   rect(0, 0, 595, 80).fill("#1a1a2e"),
 *   text("Hello").at(50, 30).size(28).bold().color("white"),
 *   circle(297, 400, 80).fill("steelblue").stroke("navy", 2),
 * );
 * await pdf.save("manual.pdf");
 * ```
 *
 * @module
 */

// ─── WASM ────────────────────────────────────────────────────────────────────

export { generatePdf, init, registerFont, testWasm, version } from "./src/wasm.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  Align,
  Buildable,
  ColorInput,
  HFContext,
  PaddingSpec,
  PageSizeName,
  PdfAMode,
  PDFOptions,
  SectionOptions,
  TableOptions,
} from "./src/types.ts";

export { PAGE_SIZES } from "./src/types.ts";

// ─── Element builders ────────────────────────────────────────────────────────

export {
  circle,
  CircleElement,
  image,
  ImageElement,
  imageSize,
  line,
  LineElement,
  link,
  LinkElement,
  path,
  PathElement,
  rect,
  RectElement,
  // Factory functions — the everyday API
  text,
  // Classes — for advanced use or subclassing
  TextElement,
  txt,
} from "./src/elements.ts";

export type { ImageDimensions } from "./src/types.ts";

// ─── Document ────────────────────────────────────────────────────────────────

export { PDF, quickPDF } from "./src/pdf.ts";

// ─── Font utilities ──────────────────────────────────────────────────────────

export {
  loadBuiltinFonts,
  loadFont,
  loadFonts,
  loadLiberationMono,
  loadLiberationSans,
} from "./lib/font-loader.ts";
export type { FontConfig } from "./lib/font-loader.ts";

export { Font } from "./src/fonts.ts";
export type { BuiltinFont } from "./src/fonts.ts";

// ─── Version ─────────────────────────────────────────────────────────────────

export const VERSION = "0.2.0";
