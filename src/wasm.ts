/**
 * WASM bootstrap — single source of truth for WASM initialization.
 *
 * Handles the init singleton so callers don't need to coordinate.
 * Exported as `init()` from mod.ts; internal code uses `ensureWasmReady()`.
 *
 * Runtime detection:
 *   Deno / Bun / Browser → default wasm-bindgen URL-based loading (fetch)
 *   Node.js              → readFileSync, because fetch() doesn't support file:// URLs
 */

import wasmInit from "../wasm/sauriopdf_core.js";

// ─── Raw WASM re-exports ────────────────────────────────────────────────────────

export {
  generatePdf,
  measureChars,
  registerFont,
  testWasm,
  version,
} from "../wasm/sauriopdf_core.js";

// ─── Init lifecycle ─────────────────────────────────────────────────────────────

function isNode(): boolean {
  const g = globalThis as Record<string, unknown>;
  return g["Deno"] === undefined &&
    typeof g["process"] === "object" &&
    g["process"] !== null &&
    typeof (g["process"] as Record<string, unknown>)["versions"] === "object";
}

let _initPromise: Promise<void> | null = null;

/**
 * Initialize the WASM module. Safe to call concurrently or multiple times —
 * every caller shares the same underlying init.
 *
 * Must be called before any PDF operation.
 */
export function init(): Promise<void> {
  _initPromise ??= _doInit();
  return _initPromise;
}

async function _doInit(): Promise<void> {
  if (isNode()) {
    // Node.js: fetch() doesn't support file:// URLs.
    // Read the .wasm binary directly and pass it to wasmInit as a Buffer
    // (Buffer extends Uint8Array, a valid WebAssembly.instantiate source).
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    const wasmBytes = readFileSync(join(dir, "../wasm/sauriopdf_core_bg.wasm"));
    await wasmInit({ module_or_path: wasmBytes });
  } else {
    // Deno, Bun, and browsers — default URL-based loading works fine.
    await wasmInit();
  }
}

/** Internal: ensure WASM is ready before any PDF operation. */
export async function ensureWasmReady(): Promise<void> {
  await init();
}
