/**
 * PDFBase — document state, configuration, page management, and output.
 *
 * Extended by PDFLayout (layout helpers) and PDF (section + quickPDF).
 * Not part of the public API — consumers import PDF from pdf.ts.
 */

import { ensureWasmReady, generatePdf } from "./wasm.ts";
import { TextElement } from "./elements.ts";
import type {
  Buildable,
  HFContext,
  MarginSpec,
  PageSizeName,
  PdfAMode,
  PDFOptions,
  RawElement,
} from "./types.ts";
import { PAGE_SIZES as PAGE_SIZE_MAP } from "./types.ts";

// ─── Internal page model ──────────────────────────────────────────────────────

interface PageRecord {
  dimensions: { width: number; height: number };
  content: RawElement[];
}

interface DocConfig {
  page_size: string;
  orientation: string;
  margin: MarginSpec;
  metadata: {
    title: string;
    author: string;
    subject: string;
    keywords: string[];
    creator: string;
    producer: string;
  };
  compress: boolean;
  pdf_version: string;
  pdfa: string | null;
}

type HFCallback = (ctx: HFContext) => void;

// ─── Element coordinate shifter ───────────────────────────────────────────────

/**
 * Translate all coordinate fields of a RawElement by (dx, dy).
 * Used to position header/footer elements relative to their band.
 */
export function shiftEl(el: RawElement, dx: number, dy: number): RawElement {
  if ("Text" in el) {
    const { Text } = el;
    return {
      Text: { ...Text, position: { x: Text.position.x + dx, y: Text.position.y + dy } },
    };
  }
  if ("Image" in el) {
    const { Image } = el;
    return {
      Image: {
        ...Image,
        position: { x: Image.position.x + dx, y: Image.position.y + dy },
      },
    };
  }
  if ("Shape" in el) {
    const shape = el.Shape;
    if ("Rectangle" in shape) {
      const { rect } = shape.Rectangle;
      return {
        Shape: {
          Rectangle: {
            ...shape.Rectangle,
            rect: { ...rect, x: rect.x + dx, y: rect.y + dy },
          },
        },
      };
    }
    if ("Circle" in shape) {
      const { center } = shape.Circle;
      return {
        Shape: {
          Circle: { ...shape.Circle, center: { x: center.x + dx, y: center.y + dy } },
        },
      };
    }
    if ("Line" in shape) {
      const { start, end } = shape.Line;
      return {
        Shape: {
          Line: {
            ...shape.Line,
            start: { x: start.x + dx, y: start.y + dy },
            end: { x: end.x + dx, y: end.y + dy },
          },
        },
      };
    }
    if ("Path" in shape) {
      const { points } = shape.Path;
      return {
        Shape: {
          Path: {
            ...shape.Path,
            points: points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          },
        },
      };
    }
  }
  return el;
}

// ─── PDFBase ──────────────────────────────────────────────────────────────────

export class PDFBase {
  protected _pages: PageRecord[] = [];
  protected _current: RawElement[] = [];
  protected _dim = { width: 595, height: 842 };
  protected _cursorY: number;
  protected _gap = 8;

  protected _headerH = 0;
  private _headerFn: HFCallback | null = null;
  private _footerH = 0;
  private _footerFn: HFCallback | null = null;

  protected _cfg: DocConfig = {
    page_size: "A4",
    orientation: "Portrait",
    margin: { top: 72, right: 72, bottom: 72, left: 72 },
    metadata: {
      title: "Document",
      author: "SaurioPDF",
      subject: "",
      keywords: [],
      creator: "SaurioPDF",
      producer: "SaurioPDF/Krilla",
    },
    compress: true,
    pdf_version: "1.7",
    pdfa: null,
  };

  constructor(opts?: PDFOptions) {
    if (opts?.title) this._cfg.metadata.title = opts.title;
    if (opts?.author) this._cfg.metadata.author = opts.author;
    if (opts?.subject) this._cfg.metadata.subject = opts.subject;
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
    if (opts?.gap !== undefined) this._gap = opts.gap;
    this._cursorY = this._cfg.margin.top;
  }

  // ── Fluent config ─────────────────────────────────────────────────────────

  title(t: string): this {
    this._cfg.metadata.title = t;
    return this;
  }
  author(a: string): this {
    this._cfg.metadata.author = a;
    return this;
  }
  subject(s: string): this {
    this._cfg.metadata.subject = s;
    return this;
  }
  creator(c: string): this {
    this._cfg.metadata.creator = c;
    return this;
  }

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

  noMargins(): this {
    return this.margins(0);
  }

  /**
   * Set PDF/A conformance level for archival compliance.
   * @example pdf.conformsTo("2b")
   */
  conformsTo(mode: PdfAMode): this {
    this._cfg.pdfa = mode;
    return this;
  }

  /**
   * Set the default spacing added after each layout element.
   * @example pdf.gap(12).h1("Title").p("Body")
   */
  gap(n: number): this {
    this._gap = n;
    return this;
  }

  // ── Read-only page state (useful when mixing manual + layout mode) ─────────

  /** Current cursor Y position (points from page top) */
  get cursor(): number {
    return this._cursorY;
  }

  /** Usable content width between left and right margins */
  get contentWidth(): number {
    return this._contentWidth();
  }

  /** Full page width in points */
  get pageWidth(): number {
    return this._dim.width;
  }

  /** Full page height in points */
  get pageHeight(): number {
    return this._dim.height;
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
    this._headerH = height;
    this._headerFn = fn;
    this._cursorY = this._cfg.margin.top + height;
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
    this._footerH = height;
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

  // ── Page management ───────────────────────────────────────────────────────

  /** Commit current page and start a new one */
  newPage(): this {
    this._commitPage();
    this._cursorY = this._cfg.margin.top + this._headerH;
    return this;
  }

  /** Alias for newPage() */
  pageBreak(): this {
    return this.newPage();
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
        const pw = page.dimensions.width;

        if (this._headerFn) {
          const collected: RawElement[] = [];
          this._headerFn({
            pageNum: pi + 1,
            totalPages,
            width: pw,
            height: this._headerH,
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
            pageNum: pi + 1,
            totalPages,
            width: pw,
            height: this._footerH,
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

  // ── Protected helpers (accessible to subclasses) ─────────────────────────

  protected _contentWidth(): number {
    return this._dim.width - this._cfg.margin.left - this._cfg.margin.right;
  }

  /** Usable vertical space between header and footer on the page */
  protected _pageContentHeight(): number {
    return (
      this._dim.height -
      this._cfg.margin.top -
      this._cfg.margin.bottom -
      this._headerH -
      this._footerH
    );
  }

  /** Ensure `height` points fit on the current page; break if not */
  protected _reserve(height: number): void {
    const bottomLimit = this._dim.height - this._cfg.margin.bottom - this._footerH;
    if (this._cursorY + height > bottomLimit) {
      this._breakPage();
    }
  }

  protected _breakPage(): void {
    this._commitPage();
    this._cursorY = this._cfg.margin.top + this._headerH;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _setPageSize(size: string): void {
    this._cfg.page_size = size;
    const [w, h] = PAGE_SIZE_MAP[size] ?? [595, 842];
    this._dim = this._cfg.orientation === "Landscape"
      ? { width: h, height: w }
      : { width: w, height: h };
  }

  private _commitPage(): void {
    this._pages.push({ dimensions: { ...this._dim }, content: [...this._current] });
    this._current = [];
  }

  /** Resolve a builder or raw element into one or more RawElements. */
  private _resolveEl(el: Buildable | RawElement): RawElement[] {
    if (el instanceof TextElement && el.wrappingWidth !== null) {
      return el.buildAll();
    }
    return [
      typeof (el as Buildable).build === "function"
        ? (el as Buildable).build()
        : (el as RawElement),
    ];
  }

  private _push(el: Buildable | RawElement): void {
    this._current.push(...this._resolveEl(el));
  }

  private _hfPush(el: Buildable | RawElement, collected: RawElement[]): void {
    collected.push(...this._resolveEl(el));
  }
}
