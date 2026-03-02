/**
 * PDF document builder — the heart of the library.
 *
 * Two composable modes:
 *   Manual  — pdf.add(text("Hi").at(100, 100))  → explicit coordinates
 *   Layout  — pdf.h1("Title"); pdf.p("Body")     → cursor auto-advances
 *
 * Mix freely. Layout methods advance the cursor; add() does not.
 */

import { generatePdf, ensureWasmReady } from "./wasm.ts";
import { estimateTextHeight } from "./layout.ts";
import { TextElement, RectElement, LineElement, ImageElement } from "./elements.ts";
import { buildTableElements } from "./table.ts";
import type {
  ColorInput, Align, Buildable, RawElement,
  MarginSpec, PDFOptions, PageSizeName, TableOptions,
  HFContext, SectionOptions, PdfAMode, PaddingSpec,
} from "./types.ts";

// Import the constant (not just the type)
import { PAGE_SIZES as PAGE_SIZE_MAP } from "./types.ts";

// ─── Internal page model ──────────────────────────────────────────────────────

interface PageRecord {
  dimensions: { width: number; height: number };
  content:    RawElement[];
}

interface DocConfig {
  page_size:   string;
  orientation: string;
  margin:      MarginSpec;
  metadata: {
    title:    string;
    author:   string;
    subject:  string;
    keywords: string[];
    creator:  string;
    producer: string;
  };
  compress:    boolean;
  pdf_version: string;
  pdfa:        string | null;
}

type HFCallback = (ctx: HFContext) => void;

// ─── Element coordinate shifter ───────────────────────────────────────────────

/**
 * Translate all coordinate fields of a RawElement by (dx, dy).
 * Used to position header/footer elements relative to their band.
 */
function shiftEl(el: RawElement, dx: number, dy: number): RawElement {
  if (el.Text) {
    const t = el.Text as Record<string, unknown>;
    const pos = t.position as { x: number; y: number };
    return { Text: { ...t, position: { x: pos.x + dx, y: pos.y + dy } } };
  }
  if (el.Image) {
    const img = el.Image as Record<string, unknown>;
    const pos = img.position as { x: number; y: number };
    return { Image: { ...img, position: { x: pos.x + dx, y: pos.y + dy } } };
  }
  if (el.Shape) {
    const shape = el.Shape as Record<string, unknown>;
    if (shape.Rectangle) {
      const r = shape.Rectangle as Record<string, unknown>;
      const rct = r.rect as { x: number; y: number; width: number; height: number };
      return { Shape: { Rectangle: { ...r, rect: { ...rct, x: rct.x + dx, y: rct.y + dy } } } };
    }
    if (shape.Circle) {
      const c = shape.Circle as Record<string, unknown>;
      const ctr = c.center as { x: number; y: number };
      return { Shape: { Circle: { ...c, center: { x: ctr.x + dx, y: ctr.y + dy } } } };
    }
    if (shape.Line) {
      const l = shape.Line as Record<string, unknown>;
      const s = l.start as { x: number; y: number };
      const e = l.end as { x: number; y: number };
      return { Shape: { Line: { ...l, start: { x: s.x + dx, y: s.y + dy }, end: { x: e.x + dx, y: e.y + dy } } } };
    }
    if (shape.Path) {
      const p = shape.Path as Record<string, unknown>;
      const pts = p.points as { x: number; y: number }[];
      return { Shape: { Path: { ...p, points: pts.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) } } };
    }
  }
  return el;
}

// ─── PDF class ────────────────────────────────────────────────────────────────

export class PDF {
  private _pages:   PageRecord[] = [];
  private _current: RawElement[] = [];
  private _dim =    { width: 595, height: 842 };
  private _cursorY: number;
  private _gap = 8; // default gap between layout elements

  // Header / footer
  private _headerH  = 0;
  private _headerFn: HFCallback | null = null;
  private _footerH  = 0;
  private _footerFn: HFCallback | null = null;

  private _cfg: DocConfig = {
    page_size:   "A4",
    orientation: "Portrait",
    margin:      { top: 72, right: 72, bottom: 72, left: 72 },
    metadata: {
      title:    "Document",
      author:   "SaurioPDF",
      subject:  "",
      keywords: [],
      creator:  "SaurioPDF",
      producer: "SaurioPDF/Krilla",
    },
    compress:    true,
    pdf_version: "1.7",
    pdfa:        null,
  };

  constructor(opts?: PDFOptions) {
    if (opts?.title)    this._cfg.metadata.title   = opts.title;
    if (opts?.author)   this._cfg.metadata.author  = opts.author;
    if (opts?.subject)  this._cfg.metadata.subject = opts.subject;
    if (opts?.keywords) this._cfg.metadata.keywords = opts.keywords;
    if (opts?.pageSize) this._setPageSize(opts.pageSize);
    if (opts?.orientation) {
      this._cfg.orientation = opts.orientation;
      this._setPageSize(this._cfg.page_size as PageSizeName);
    }
    if (opts?.margin !== undefined) {
      const m = opts.margin;
      this._cfg.margin = typeof m === "number"
        ? { top: m, right: m, bottom: m, left: m }
        : m;
    }
    if (opts?.pdfa) this._cfg.pdfa = opts.pdfa;
    this._cursorY = this._cfg.margin.top;
  }

  // ── Fluent config ─────────────────────────────────────────────────────────

  title(t: string): this     { this._cfg.metadata.title   = t; return this; }
  author(a: string): this    { this._cfg.metadata.author  = a; return this; }
  subject(s: string): this   { this._cfg.metadata.subject = s; return this; }
  creator(c: string): this   { this._cfg.metadata.creator = c; return this; }

  keywords(...kw: string[]): this {
    this._cfg.metadata.keywords.push(...kw);
    return this;
  }

  pageSize(size: PageSizeName): this {
    this._setPageSize(size);
    return this;
  }

  landscape(): this {
    this._cfg.orientation = "Landscape";
    this._setPageSize(this._cfg.page_size as PageSizeName);
    return this;
  }

  portrait(): this {
    this._cfg.orientation = "Portrait";
    this._setPageSize(this._cfg.page_size as PageSizeName);
    return this;
  }

  /**
   * Set page margins.
   * @example
   *   pdf.margins(40)            // uniform
   *   pdf.margins(40, 60)        // vertical, horizontal
   *   pdf.margins(40, 50, 60, 50) // top, right, bottom, left
   */
  margins(top: number, right?: number, bottom?: number, left?: number): this {
    if (right === undefined) {
      this._cfg.margin = { top, right: top, bottom: top, left: top };
    } else if (bottom === undefined) {
      this._cfg.margin = { top, right, bottom: top, left: right };
    } else {
      this._cfg.margin = { top, right, bottom, left: left ?? right };
    }
    this._cursorY = this._cfg.margin.top + this._headerH;
    return this;
  }

  noMargins(): this { return this.margins(0); }

  /**
   * Set PDF/A conformance level for archival compliance.
   * @example pdf.conformsTo("2b")
   */
  conformsTo(mode: PdfAMode): this {
    this._cfg.pdfa = mode;
    return this;
  }

  // ── Header / Footer ───────────────────────────────────────────────────────

  /**
   * Add a repeating header band to every page.
   *
   * The callback receives a context whose coordinate system has (0, 0) at the
   * top-left of the header band. Use `ctx.add()` to place elements.
   *
   * @example
   * ```ts
   * pdf.header(40, (ctx) => {
   *   ctx.add(rect(0, 0, ctx.width, ctx.height).fill("#1a1a2e"));
   *   ctx.add(text("My Report").at(20, 14).size(14).color("white").bold());
   * });
   * ```
   */
  header(height: number, fn: HFCallback): this {
    this._headerH  = height;
    this._headerFn = fn;
    this._cursorY  = this._cfg.margin.top + height;
    return this;
  }

  /**
   * Add a repeating footer band to every page.
   * `ctx.pageNum` and `ctx.totalPages` are available for page numbering.
   *
   * @example
   * ```ts
   * pdf.footer(28, (ctx) => {
   *   ctx.add(
   *     text(`Page ${ctx.pageNum} of ${ctx.totalPages}`)
   *       .at(ctx.width / 2, 10)
   *       .size(9)
   *       .color("gray")
   *       .center()
   *       .maxWidth(ctx.width),
   *   );
   * });
   * ```
   */
  footer(height: number, fn: HFCallback): this {
    this._footerH  = height;
    this._footerFn = fn;
    return this;
  }

  // ── Manual mode ──────────────────────────────────────────────────────────

  /**
   * Add elements to the current page at their explicit coordinates.
   * Accepts: builder objects, raw JSON elements, or arrays of either.
   */
  add(...items: (Buildable | RawElement | Array<Buildable | RawElement>)[]): this {
    for (const item of items) {
      if (Array.isArray(item)) {
        for (const el of item) this._push(el);
      } else {
        this._push(item);
      }
    }
    return this;
  }

  // ── Layout mode ───────────────────────────────────────────────────────────

  /** Heading level 1 — 28pt bold */
  h1(content: string, opts?: { color?: ColorInput }): this {
    return this._layoutText(content, 28, { bold: true, ...opts });
  }

  /** Heading level 2 — 22pt bold */
  h2(content: string, opts?: { color?: ColorInput }): this {
    return this._layoutText(content, 22, { bold: true, ...opts });
  }

  /** Heading level 3 — 17pt bold */
  h3(content: string, opts?: { color?: ColorInput }): this {
    return this._layoutText(content, 17, { bold: true, ...opts });
  }

  /** Heading level 4 — 14pt bold */
  h4(content: string, opts?: { color?: ColorInput }): this {
    return this._layoutText(content, 14, { bold: true, ...opts });
  }

  /**
   * Paragraph text — wraps to content width and auto-breaks pages.
   * Defaults to 11pt left-aligned.
   */
  p(
    content: string,
    opts?: {
      size?:       number;
      color?:      ColorInput;
      align?:      Align;
      lineHeight?: number;
      bold?:       boolean;
      italic?:     boolean;
      font?:       string;
    },
  ): this {
    return this._layoutText(content, opts?.size ?? 11, opts);
  }

  /** Vertical blank space */
  spacer(points = 16): this {
    this._cursorY += points;
    return this;
  }

  /** Horizontal rule */
  hr(opts?: { color?: ColorInput; width?: number }): this {
    const x  = this._cfg.margin.left;
    const cw = this._contentWidth();
    const lw = opts?.width ?? 0.75;

    this._reserve(lw + 8);

    this._current.push(
      new LineElement(x, this._cursorY, x + cw, this._cursorY)
        .color(opts?.color ?? "#cccccc")
        .width(lw)
        .build(),
    );

    this._cursorY += lw + 8;
    return this;
  }

  /**
   * Render a table at the current cursor, auto-breaking across pages when
   * rows overflow.
   */
  table(opts: TableOptions): this {
    const x      = this._cfg.margin.left;
    const cw     = this._contentWidth();
    const fontSize = opts.fontSize    ?? 11;
    const cellPad  = opts.cellPadding ?? 6;
    const rowH     = opts.rowHeight   ?? Math.ceil(fontSize * 1.4 + cellPad * 2);
    const headerH  = (opts.headers?.length ?? 0) > 0 ? rowH : 0;

    // Clone rows so we can splice without mutating the caller's data
    const remaining = [...opts.rows];

    let firstChunk = true;

    while (firstChunk || remaining.length > 0) {
      firstChunk = false;

      const available = this._pageContentHeight() -
        (this._cursorY - this._cfg.margin.top - this._headerH);
      const maxRows   = Math.max(1, Math.floor((available - headerH) / rowH));
      const chunkRows = remaining.splice(0, maxRows);

      const { elements, height } = buildTableElements(
        { ...opts, headers: headerH > 0 ? opts.headers : undefined, rows: chunkRows },
        x,
        this._cursorY,
        cw,
      );

      this._current.push(...elements);
      this._cursorY += height + this._gap;

      if (remaining.length > 0) this._breakPage();
    }

    return this;
  }

  /**
   * Image at the current cursor position.
   * Width defaults to full content width.
   */
  img(
    data: Uint8Array,
    opts?: { width?: number; height?: number },
  ): this {
    const w = opts?.width  ?? this._contentWidth();
    const h = opts?.height ?? 100;

    this._reserve(h);

    this._current.push(
      new ImageElement(data, this._cfg.margin.left, this._cursorY, w, h).build(),
    );

    this._cursorY += h + this._gap;
    return this;
  }

  /**
   * Render a boxed section with optional background, border, and padding.
   * The callback receives a sub-PDF instance that uses the same layout API.
   *
   * @example
   * ```ts
   * pdf.section({ background: "#f0f4ff", borderColor: "#93c5fd", padding: 16 }, (s) => {
   *   s.h3("Note").p("This text lives inside the section.");
   * });
   * ```
   */
  section(opts: SectionOptions, fn: (s: PDF) => void): this {
    const rawPad = opts.padding ?? 12;
    const pad: PaddingSpec = typeof rawPad === "number"
      ? { top: rawPad, right: rawPad, bottom: rawPad, left: rawPad }
      : rawPad;

    const sectionX = this._cfg.margin.left;
    const sectionW = this._contentWidth();

    // Build a sub-PDF whose coordinate origin matches the main page.
    // margin.top  = where the cursor starts in absolute page coords
    // margin.left/right = the inner column with padding applied
    // height = huge so page breaks never trigger inside a section
    const sub = new PDF();
    sub._dim         = { ...this._dim, height: 999_999 };
    sub._cfg.margin  = {
      top:    this._cursorY + pad.top,
      bottom: 0,
      left:   sectionX + pad.left,
      right:  this._dim.width - sectionX - sectionW + pad.right,
    };
    sub._cursorY = this._cursorY + pad.top;

    fn(sub);

    const contentH = sub._cursorY - (this._cursorY + pad.top);
    const sectionH = pad.top + contentH + pad.bottom;

    // Reserve height — may break to a new page
    const startY = this._cursorY;
    this._reserve(sectionH);
    const deltaY = this._cursorY - startY;

    const y = this._cursorY;

    if (opts.background) {
      this._current.push(
        new RectElement(sectionX, y, sectionW, sectionH)
          .fill(opts.background)
          .build(),
      );
    }
    if (opts.borderColor) {
      this._current.push(
        new RectElement(sectionX, y, sectionW, sectionH)
          .stroke(opts.borderColor, 0.75)
          .build(),
      );
    }

    // If page broke, shift sub-elements to match new cursor position
    const subEls = deltaY === 0
      ? sub._current
      : sub._current.map((el) => shiftEl(el, 0, deltaY));
    this._current.push(...subEls);

    this._cursorY += sectionH + this._gap;
    return this;
  }

  // ── Page management ───────────────────────────────────────────────────────

  /** Commit current page and start a new one */
  newPage(): this {
    this._commitPage();
    this._cursorY = this._cfg.margin.top + this._headerH;
    return this;
  }

  // ── Output ────────────────────────────────────────────────────────────────

  /** Generate PDF bytes */
  async generate(): Promise<Uint8Array> {
    await ensureWasmReady();

    if (this._current.length > 0 || this._pages.length === 0) {
      this._commitPage();
    }

    // Inject repeating header / footer into every page now that totalPages is known
    const totalPages = this._pages.length;
    if (this._headerFn || this._footerFn) {
      for (let pi = 0; pi < this._pages.length; pi++) {
        const page = this._pages[pi];
        const pw   = page.dimensions.width;

        if (this._headerFn) {
          const collected: RawElement[] = [];
          this._headerFn({
            pageNum:    pi + 1,
            totalPages,
            width:      pw,
            height:     this._headerH,
            add: (...items) => {
              for (const item of items) {
                if (Array.isArray(item)) {
                  for (const el of item) this._hfPush(el, collected);
                } else {
                  this._hfPush(item as Buildable | RawElement, collected);
                }
              }
            },
          });
          // Header lives at the top of the page — no coordinate shift needed
          page.content.unshift(...collected);
        }

        if (this._footerFn) {
          const collected: RawElement[] = [];
          const footerTop = page.dimensions.height - this._footerH;
          this._footerFn({
            pageNum:    pi + 1,
            totalPages,
            width:      pw,
            height:     this._footerH,
            add: (...items) => {
              for (const item of items) {
                if (Array.isArray(item)) {
                  for (const el of item) this._hfPush(el, collected);
                } else {
                  this._hfPush(item as Buildable | RawElement, collected);
                }
              }
            },
          });
          // Footer elements: user writes (0,0) = top of footer band → shift by footerTop
          page.content.push(...collected.map((el) => shiftEl(el, 0, footerTop)));
        }
      }
    }

    return generatePdf(JSON.stringify({ config: this._cfg, pages: this._pages }));
  }

  /** Generate and write to a file (Deno / Node.js) */
  async save(filePath: string): Promise<Uint8Array> {
    const bytes = await this.generate();
    // deno-lint-ignore no-explicit-any
    const _Deno = (globalThis as any).Deno as
      | { writeFile(p: string, d: Uint8Array): Promise<void> }
      | undefined;
    if (_Deno !== undefined) {
      await _Deno.writeFile(filePath, bytes);
    } else {
      // Node.js / Bun
      const { writeFile } = await import("node:fs/promises");
      await writeFile(filePath, bytes);
    }
    return bytes;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _setPageSize(size: string): void {
    this._cfg.page_size = size;
    const [w, h] = PAGE_SIZE_MAP[size] ?? [595, 842];
    this._dim = this._cfg.orientation === "Landscape"
      ? { width: h, height: w }
      : { width: w, height: h };
  }

  private _contentWidth(): number {
    return this._dim.width - this._cfg.margin.left - this._cfg.margin.right;
  }

  /** Usable vertical space between header and footer on the page */
  private _pageContentHeight(): number {
    return this._dim.height
      - this._cfg.margin.top
      - this._cfg.margin.bottom
      - this._headerH
      - this._footerH;
  }

  /** Ensure `height` points fit on the current page; break if not */
  private _reserve(height: number): void {
    const bottomLimit = this._dim.height - this._cfg.margin.bottom - this._footerH;
    if (this._cursorY + height > bottomLimit) {
      this._breakPage();
    }
  }

  private _breakPage(): void {
    this._commitPage();
    this._cursorY = this._cfg.margin.top + this._headerH;
  }

  private _commitPage(): void {
    this._pages.push({ dimensions: { ...this._dim }, content: [...this._current] });
    this._current = [];
  }

  private _push(el: Buildable | RawElement): void {
    if (el instanceof TextElement && el.wrappingWidth !== null) {
      this._current.push(...el.buildAll());
    } else {
      this._current.push(
        typeof (el as Buildable).build === "function"
          ? (el as Buildable).build()
          : (el as RawElement),
      );
    }
  }

  /** Collect a builder/raw-element into the HF buffer (mirrors _push) */
  private _hfPush(el: Buildable | RawElement, collected: RawElement[]): void {
    if (el instanceof TextElement && el.wrappingWidth !== null) {
      collected.push(...el.buildAll());
    } else {
      collected.push(
        typeof (el as Buildable).build === "function"
          ? (el as Buildable).build()
          : (el as RawElement),
      );
    }
  }

  private _layoutText(
    content: string,
    size: number,
    opts?: {
      bold?:       boolean;
      italic?:     boolean;
      color?:      ColorInput;
      align?:      Align;
      lineHeight?: number;
      font?:       string;
    },
  ): this {
    const cw   = this._contentWidth();
    const lh   = opts?.lineHeight ?? 1.4;
    const bold = opts?.bold ?? false;
    const h    = estimateTextHeight(content, cw, size, lh, bold);

    this._reserve(h);

    const el = new TextElement(content, this._cfg.margin.left, this._cursorY, size)
      .maxWidth(cw);

    if (bold)          el.bold();
    if (opts?.italic)  el.italic();
    if (opts?.color)   el.color(opts.color);
    if (opts?.align)   el.align(opts.align);
    if (opts?.font)    el.font(opts.font);

    this._current.push(...el.buildAll(lh));
    this._cursorY += h + this._gap;
    return this;
  }
}

// ─── Quick helper ─────────────────────────────────────────────────────────────

/**
 * Create and save a PDF in one call.
 * @example
 * ```ts
 * await quickPDF("out.pdf", (pdf) => {
 *   pdf.h1("Hello").p("World");
 * });
 * ```
 */
export async function quickPDF(
  filePath: string,
  builder: (pdf: PDF) => void | Promise<void>,
): Promise<void> {
  const pdf = new PDF();
  await builder(pdf);
  await pdf.save(filePath);
}
