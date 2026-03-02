# SaurioPDF — Architecture & Design

For the skeptical developer who wants to understand what's actually happening before trusting a library with their PDFs.

---

## Why Rust/WASM instead of pure TypeScript?

PDF is a complex binary format. Pure-JS libraries (jsPDF, pdfmake, pdf-lib) implement the PDF spec themselves — font parsing, glyph encoding, content streams, compression, cross-reference tables. That's a lot of code to trust, and historically it shows: inconsistent kerning, broken Unicode, missing features, subtle rendering bugs.

SaurioPDF delegates all of that to [Krilla](https://github.com/LaurenzV/krilla), a Rust library that compiles to WebAssembly. Krilla handles the PDF spec correctly and is tested against real PDF viewers. We get correctness for free; our job is the TypeScript API on top.

The trade-off: a 4.2MB WASM binary. Downloaded once, cached by Deno/Node.

---

## What lives where

```
┌─────────────────────────────────────────────────────────┐
│  TypeScript (your code + SaurioPDF API)                 │
│                                                         │
│  PDF class     layout cursor, page breaks, wrapping     │
│  table.ts      decompose table → rects + text + lines   │
│  layout.ts     wrapLines(), alignmentOffset()           │
│  elements.ts   builder classes (text, rect, circle…)    │
│                                                         │
│  → JSON.stringify(document)                             │
└───────────────────┬─────────────────────────────────────┘
                    │ Uint8Array (JSON text)
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Rust/WASM (sauriopdf_core_bg.wasm)                     │
│                                                         │
│  generate_pdf()   deserialize JSON → ContentElements    │
│  document.rs      drive Krilla page-by-page             │
│  fonts.rs         load Liberation Sans (embedded)       │
│                                                         │
│  → Krilla renders: fonts, shapes, images, PDF spec      │
│  → returns PDF bytes                                    │
└─────────────────────────────────────────────────────────┘
                    │ Uint8Array (PDF binary)
                    ▼
              pdf.generate() → Uint8Array
```

**Key insight:** Rust never does layout. TypeScript never writes PDF bytes. The boundary between them is a JSON string.

---

## The JSON protocol

Every element type the TypeScript side can produce:

```json
{ "Text":  { "content": "Hello", "position": {"x": 72, "y": 100},
             "font_family": "Liberation Sans", "font_size": 11,
             "color": {"r": 17, "g": 17, "b": 17, "a": 1.0},
             "bold": false, "italic": false, "align": "Left", "max_width": null } }

{ "Shape": { "Rectangle": { "rect": {"x":0,"y":0,"width":595,"height":80},
             "fill_color": {"r":28,"g":62,"b":80,"a":1.0},
             "stroke_color": null, "stroke_width": 0, "border_radius": 0 } } }

{ "Shape": { "Line":   { "start":{"x":72,"y":200}, "end":{"x":523,"y":200},
                          "color": {"r":204,"g":204,"b":204,"a":1.0}, "width": 0.75 } } }

{ "Shape": { "Circle": { "center":{"x":297,"y":400}, "radius":60,
                          "fill_color": {...}, "stroke_color": null, "stroke_width":0 } } }

{ "Shape": { "Path":   { "points":[{"x":50,"y":100},{"x":200,"y":100}],
                          "fill_color": null, "stroke_color": {...},
                          "stroke_width": 1, "closed": true } } }

{ "Image": { "data": [137,80,78,71,...], "position":{"x":72,"y":300},
             "width": 200, "height": 150, "format": "Png" } }

{ "Link":  { "url": "https://example.com",
             "rect": {"x":72,"y":450,"width":120,"height":18}, "text": null } }
```

The full document envelope:

```json
{
  "config": {
    "page_size": "A4",
    "orientation": "Portrait",
    "margin": { "top": 72, "right": 72, "bottom": 72, "left": 72 },
    "metadata": { "title": "...", "author": "...", "subject": "", "keywords": [],
                  "creator": "SaurioPDF", "producer": "SaurioPDF/Krilla" },
    "compress": true,
    "pdf_version": "1.7",
    "pdfa": null
  },
  "pages": [
    {
      "dimensions": { "width": 595, "height": 842 },
      "content": [ ...elements ]
    }
  ]
}
```

---

## Text wrapping — why it's done in TypeScript

Krilla's `draw_text()` draws a string at a single point. No wrapping, no alignment — just a baseline position. This is correct behavior for a low-level renderer.

So every multi-line paragraph becomes multiple `draw_text` calls, one per line, with x/y already computed:

```
"The quick brown fox jumps over the lazy dog. Pack my box..."
  → wrapLines(text, maxWidth=451, fontSize=11)
  → ["The quick brown fox jumps over the", "lazy dog. Pack my box..."]
  → Text element at (72, 100) → "The quick brown fox jumps over the"
  → Text element at (72, 115.4) → "lazy dog. Pack my box..."
```

For alignment (Center, Right), an x-offset is computed per line:

```
line = "Centered"
lineWidth = estimateLineWidth("Centered", 11) ≈ 45pt
offset = (contentWidth - lineWidth) / 2 ≈ 203pt
→ Text element at (72 + 203, y)
```

The estimation uses average character widths (`fontSize × 0.52` for regular, `× 0.58` for bold). Not pixel-perfect, but accurate enough for layout decisions — and Krilla handles the actual glyph placement.

---

## Tables

Tables don't exist in the Krilla API. They're entirely synthesized in TypeScript:

```
table({ headers, rows, widths, striped, borders })
  ↓
buildTableElements()  (src/table.ts)
  ↓
  ├── for each header cell → Text elements
  ├── for each row         → optional rect (striped bg) + Text elements per cell
  └── if borders           → outer rect + horizontal lines + vertical lines
  ↓
[...RawElement]  — flat list of primitives sent to Rust
```

Row heights are dynamic: computed by wrapping each cell's text and taking the maximum line count across the row. This means a cell with long content makes the entire row taller, which is the correct behavior.

---

## Coordinate system

- Origin (0, 0) is the **top-left** of the page
- Y increases **downward**
- Unit is **points** (1pt = 1/72 inch)
- Coordinates are **absolute** — not relative to margins
- A4 page: 595 × 842 pt

The layout cursor starts at `margin.top` and advances downward. Elements are placed at absolute coordinates — the cursor is purely a TypeScript concept.

---

## Font subsetting

Liberation Sans (Regular, Bold, Italic, Bold Italic) is compiled into the WASM binary via Rust's `include_bytes!` macro. Users never deal with font files.

Subsetting is automatic — Krilla tracks every glyph drawn during rendering, then on `document.finish()` it calls the `subsetter` crate to strip unused glyphs before embedding. A document using 40 distinct characters embeds ~40 glyphs worth of font data, not 1800.

This happens entirely inside Krilla. No TypeScript-side character tracking needed.

---

## Links (two-pass rendering)

Krilla separates page content from annotations. Links can't be part of the surface drawing pass — they must be added as page-level annotations afterward. So Rust does two passes per page:

```rust
// Pass 1: draw everything except links
let mut surface = pdf_page.surface();
for element in &page.content {
    if !matches!(element, ContentElement::Link(_)) {
        render_element(&mut surface, element)?;
    }
}
surface.finish();

// Pass 2: add link annotations
for element in &page.content {
    if let ContentElement::Link(link) = element {
        pdf_page.add_annotation(LinkAnnotation::new(...));
    }
}
```

---

## Headers and footers

Header/footer callbacks run after all content pages are committed — this is the only way `totalPages` can be known at the time the header/footer renders.

```
pdf.h1("...").p("...").table(...)...
  → content accumulates in this._current
  → _commitPage() called for each full page

pdf.generate()
  → commits last page
  → totalPages = this._pages.length  ← now we know this
  → for each page: run headerFn(ctx) and footerFn(ctx), collect elements
  → inject header elements at page start (prepend)
  → inject footer elements at page end (append, shifted to bottom)
  → serialize everything to JSON
```

---

## Sections

`pdf.section()` creates a sub-PDF instance with the same page dimensions but with an adjusted top margin (= current cursor position + padding) and an infinite page height so it never triggers a page break internally. After the callback runs, all elements from the sub-PDF's current page are collected and injected into the parent page — they're already in absolute page coordinates because the sub-PDF's margin matches the parent's coordinate space.

---

## Build pipeline

For contributors only — users get the pre-built WASM from JSR/npm.

```
rust-core/src/      ← Rust source
    ↓ cargo build --target wasm32-unknown-unknown --release
rust-core/target/wasm32-unknown-unknown/release/sauriopdf_core.wasm
    ↓ wasm-bindgen --out-dir ../wasm --target web
wasm/
    sauriopdf_core.js          ← JS bindings (import this)
    sauriopdf_core.d.ts        ← TypeScript types
    sauriopdf_core_bg.wasm     ← the actual compiled binary (committed)
    sauriopdf_core_bg.wasm.d.ts
```

```bash
cargo install wasm-bindgen-cli
deno task build:wasm   # runs both steps
deno task test         # 30 unit tests
deno task demo         # generates output.pdf
```

### npm / Node.js build

```
TypeScript source (src/, lib/, mod.ts)
    ↓ tsc --project tsconfig.npm.json     (requires TS ≥ 5.7)
dist/
    mod.js + mod.d.ts                     ← package entry
    src/wasm.js                           ← Node.js-aware WASM loader
    src/pdf.js, src/elements.js, …
    lib/font-loader.js
    wasm/                                 ← WASM binary copied here by build script
```

```bash
npm run build:ts    # TypeScript → dist/ + copies wasm/ → dist/wasm/
npm run build       # build:wasm + build:ts (needs Rust toolchain)
```

**Node.js WASM loading**: `wasm-bindgen --target web` generates code that calls
`fetch(new URL('...bg.wasm', import.meta.url))`. Node.js 18+ `fetch()` doesn't
support `file://` URLs. `src/wasm.ts` detects Node.js at runtime and reads the
`.wasm` file with `fs.readFileSync`, passing the `Buffer` (a `Uint8Array` subclass)
directly to `wasmInit()`. Deno and browsers still use the default URL-based path.

---

## Why not wasm-pack?

`wasm-pack` bundles for npm by default. We need Deno-first with a `--target web` output so `import.meta.url` resolves the WASM correctly in both Deno (file://) and browsers (https://). Doing `cargo build` + `wasm-bindgen` manually gives us that control without wasm-pack's opinionated bundling.

---

## What's not implemented

- **Custom fonts beyond Liberation Sans** — works via `loadFont()`, but the TypeScript layout engine's width estimates are calibrated for Liberation Sans. Other fonts may wrap differently.
- **Right-to-left text** — Krilla supports `TextDirection::Auto` which handles RTL scripts at the glyph level, but the line-breaking logic in TypeScript is LTR-only.
- **Images as base64** — image data is sent as a JSON array of integers. Large images are expensive to serialize. A future improvement would be to pass image data as a separate binary buffer outside of JSON.
- **Table cell spanning** — colspan/rowspan not implemented. Tables are strictly a grid.
- **Actual border radius** — the `radius` field on sections and rects exists in the API but Krilla renders rectangles with straight corners currently.
