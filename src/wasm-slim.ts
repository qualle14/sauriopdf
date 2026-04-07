/**
 * WASM bootstrap for the slim build (no embedded fonts).
 *
 * Identical to wasm.ts but points to wasm-slim/ which is produced by:
 *   deno task build:wasm:slim
 *
 * Users must load at least one font before generating PDFs:
 *   await loadLiberationSans();
 */

import wasmInit from "../wasm-slim/sauriopdf_core.js";

export {
  generatePdf,
  registerFont,
  testWasm,
  version,
} from "../wasm-slim/sauriopdf_core.js";

let _ready = false;

export async function init(): Promise<void> {
  if (_ready) return;

  const g = globalThis as Record<string, unknown>;
  const isNode = g["Deno"] === undefined &&
    typeof g["process"] === "object" &&
    g["process"] !== null &&
    typeof (g["process"] as Record<string, unknown>)["versions"] === "object";

  if (isNode) {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const __dir = dirname(fileURLToPath(import.meta.url));
    const wasmBytes = readFileSync(join(__dir, "../wasm-slim/sauriopdf_core_bg.wasm"));
    await wasmInit({ module_or_path: wasmBytes });
  } else {
    await wasmInit();
  }

  _ready = true;
}

export async function ensureWasmReady(): Promise<void> {
  await init();
}
