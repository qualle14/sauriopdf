/* tslint:disable */
/* eslint-disable */

/**
 * Color representation (RGB)
 */
export class Color {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Black color
     */
    static black(): Color;
    /**
     * Create color from hex string (e.g., "#FF5733")
     */
    static from_hex(hex: string): Color;
    constructor(r: number, g: number, b: number, a: number);
    /**
     * White color
     */
    static white(): Color;
    a: number;
    b: number;
    g: number;
    r: number;
}

/**
 * Font style
 */
export enum FontStyle {
    Normal = 0,
    Italic = 1,
    Oblique = 2,
}

/**
 * Font weight
 */
export enum FontWeight {
    Thin = 0,
    ExtraLight = 1,
    Light = 2,
    Normal = 3,
    Medium = 4,
    SemiBold = 5,
    Bold = 6,
    ExtraBold = 7,
    Black = 8,
}

/**
 * Margin specification
 */
export class Margin {
    free(): void;
    [Symbol.dispose](): void;
    constructor(top: number, right: number, bottom: number, left: number);
    /**
     * Create symmetric margin
     */
    static symmetric(vertical: number, horizontal: number): Margin;
    /**
     * Create uniform margin
     */
    static uniform(value: number): Margin;
    bottom: number;
    left: number;
    right: number;
    top: number;
}

/**
 * Page orientation
 */
export enum Orientation {
    Portrait = 0,
    Landscape = 1,
}

/**
 * Page size presets
 */
export enum PageSize {
    A4 = 0,
    A3 = 1,
    A5 = 2,
    Letter = 3,
    Legal = 4,
    Tabloid = 5,
    Custom = 6,
}

/**
 * Point/Position in 2D space
 */
export class Point {
    free(): void;
    [Symbol.dispose](): void;
    constructor(x: number, y: number);
    x: number;
    y: number;
}

/**
 * Rectangle/Size
 */
export class Rect {
    free(): void;
    [Symbol.dispose](): void;
    constructor(x: number, y: number, width: number, height: number);
    height: number;
    width: number;
    x: number;
    y: number;
}

/**
 * Text alignment
 */
export enum TextAlign {
    Left = 0,
    Center = 1,
    Right = 2,
    Justify = 3,
}

/**
 * Generate PDF from JSON document structure
 *
 * This is the main entry point for TypeScript to generate PDFs.
 * It receives a JSON string representing the document and returns PDF bytes.
 */
export function generatePdf(document_json: string): Uint8Array;

/**
 * Initialize the library (sets up panic hooks for better error messages in WASM)
 */
export function initialize(): void;

/**
 * Register a custom font (receives font bytes)
 */
export function registerFont(name: string, font_data: Uint8Array): void;

/**
 * Simple test function to verify WASM is working
 */
export function testWasm(): string;

/**
 * Get library version
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_color_free: (a: number, b: number) => void;
    readonly __wbg_get_color_a: (a: number) => number;
    readonly __wbg_get_color_b: (a: number) => number;
    readonly __wbg_get_color_g: (a: number) => number;
    readonly __wbg_get_color_r: (a: number) => number;
    readonly __wbg_get_margin_bottom: (a: number) => number;
    readonly __wbg_get_margin_left: (a: number) => number;
    readonly __wbg_get_margin_right: (a: number) => number;
    readonly __wbg_margin_free: (a: number, b: number) => void;
    readonly __wbg_point_free: (a: number, b: number) => void;
    readonly __wbg_set_color_a: (a: number, b: number) => void;
    readonly __wbg_set_color_b: (a: number, b: number) => void;
    readonly __wbg_set_color_g: (a: number, b: number) => void;
    readonly __wbg_set_color_r: (a: number, b: number) => void;
    readonly __wbg_set_margin_bottom: (a: number, b: number) => void;
    readonly __wbg_set_margin_left: (a: number, b: number) => void;
    readonly __wbg_set_margin_right: (a: number, b: number) => void;
    readonly color_black: () => number;
    readonly color_from_hex: (a: number, b: number, c: number) => void;
    readonly color_new: (a: number, b: number, c: number, d: number) => number;
    readonly color_white: () => number;
    readonly generatePdf: (a: number, b: number, c: number) => void;
    readonly initialize: () => void;
    readonly margin_new: (a: number, b: number, c: number, d: number) => number;
    readonly margin_symmetric: (a: number, b: number) => number;
    readonly margin_uniform: (a: number) => number;
    readonly point_new: (a: number, b: number) => number;
    readonly registerFont: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly testWasm: (a: number) => void;
    readonly version: (a: number) => void;
    readonly rect_new: (a: number, b: number, c: number, d: number) => number;
    readonly __wbg_set_point_y: (a: number, b: number) => void;
    readonly __wbg_set_rect_height: (a: number, b: number) => void;
    readonly __wbg_set_rect_width: (a: number, b: number) => void;
    readonly __wbg_set_rect_y: (a: number, b: number) => void;
    readonly __wbg_set_point_x: (a: number, b: number) => void;
    readonly __wbg_get_point_x: (a: number) => number;
    readonly __wbg_set_margin_top: (a: number, b: number) => void;
    readonly __wbg_get_margin_top: (a: number) => number;
    readonly __wbg_rect_free: (a: number, b: number) => void;
    readonly __wbg_get_rect_y: (a: number) => number;
    readonly __wbg_get_rect_x: (a: number) => number;
    readonly __wbg_get_rect_width: (a: number) => number;
    readonly __wbg_get_rect_height: (a: number) => number;
    readonly __wbg_get_point_y: (a: number) => number;
    readonly __wbg_set_rect_x: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number, b: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
