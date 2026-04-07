/**
 * WASM bootstrap — single source of truth for WASM initialization.
 *
 * Handles the init singleton so callers don't need to coordinate.
 * Exported as `init()` from mod.ts; internal code uses `ensureWasmReady()`.
 *
 * Runtime detection:
 *   Deno / Browser → default wasm-bindgen URL-based loading (fetch)
 *   Node.js 18+    → readFileSync, because fetch() doesn't support file:// URLs
 */

import wasmInit from "../wasm/sauriopdf_core.js";

export {
  generatePdf,
  registerFont,
  testWasm,
  version,
} from "../wasm/sauriopdf_core.js";

let _ready = false;

/**
 * Initialize the WASM module. Safe to call multiple times (idempotent).
 *
 * Must be called before any PDF operation.
 */
export async function init(): Promise<void> {
  if (_ready) return;

  const g = globalThis as Record<string, unknown>;
  const isNode = g["Deno"] === undefined &&
    typeof g["process"] === "object" &&
    g["process"] !== null &&
    typeof (g["process"] as Record<string, unknown>)["versions"] === "object";

  if (isNode) {
    // Node.js: fetch() doesn't support file:// URLs (Node 18+ limitation).
    // Read the .wasm binary directly and pass it to wasmInit as a Buffer
    // (Buffer extends Uint8Array which is a valid WebAssembly.instantiate source).
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const __dir = dirname(fileURLToPath(import.meta.url));
    const wasmBytes = readFileSync(join(__dir, "../wasm/sauriopdf_core_bg.wasm"));
    await wasmInit({ module_or_path: wasmBytes });
  } else {
    // Deno or Browser — default URL-based loading works fine.
    await wasmInit();
  }

  _ready = true;
}

/** Internal: ensure WASM is ready before any PDF operation. */
export async function ensureWasmReady(): Promise<void> {
  await init();
}
