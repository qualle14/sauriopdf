# SaurioPDF

High-performance PDF generation for **Deno, Node.js, Bun, and browsers** — powered by a Rust/WebAssembly core ([Krilla](https://github.com/LaurenzV/krilla)).

- Rust-quality rendering, TypeScript-friendly API
- Auto-layout with wrapping, page breaks, tables, sections, headers, footers
- Liberation Sans embedded — zero font setup required
- Font subsetting automatic — only used glyphs embedded in the PDF
- PDF/A archival mode (1b, 2b, 2u, 3b, 3u)
- No Rust required — pre-built WASM included

---

## Install

**Deno / JSR**
```ts
import { init, PDF } from "jsr:@sauriopdf/core";
```

**Node.js / Bun** (requires Node.js ≥ 18)
```bash
npm install sauriopdf
```
```ts
import { init, PDF } from "sauriopdf";

await init(); // loads the pre-built WASM — reads the .wasm file directly, no fetch needed
```

---

## Quick start

```ts
import { init, PDF } from "jsr:@sauriopdf/core";

await init(); // loads the pre-built WASM — no Rust needed

const pdf = new PDF({ title: "Invoice", author: "Acme Corp" });

pdf
  .h1("Invoice #1042")
  .spacer(8)
  .p("Due: March 31, 2026", { color: "slategray" })
  .spacer(16)
  .table({
    headers: ["Item", "Qty", "Total"],
    rows: [
      ["Widget Pro", "3", "$59.97"],
      ["Gadget Plus", "1", "$49.00"],
    ],
    striped: true,
  })
  .spacer(16)
  .p("Thank you for your business.", { align: "Right", color: "steelblue" });

await pdf.save("invoice.pdf");
```

---

## API

### `new PDF(opts?)`

| Option | Type | Default |
|--------|------|---------|
| `title` | `string` | `"Document"` |
| `author` | `string` | `"SaurioPDF"` |
| `subject` | `string` | `""` |
| `keywords` | `string[]` | `[]` |
| `pageSize` | `"A4" \| "A3" \| "A5" \| "Letter" \| "Legal" \| "Tabloid"` | `"A4"` |
| `orientation` | `"Portrait" \| "Landscape"` | `"Portrait"` |
| `margin` | `number \| { top, right, bottom, left }` | `72` (1 inch) |
| `pdfa` | `"1b" \| "2b" \| "2u" \| "3b" \| "3u"` | — |

### Layout methods (auto-cursor)

```ts
pdf.h1(text, opts?)          // 28pt bold
pdf.h2(text, opts?)          // 22pt bold
pdf.h3(text, opts?)          // 17pt bold
pdf.h4(text, opts?)          // 14pt bold

pdf.p(text, opts?)           // paragraph — wraps, aligns, paginates
// opts: { size?, color?, align?, bold?, italic?, lineHeight?, font? }

pdf.spacer(points = 16)      // vertical gap
pdf.hr(opts?)                // horizontal rule — opts: { color?, width? }
pdf.table(TableOptions)      // see below
pdf.img(data, opts?)         // Uint8Array — opts: { width?, height? }
pdf.section(opts, fn)        // boxed section — see below
pdf.newPage()                // force page break
```

### Table

```ts
pdf.table({
  headers: ["Name", "Price"],          // optional header row
  rows: [["Widget", "$9.99"]],
  widths: [0.6, 0.4],                  // fractions of content width; omit for auto
  striped: true,                       // alternate row backgrounds
  borders: true,                       // grid lines (default: true)
  fontSize: 11,
  cellPadding: 6,
  headerBg: "#1a1a2e",
  headerColor: "#ffffff",
  stripedBg: "#f4f6f8",
  textColor: "#111111",
});
```

Row heights are computed dynamically from wrapped cell content — no fixed height needed.

### Section

```ts
pdf.section(
  { background: "#f0f4ff", borderColor: "#93c5fd", padding: 16 },
  (s) => {
    s.h3("Note").p("Sections support all layout methods.");
  }
);
```

`padding` accepts a number (uniform) or `{ top, right, bottom, left }`.

### Header / Footer

```ts
pdf.header(36, (ctx) => {
  ctx.add(rect(0, 0, ctx.width, ctx.height).fill("#1a1a2e"));
  ctx.add(text("My Report").at(24, 24).size(13).bold().color("white"));
});

pdf.footer(24, (ctx) => {
  ctx.add(
    text(`Page ${ctx.pageNum} of ${ctx.totalPages}`)
      .at(0, 8).size(9).color("gray").align("Center").maxWidth(ctx.width)
  );
});
```

`ctx.pageNum` and `ctx.totalPages` are always correct — headers/footers are injected after all pages are committed.

### PDF/A

```ts
const pdf = new PDF({ pdfa: "2b" });
// or fluent:
pdf.conformsTo("2b");
```

### Manual mode

Add elements at explicit coordinates with `pdf.add()`:

```ts
import { text, rect, circle, line, path, image, link } from "jsr:@sauriopdf/core";

pdf.add(
  rect(0, 0, 595, 80).fill("#1a1a2e"),
  text("Hello").at(50, 50).size(24).bold().color("white"),
  circle(297, 300, 60).fill("steelblue").stroke("navy", 2),
  line(50, 400, 545, 400).color("#cccccc").width(0.75),
  link("https://example.com", 50, 450, 200, 20),
);
```

Both modes can be mixed freely on the same page.

### Element builder API

**`text(content, x?, y?, size?)`**
`.at(x,y)` `.size(n)` `.bold()` `.italic()` `.color(c)` `.align("Left"|"Center"|"Right")` `.maxWidth(n)` `.opacity(a)` `.font(name)`

**`rect(x, y, w, h, opts?)`**
`.fill(color)` `.stroke(color, width?)` `.round(radius?)`

**`circle(x, y, r, opts?)`**
`.fill(color)` `.stroke(color, width?)`

**`line(x1, y1, x2, y2, opts?)`**
`.color(c)` `.width(n)`

**`path(points, opts?)`**
`.fill(c)` `.stroke(c, w?)` `.closed(bool)` `.open()`

**`image(data, opts?)`** — Uint8Array (PNG/JPEG/WebP auto-detected)
`.at(x,y)` `.size(w,h)` `.width(n)` `.height(n)`

**`link(url, x, y, w, h)`** — clickable annotation overlay

### Colors

Accepts any of: `"steelblue"`, `"#1a1a2e"`, `"#fff"`, `"#rrggbbaa"`, `[r, g, b]`, `[r, g, b, a]`

100+ CSS named colors supported.

### Output

```ts
await pdf.save("output.pdf");          // Deno — writes file
const bytes = await pdf.generate();   // any runtime — returns Uint8Array
```

### Fonts

Liberation Sans (Regular, Bold, Italic, Bold Italic) is embedded — always available, no setup.
Font subsetting is automatic — Krilla only embeds the glyphs your document actually uses.

To load fonts from a custom path or add other fonts:

```ts
import { loadLiberationSans, loadFont } from "jsr:@sauriopdf/core";

await loadLiberationSans("path/to/fonts/dir");    // Deno / Node / Bun / Browser
await loadFont("MyFont", normalBytes, boldBytes); // custom font from Uint8Array
```

---

## Contributing

To modify the Rust/WASM core you need: Rust toolchain + `wasm-bindgen-cli`.

```bash
cargo install wasm-bindgen-cli

# After editing rust-core/src/:
deno task build:wasm

# Tests
deno task test
```

The pre-built WASM (`wasm/`) is committed — users always get it as-is from JSR/npm.

---

## License

Apache 2.0
