/**
 * SaurioPDF — optional worker-pool backend.
 *
 * Not loaded by the main "sauriopdf" entry point. Import from here only if
 * you explicitly want PDF generation to happen on worker threads instead of
 * in-process.
 *
 * @example
 * ```ts
 * import { init, PDF } from "sauriopdf";
 * import { generateWithPool, initPool } from "sauriopdf/pool";
 *
 * await init();
 * await initPool(); // throws if this platform can't run Workers
 *
 * const pdf = new PDF({ title: "Report" });
 * pdf.h1("Hello");
 * const bytes = await generateWithPool(pdf);
 * ```
 *
 * Memory: each worker runs its own WASM instance — a pool of 4 workers means
 * ~4× the library's WASM footprint resident at once. Fine for a long-running
 * server; think twice in a memory-constrained environment.
 *
 * @module
 */

export {
  generateWithPool,
  initPool,
  isPoolActive,
  registerFont,
  terminatePool,
} from "./src/pool.ts";
