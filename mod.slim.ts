/**
 * SaurioPDF — slim build entry point (~2.5 MB WASM, no embedded fonts).
 *
 * Requires running `deno task build:wasm:slim` first.
 * You MUST load at least one font before generating PDFs:
 *
 * @example
 * ```ts
 * import { init, PDF, loadLiberationSans } from "./mod.slim.ts";
 *
 * await init();
 * await loadLiberationSans();
 *
 * const pdf = new PDF({ title: "Hello" });
 * pdf.h1("Hello World");
 * await pdf.save("out.pdf");
 * ```
 *
 * @module
 */

// ─── WASM (slim — no embedded fonts) ─────────────────────────────────────────

export { generatePdf, init, registerFont, testWasm, version } from "./src/wasm-slim.ts";

// ─── Everything else is identical to mod.ts ───────────────────────────────────

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
  text,
  TextElement,
  txt,
} from "./src/elements.ts";

export type { ImageDimensions } from "./src/types.ts";

export { PDF, quickPDF } from "./src/pdf.ts";

export {
  loadBuiltinFonts,
  loadFont,
  loadFonts,
  loadLiberationMono,
  loadLiberationSans,
} from "./lib/font-loader-slim.ts";
export type { FontConfig } from "./lib/font-loader-slim.ts";

export { Font } from "./src/fonts.ts";
export type { BuiltinFont } from "./src/fonts.ts";

export const VERSION = "0.2.0";
