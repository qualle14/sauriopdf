/**
 * Public types for SaurioPDF.
 * All user-facing types live here — nothing internal leaks out.
 */

// ─── Internal (not exported from mod.ts) ──────────────────────────────────────

/** Internal RGBA color representation used between modules */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Internal margin structure */
export interface MarginSpec {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ─── Raw element protocol types (mirror of Rust ContentElement) ───────────────

/** Shared point type used in raw elements */
export interface RawPoint {
  x: number;
  y: number;
}

/** Shared rect type used in raw elements */
export interface RawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Shape sub-variants */
export type RawShapeVariant =
  | {
    Rectangle: {
      rect: RawRect;
      fill_color: RGBA | null;
      stroke_color: RGBA | null;
      stroke_width: number;
      border_radius: number;
    };
  }
  | {
    Circle: {
      center: RawPoint;
      radius: number;
      fill_color: RGBA | null;
      stroke_color: RGBA | null;
      stroke_width: number;
    };
  }
  | {
    Line: {
      start: RawPoint;
      end: RawPoint;
      color: RGBA;
      width: number;
    };
  }
  | {
    Path: {
      points: RawPoint[];
      fill_color: RGBA | null;
      stroke_color: RGBA | null;
      stroke_width: number;
      closed: boolean;
    };
  };

/**
 * Discriminated union of all element types sent to Rust via WASM.
 * Mirrors Rust's `ContentElement` enum (serde externally-tagged).
 */
export type RawElement =
  | {
    Text: {
      content: string;
      position: RawPoint;
      font_family: string;
      font_size: number;
      color: RGBA;
      bold: boolean;
      italic: boolean;
      align: string;
      max_width: number | null;
    };
  }
  | {
    Image: {
      data: string;
      position: RawPoint;
      width: number | null;
      height: number | null;
      format: string;
    };
  }
  | { Shape: RawShapeVariant }
  | {
    Link: {
      url: string;
      rect: RawRect;
      text: string | null;
    };
  };

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * Flexible color input. Accepts:
 * - CSS named color:  "red", "dodgerblue", "coral", "transparent"
 * - Hex string:       "#RGB", "#RRGGBB", "#RRGGBBAA"
 * - RGB tuple:        [r, g, b]      (0–255)
 * - RGBA tuple:       [r, g, b, a]   (rgb 0–255, alpha 0–1)
 */
export type ColorInput =
  | string
  | [number, number, number]
  | [number, number, number, number];

export type Align = "Left" | "Center" | "Right" | "Justify";

/** Anything that can be placed on a PDF page */
export interface Buildable {
  build(): RawElement;
}

/** Page size presets (in points: 1pt = 1/72 inch) */
export const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595, 842],
  A3: [842, 1191],
  A5: [420, 595],
  Letter: [612, 792],
  Legal: [612, 1008],
  Tabloid: [792, 1224],
} as const;

export type PageSizeName = keyof typeof PAGE_SIZES;

export interface TableOptions {
  /** Column header labels */
  headers?: string[];
  /** Data rows — each row is an array of cell strings */
  rows: string[][];
  /**
   * Column widths. Values ≤ 1 are fractions of content width.
   * Values > 1 are absolute points. Omit for equal distribution.
   * @example [0.4, 0.3, 0.3]  // 40% | 30% | 30%
   */
  widths?: number[];
  /**
   * Per-column text alignment. Defaults to "Left" for all columns.
   * @example ["Left", "Center", "Right"]
   */
  columnAligns?: Align[];
  /** Alternate row backgrounds */
  striped?: boolean;
  /** Draw grid borders (default: true) */
  borders?: boolean;
  fontSize?: number;
  cellPadding?: number;
  /** Override auto-calculated row height */
  rowHeight?: number;
  headerBg?: ColorInput;
  headerColor?: ColorInput;
  stripedBg?: ColorInput;
  /** Background for all data rows (use striped instead for alternating) */
  rowBg?: ColorInput;
  textColor?: ColorInput;
}

/** PDF/A conformance level */
export type PdfAMode = "1a" | "1b" | "2a" | "2b" | "2u" | "3a" | "3b" | "3u";

/** Padding on all four sides */
export interface PaddingSpec {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Options for pdf.section() */
export interface SectionOptions {
  background?: ColorInput;
  borderColor?: ColorInput;
  padding?: number | PaddingSpec;
  radius?: number;
}

export interface PDFOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  pageSize?: PageSizeName;
  orientation?: "Portrait" | "Landscape";
  margin?: number | MarginSpec;
  /** PDF/A conformance level — embeds ICC profile and enforces spec */
  pdfa?: PdfAMode;
  /** Default spacing added after each layout element (default: 8) */
  gap?: number;
}

/** Context passed to pdf.header() and pdf.footer() callbacks */
export interface HFContext {
  /** Current page number (1-indexed) */
  pageNum: number;
  /** Total number of pages in the document */
  totalPages: number;
  /** Full page width in points */
  width: number;
  /** Band height in points (as passed to header/footer) */
  height: number;
  /** Add elements to the header/footer band (same API as pdf.add()) */
  add(...items: (Buildable | RawElement | Array<Buildable | RawElement>)[]): void;
}

/** Pixel dimensions of an image */
export interface ImageDimensions {
  width: number;
  height: number;
}
