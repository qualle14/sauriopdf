# SaurioPDF

High-performance PDF generation for **Deno, Node.js, Bun, and browsers** — powered by a
Rust/WebAssembly core ([Krilla](https://github.com/LaurenzV/krilla)).

- Auto-layout with wrapping, page breaks, tables, lists, code blocks, columns, callouts
- Liberation Sans + Mono embedded — zero font setup in the default build
- Font subsetting automatic — only glyphs actually used are embedded in the PDF
- PDF/A archival mode (1a–3u)
- Two builds: **full** (5.4 MB, fonts embedded) and **slim** (2.7 MB, load fonts at runtime)
- No Rust required — pre-built WASM included

---

## Install

**Deno / JSR**
```ts
import { init, PDF } from "jsr:@sauriopdf/core";
```

**Node.js / Bun** (≥ Node 18)
```bash
npm install sauriopdf
```
```ts
import { init, PDF } from "sauriopdf";
```

---

## Quick start

```ts
import { init, PDF } from "jsr:@sauriopdf/core";

await init();

const pdf = new PDF({ title: "Invoice #1042", margin: 60 });

pdf.header(40, (ctx) => {
  ctx.add(rect(0, 0, ctx.width, ctx.height).fill("#1a1a2e"));
  ctx.add(text("ACME CORP").at(24, 14).size(15).bold().color("white"));
});

pdf.footer(24, (ctx) => {
  ctx.add(
    text(`Page ${ctx.pageNum} of ${ctx.totalPages}`)
      .at(0, 8).size(9).color("gray").center().maxWidth(ctx.width),
  );
});

pdf
  .h1("Invoice #1042")
  .p("Due: March 31, 2026", { color: "slategray" })
  .spacer(12)
  .table({
    headers: ["Item", "Qty", "Unit", "Total"],
    rows: [
      ["Widget Pro",      "3", "$19.99", "$59.97"],
      ["Consulting (hr)", "2", "$150.00", "$300.00"],
    ],
    striped: true,
    columnAligns: ["Left", "Center", "Right", "Right"],
  })
  .spacer(8)
  .p("Total: $359.97", { bold: true, align: "Right", size: 13 });

await pdf.save("invoice.pdf");
```

---

## Architecture

```
TypeScript (layout engine)         Rust / WASM (renderer)
──────────────────────────         ──────────────────────
PDFBase                            Krilla 0.6
  └─ PDFLayout                       draw_text()
       └─ PDF                         draw_path()
                                      draw_image()
mod.ts          ─── JSON ──►          generate_pdf()
mod.slim.ts     ◄── bytes ───
```

All layout (cursor, text wrapping, alignment, tables, page breaks) happens in TypeScript.
Rust/Krilla only receives pre-positioned elements and handles font rendering, image embedding,
PDF serialization, and automatic font subsetting.

**Source layout**

```
src/
  pdf-base.ts    PDFBase — state, config, add/newPage/generate/save
  pdf-layout.ts  PDFLayout — h1–h4, p, list, code, table, img, callout…
  pdf.ts         PDF — section(), columns(), quickPDF()
  elements.ts    Element builders + imageSize()
  table.ts       buildTableElements() — decomposed into rects + lines + text
  layout.ts      wrapLines(), alignmentOffset(), estimateTextHeight()
  types.ts       All public + internal types; RawElement discriminated union
  colors.ts      parseColor() + 100+ CSS named colors
  fonts.ts       Font name constants
  wasm.ts        Full build WASM bootstrap
  wasm-slim.ts   Slim build WASM bootstrap
lib/
  font-loader.ts       Font loading — full build
  font-loader-slim.ts  Font loading — slim build
wasm/          Pre-built WASM with fonts embedded (5.4 MB)
wasm-slim/     Pre-built WASM without fonts (2.7 MB) — build with: deno task build:wasm:slim
fonts/         Liberation Sans + Mono TTF files
rust-core/     Rust source
```

---

## Builds

| Import | WASM | Fonts | When to use |
|---|---|---|---|
| `@sauriopdf/core` | 5.4 MB | Embedded | Default — zero setup |
| `@sauriopdf/core/slim` | 2.7 MB | Load at runtime | Browser bundle size matters |

```ts
// Slim build — load fonts once before generating
import { init, PDF, loadBuiltinFonts } from "@sauriopdf/core/slim";
await init();
await loadBuiltinFonts(); // resolves bundled font path automatically
```

---

## API reference

### `new PDF(opts?)`

| Option | Type | Default |
|---|---|---|
| `title` | `string` | `"Document"` |
| `author` | `string` | `"SaurioPDF"` |
| `subject` | `string` | `""` |
| `keywords` | `string[]` | `[]` |
| `pageSize` | `"A4" \| "A3" \| "A5" \| "Letter" \| "Legal" \| "Tabloid"` | `"A4"` |
| `orientation` | `"Portrait" \| "Landscape"` | `"Portrait"` |
| `margin` | `number \| { top, right, bottom, left }` | `72` (1 inch) |
| `gap` | `number` | `8` |
| `pdfa` | `"1a" \| "1b" \| "2a" \| "2b" \| "2u" \| "3a" \| "3b" \| "3u"` | — |

All options are also available as fluent methods:
```ts
pdf.title("My Doc").author("Alice").margins(50).gap(12).landscape().conformsTo("2b");
```

### Output

```ts
await pdf.save("output.pdf");          // write file (Deno / Node / Bun)
const bytes = await pdf.generate();    // Uint8Array (all runtimes + browser)
```

### State getters

```ts
pdf.cursor        // current Y position in points
pdf.contentWidth  // usable width between margins
pdf.pageWidth     // full page width
pdf.pageHeight    // full page height
```

Useful when mixing layout and manual mode.

### Layout methods

All return `this` for chaining. Cursor advances automatically. Page breaks trigger when content would overflow.

```ts
pdf.h1(text, opts?)   // 28pt bold
pdf.h2(text, opts?)   // 22pt bold
pdf.h3(text, opts?)   // 17pt bold
pdf.h4(text, opts?)   // 14pt bold

pdf.p(text, opts?)
// opts: { size?, color?, align?, bold?, italic?, lineHeight?, font? }

pdf.list(items, opts?)
// opts: { style?: "bullet"|"numbered", indent?, bullet?, size?, color?, lineHeight?, font? }

pdf.code(source, opts?)
// Monospaced block with background. Defaults to Liberation Mono.
// opts: { font?, size?, color?, background?, padding? }

pdf.callout(message, opts?)
// opts: { type?: "info"|"warning"|"error"|"success", title?, size?, padding? }

pdf.spacer(points = 16)
pdf.hr(opts?)          // opts: { color?, width? }
pdf.newPage()
pdf.pageBreak()        // alias for newPage()
pdf.gap(n)             // change default spacing between elements
```

### Table

```ts
pdf.table({
  headers?: string[],
  rows: string[][],
  widths?: number[],          // ≤1 = fraction of content width, >1 = points, omit = auto
  columnAligns?: Align[],     // "Left" | "Center" | "Right" | "Justify" per column
  striped?: boolean,
  borders?: boolean,          // default: true
  fontSize?: number,
  cellPadding?: number,
  headerBg?: ColorInput,
  headerColor?: ColorInput,
  stripedBg?: ColorInput,
  rowBg?: ColorInput,
  textColor?: ColorInput,
});
```

Row heights are dynamic — computed from wrapped cell content. Tables auto-paginate.

### Columns

```ts
pdf.columns(2, ([left, right]) => {
  left.h3("Left column").p("Some text.");
  right.h3("Right column").p("Other text.");
}, {
  widths?: number[],   // fractions or points; default: equal
  gap?: number,        // default: 16
  divider?: boolean | ColorInput,
});
```

### Section

```ts
pdf.section(
  { background?: ColorInput, borderColor?: ColorInput, padding?: number | PaddingSpec, radius?: number },
  (s) => { s.h3("Note").p("Content."); },
);
```

### Header / Footer

```ts
pdf.header(height, (ctx) => { ... });
pdf.footer(height, (ctx) => { ... });

// ctx: { pageNum, totalPages, width, height, add(...) }
// (0, 0) = top-left of the band
```

### Manual mode

```ts
import { text, rect, circle, line, path, image, link, Font } from "jsr:@sauriopdf/core";

pdf.add(
  rect(0, 0, 595, 80).fill("#1a1a2e"),
  text("Hello").at(50, 50).size(24).bold().color("white"),
  circle(297, 300, 60).fill("steelblue").stroke("navy", 2),
  line(50, 400, 545, 400).color("#ccc").width(0.75),
  link("https://example.com", 50, 450, 160, 18),
);
```

Mixes freely with layout mode.

### Element builders

**`text(content, x?, y?, size?)`**
`.at(x,y)` `.size(n)` `.bold()` `.italic()` `.underline()` `.strikethrough()`
`.color(c)` `.align("Left"|"Center"|"Right"|"Justify")` `.center()` `.right()` `.justify()`
`.maxWidth(n)` `.opacity(a)` `.font(name)`

**`rect(x, y, w, h)`** `.fill(c)` `.stroke(c, w?)` `.round(r?)` `.radius(r)`

**`circle(x, y, r)`** `.fill(c)` `.stroke(c, w?)`

**`line(x1, y1, x2, y2)`** `.color(c)` `.width(n)`

**`path(points)`** `.fill(c)` `.stroke(c, w?)` `.closed()` `.open()`

**`image(data)`** — PNG/JPEG/WebP auto-detected — `.at(x,y)` `.size(w,h)` `.fit(maxWidth)`

**`link(url, x, y, w, h)`** — clickable annotation overlay

**`imageSize(data)`** — returns `{ width, height } | null` from PNG/JPEG/WebP header bytes

### Font constants

```ts
import { Font } from "jsr:@sauriopdf/core";

text("Hello").font(Font.Sans)
text("Bold").font(Font.SansBold)
text("Code").font(Font.Mono)

// Available: Font.Sans, Font.SansBold, Font.SansItalic, Font.SansBoldItalic
//            Font.Mono, Font.MonoBold, Font.MonoItalic, Font.MonoBoldItalic
```

### Colors

```ts
type ColorInput =
  | string   // CSS name: "steelblue", "coral" — 100+ supported
  | string   // hex: "#rgb", "#rrggbb", "#rrggbbaa"
  | [r: number, g: number, b: number]
  | [r: number, g: number, b: number, a: number]  // a: 0.0–1.0
```

### Fonts

```ts
import { loadFont, loadFonts, loadLiberationSans, loadLiberationMono, loadBuiltinFonts } from "jsr:@sauriopdf/core";

// Load from a directory path or URL prefix
await loadLiberationSans("path/to/fonts");
await loadLiberationMono("https://cdn.example.com/fonts");

// Load all built-in fonts at their bundled path (slim build)
await loadBuiltinFonts();

// Custom font
await loadFont("MyFont", "./my-font.ttf");
await loadFonts([
  { name: "MyFont Regular", path: "./regular.ttf" },
  { name: "MyFont Bold",    path: "./bold.ttf" },
]);
```

---

## Contributing

Rust toolchain + `wasm-bindgen-cli` required to modify the WASM core.

```bash
cargo install wasm-bindgen-cli

deno task build:wasm        # full build → wasm/
deno task build:wasm:slim   # slim build → wasm-slim/
deno task test
deno task check
```

The pre-built WASM files are committed — users get them as-is from JSR/npm.

---

## License

Apache 2.0
