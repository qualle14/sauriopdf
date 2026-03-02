/**
 * Backward-compatibility shim.
 * New code should import from "./mod.ts" instead.
 *
 * @deprecated Use mod.ts
 */

export { init, generatePdf, registerFont } from "./src/wasm.ts";

export {
  TextElement, RectElement, CircleElement, LineElement, PathElement, ImageElement,
  text, txt, rect, circle, line, path, image,
} from "./src/elements.ts";

export { PDF, quickPDF } from "./src/pdf.ts";

export type { ColorInput, Align, TableOptions, Buildable } from "./src/types.ts";
