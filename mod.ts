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

export { init, generatePdf, registerFont, testWasm, version } from "./src/wasm.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  ColorInput,
  Align,
  Buildable,
  TableOptions,
  PDFOptions,
  PageSizeName,
  HFContext,
  SectionOptions,
  PdfAMode,
  PaddingSpec,
} from "./src/types.ts";

export { PAGE_SIZES } from "./src/types.ts";

// ─── Element builders ────────────────────────────────────────────────────────

export {
  // Classes — for advanced use or subclassing
  TextElement,
  RectElement,
  CircleElement,
  LineElement,
  PathElement,
  ImageElement,
  LinkElement,
  // Factory functions — the everyday API
  text,
  txt,
  rect,
  circle,
  line,
  path,
  image,
  link,
} from "./src/elements.ts";

// ─── Document ────────────────────────────────────────────────────────────────

export { PDF, quickPDF } from "./src/pdf.ts";

// ─── Font utilities ──────────────────────────────────────────────────────────

export { loadLiberationSans, loadFonts, loadFont } from "./lib/font-loader.ts";
export type { FontConfig } from "./lib/font-loader.ts";

// ─── Version ─────────────────────────────────────────────────────────────────

export const VERSION = "0.1.0";
