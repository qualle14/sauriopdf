/**
 * PDF element builders — barrel re-export.
 *
 * Each class under src/elements/ is a fluent builder that produces a
 * RawElement (the JSON structure Krilla/Rust expects). Factory functions
 * provide the ergonomic entry points.
 *
 * Rule: builders are immutable-ish — every method mutates `this` and returns
 * `this` for chaining. Call `.build()` to get the raw JSON, or pass the
 * builder directly to `pdf.add()` which calls `.build()` automatically.
 */

export { text, TextElement, txt } from "./elements/text.ts";
export { rect, RectElement } from "./elements/rect.ts";
export { circle, CircleElement } from "./elements/circle.ts";
export { line, LineElement } from "./elements/line.ts";
export { path, PathElement } from "./elements/path.ts";
export { image, imageSize, ImageElement } from "./elements/image.ts";
export { link, LinkElement } from "./elements/link.ts";
