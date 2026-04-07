/* @ts-self-types="./sauriopdf_core.d.ts" */

/**
 * Color representation (RGB)
 */
export class Color {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Color.prototype);
        obj.__wbg_ptr = ptr;
        ColorFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ColorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_color_free(ptr, 0);
    }
    /**
     * Black color
     * @returns {Color}
     */
    static black() {
        const ret = wasm.color_black();
        return Color.__wrap(ret);
    }
    /**
     * Create color from hex string (e.g., "#FF5733")
     * @param {string} hex
     * @returns {Color}
     */
    static from_hex(hex) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(hex, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
            const len0 = WASM_VECTOR_LEN;
            wasm.color_from_hex(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return Color.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @param {number} a
     */
    constructor(r, g, b, a) {
        const ret = wasm.color_new(r, g, b, a);
        this.__wbg_ptr = ret >>> 0;
        ColorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * White color
     * @returns {Color}
     */
    static white() {
        const ret = wasm.color_white();
        return Color.__wrap(ret);
    }
    /**
     * @returns {number}
     */
    get a() {
        const ret = wasm.__wbg_get_color_a(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get b() {
        const ret = wasm.__wbg_get_color_b(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get g() {
        const ret = wasm.__wbg_get_color_g(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get r() {
        const ret = wasm.__wbg_get_color_r(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set a(arg0) {
        wasm.__wbg_set_color_a(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set b(arg0) {
        wasm.__wbg_set_color_b(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set g(arg0) {
        wasm.__wbg_set_color_g(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set r(arg0) {
        wasm.__wbg_set_color_r(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) Color.prototype[Symbol.dispose] = Color.prototype.free;

/**
 * Font style
 * @enum {0 | 1 | 2}
 */
export const FontStyle = Object.freeze({
    Normal: 0, "0": "Normal",
    Italic: 1, "1": "Italic",
    Oblique: 2, "2": "Oblique",
});

/**
 * Font weight
 * @enum {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}
 */
export const FontWeight = Object.freeze({
    Thin: 0, "0": "Thin",
    ExtraLight: 1, "1": "ExtraLight",
    Light: 2, "2": "Light",
    Normal: 3, "3": "Normal",
    Medium: 4, "4": "Medium",
    SemiBold: 5, "5": "SemiBold",
    Bold: 6, "6": "Bold",
    ExtraBold: 7, "7": "ExtraBold",
    Black: 8, "8": "Black",
});

/**
 * Margin specification
 */
export class Margin {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Margin.prototype);
        obj.__wbg_ptr = ptr;
        MarginFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MarginFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_margin_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get bottom() {
        const ret = wasm.__wbg_get_margin_bottom(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get left() {
        const ret = wasm.__wbg_get_margin_left(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get right() {
        const ret = wasm.__wbg_get_margin_right(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get top() {
        const ret = wasm.__wbg_get_color_a(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} top
     * @param {number} right
     * @param {number} bottom
     * @param {number} left
     */
    constructor(top, right, bottom, left) {
        const ret = wasm.margin_new(top, right, bottom, left);
        this.__wbg_ptr = ret >>> 0;
        MarginFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Create symmetric margin
     * @param {number} vertical
     * @param {number} horizontal
     * @returns {Margin}
     */
    static symmetric(vertical, horizontal) {
        const ret = wasm.margin_symmetric(vertical, horizontal);
        return Margin.__wrap(ret);
    }
    /**
     * Create uniform margin
     * @param {number} value
     * @returns {Margin}
     */
    static uniform(value) {
        const ret = wasm.margin_uniform(value);
        return Margin.__wrap(ret);
    }
    /**
     * @param {number} arg0
     */
    set bottom(arg0) {
        wasm.__wbg_set_margin_bottom(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set left(arg0) {
        wasm.__wbg_set_margin_left(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set right(arg0) {
        wasm.__wbg_set_margin_right(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set top(arg0) {
        wasm.__wbg_set_color_a(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) Margin.prototype[Symbol.dispose] = Margin.prototype.free;

/**
 * Page orientation
 * @enum {0 | 1}
 */
export const Orientation = Object.freeze({
    Portrait: 0, "0": "Portrait",
    Landscape: 1, "1": "Landscape",
});

/**
 * Page size presets
 * @enum {0 | 1 | 2 | 3 | 4 | 5 | 6}
 */
export const PageSize = Object.freeze({
    A4: 0, "0": "A4",
    A3: 1, "1": "A3",
    A5: 2, "2": "A5",
    Letter: 3, "3": "Letter",
    Legal: 4, "4": "Legal",
    Tabloid: 5, "5": "Tabloid",
    Custom: 6, "6": "Custom",
});

/**
 * Point/Position in 2D space
 */
export class Point {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PointFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_point_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_color_a(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_margin_right(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} x
     * @param {number} y
     */
    constructor(x, y) {
        const ret = wasm.point_new(x, y);
        this.__wbg_ptr = ret >>> 0;
        PointFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_color_a(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_margin_right(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) Point.prototype[Symbol.dispose] = Point.prototype.free;

/**
 * Rectangle/Size
 */
export class Rect {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RectFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_rect_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_margin_left(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_margin_bottom(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_color_a(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_margin_right(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    constructor(x, y, width, height) {
        const ret = wasm.margin_new(x, y, width, height);
        this.__wbg_ptr = ret >>> 0;
        RectFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_margin_left(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_margin_bottom(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_color_a(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_margin_right(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) Rect.prototype[Symbol.dispose] = Rect.prototype.free;

/**
 * Text alignment
 * @enum {0 | 1 | 2 | 3}
 */
export const TextAlign = Object.freeze({
    Left: 0, "0": "Left",
    Center: 1, "1": "Center",
    Right: 2, "2": "Right",
    Justify: 3, "3": "Justify",
});

/**
 * Generate PDF from JSON document structure
 *
 * This is the main entry point for TypeScript to generate PDFs.
 * It receives a JSON string representing the document and returns PDF bytes.
 * @param {string} document_json
 * @returns {Uint8Array}
 */
export function generatePdf(document_json) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(document_json, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len0 = WASM_VECTOR_LEN;
        wasm.generatePdf(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export(r0, r1 * 1, 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Initialize the library (sets up panic hooks for better error messages in WASM)
 */
export function initialize() {
    wasm.initialize();
}

/**
 * Register a custom font (receives font bytes)
 * @param {string} name
 * @param {Uint8Array} font_data
 */
export function registerFont(name, font_data) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(font_data, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.registerFont(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        if (r1) {
            throw takeObject(r0);
        }
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Simple test function to verify WASM is working
 * @returns {string}
 */
export function testWasm() {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.testWasm(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Get library version
 * @returns {string}
 */
export function version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.version(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export(deferred1_0, deferred1_1, 1);
    }
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_be289d5034ed271b: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_error_7534b8e9a36f1ab4: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_export(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_log_6b5ca2e6124b2808: function(arg0) {
            console.log(getObject(arg0));
        },
        __wbg_new_8a6f238a6ece86ea: function() {
            const ret = new Error();
            return addHeapObject(ret);
        },
        __wbg_stack_0ed75d68575b0f3c: function(arg0, arg1) {
            const ret = getObject(arg1).stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export2, wasm.__wbindgen_export3);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_object_drop_ref: function(arg0) {
            takeObject(arg0);
        },
    };
    return {
        __proto__: null,
        "./sauriopdf_core_bg.js": import0,
    };
}

const ColorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_color_free(ptr >>> 0, 1));
const MarginFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_margin_free(ptr >>> 0, 1));
const PointFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_point_free(ptr >>> 0, 1));
const RectFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_rect_free(ptr >>> 0, 1));

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getObject(idx) { return heap[idx]; }

let heap = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('sauriopdf_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
