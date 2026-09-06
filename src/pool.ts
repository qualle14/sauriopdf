/**
 * Optional worker-pool backend for PDF generation — off by default.
 *
 * `mod.ts` never imports this file: using workers is an explicit opt-in.
 * Nothing here runs, and no worker code loads, unless you import from
 * `sauriopdf/pool` and call `initPool()` yourself.
 *
 * Runtime support:
 *   Deno / Bun / browser → standard Worker (Web Worker API)
 *   Node.js              → node:worker_threads
 *
 * If the platform can't actually run workers — Deno Deploy's isolate model has
 * no OS threads, even though the `Worker` global exists — `initPool()` THROWS.
 * It does not silently fall back to synchronous generation: you opted into
 * concurrency, so losing it silently would hide a real capacity problem.
 */

import { registerFont as registerFontCore } from "./wasm.ts";

// ─── Message protocol (mirrors src/worker-entry.ts) ──────────────────────────────

type InMessage =
  | { type: "registerFont"; name: string; data: Uint8Array }
  | { type: "generate"; id: number; json: string };

type OutMessage =
  | { type: "ready" }
  | { type: "result"; id: number; bytes: Uint8Array }
  | { type: "error"; id: number; message: string };

/**
 * Minimal surface both Web Workers and node:worker_threads Workers can satisfy.
 * `data` is `unknown`, not `OutMessage`, purely so this shape stays assignable
 * from the DOM `EventListener` type when wrapping a real Worker — callers cast
 * it back to `OutMessage` themselves (this pool authored `OutMessage`, so the
 * cast is safe).
 */
interface WorkerLike {
  postMessage(msg: InMessage, transfer?: Transferable[]): void;
  addEventListener(type: "message", handler: (e: { data: unknown }) => void): void;
  removeEventListener(type: "message", handler: (e: { data: unknown }) => void): void;
  terminate(): void;
}

const READY_TIMEOUT_MS = 10_000;

// ─── Runtime detection ────────────────────────────────────────────────────────────

/**
 * True only for real Node.js — Bun also sets `process.versions.node` for
 * compat, but Bun implements the standard Web Worker API directly (like Deno
 * and browsers do), so it must NOT take the node:worker_threads branch below.
 */
function isNode(): boolean {
  const g = globalThis as Record<string, unknown>;
  if (g["Deno"] !== undefined) return false;
  const versions = (g["process"] as { versions?: Record<string, string> } | undefined)?.versions;
  if (!versions || typeof versions["bun"] === "string") return false;
  return typeof versions["node"] === "string";
}

/**
 * `worker-entry`'s file extension mirrors whatever extension *this* module
 * was loaded with — `.ts` when running from source (Deno/JSR), `.js` when
 * running from the compiled npm `dist/` (the only place `.js` ships), so the
 * pool always resolves the sibling file that's actually on disk.
 */
function workerEntryUrl(): URL {
  const ext = import.meta.url.endsWith(".ts") ? "ts" : "js";
  return new URL(`./worker-entry.${ext}`, import.meta.url);
}

/** Build a factory that creates one WorkerLike per call, for the current runtime. */
async function makeWorkerFactory(url: URL): Promise<() => WorkerLike> {
  if (!isNode()) {
    return () => {
      const w = new Worker(url, { type: "module" });
      return {
        postMessage: (msg, t) => w.postMessage(msg, t ?? []),
        addEventListener: (_t, h) => w.addEventListener("message", h as unknown as EventListener),
        removeEventListener: (_t, h) => w.removeEventListener("message", h as unknown as EventListener),
        terminate: () => w.terminate(),
      };
    };
  }

  const { Worker: NodeWorker } = await import("node:worker_threads");
  return () => {
    const nw = new NodeWorker(url, { type: "module" } as never);
    const wrappers = new Map<(e: { data: unknown }) => void, (data: unknown) => void>();
    return {
      postMessage: (msg, t) => nw.postMessage(msg, t as never),
      addEventListener: (_t, h) => {
        const fn = (data: unknown) => h({ data });
        wrappers.set(h, fn);
        nw.on("message", fn);
      },
      removeEventListener: (_t, h) => {
        const fn = wrappers.get(h);
        if (fn) {
          nw.off("message", fn);
          wrappers.delete(h);
        }
      },
      terminate: () => {
        nw.terminate();
      },
    };
  };
}

// ─── Pool ─────────────────────────────────────────────────────────────────────────

class PDFWorkerPool {
  private workers: WorkerLike[] = [];
  private nextWorker = 0;
  private nextId = 0;
  private pending = new Map<number, { resolve: (b: Uint8Array) => void; reject: (e: Error) => void }>();
  private fonts = new Map<string, Uint8Array>();

  constructor(private factory: () => WorkerLike, private size: number) {}

  /**
   * Spawn every worker and wait for each to report ready. Rejects — doesn't
   * fall back — if a worker never becomes ready (platform doesn't support
   * real Workers) or throws on construction.
   */
  async init(fontCache: Map<string, Uint8Array>): Promise<void> {
    for (const [name, data] of fontCache) this.fonts.set(name, data);
    await Promise.all(Array.from({ length: this.size }, () => this._spawnOne()));
  }

  private _spawnOne(): Promise<void> {
    return new Promise((resolve, reject) => {
      let worker: WorkerLike;
      try {
        worker = this.factory();
      } catch (e) {
        reject(workerUnsupportedError(e));
        return;
      }

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(workerUnsupportedError(
          `no "ready" message within ${READY_TIMEOUT_MS}ms`,
        ));
      }, READY_TIMEOUT_MS);

      const onReady = (e: { data: unknown }) => {
        if ((e.data as OutMessage).type !== "ready") return;
        clearTimeout(timeout);
        worker.removeEventListener("message", onReady);
        for (const [name, data] of this.fonts) {
          worker.postMessage({ type: "registerFont", name, data });
        }
        worker.addEventListener("message", (e) => this._onMessage(e.data as OutMessage));
        this.workers.push(worker);
        resolve();
      };
      worker.addEventListener("message", onReady);
    });
  }

  private _onMessage(msg: OutMessage): void {
    if (msg.type === "ready") return;
    const entry = this.pending.get(msg.id);
    if (!entry) return;
    this.pending.delete(msg.id);
    if (msg.type === "result") entry.resolve(msg.bytes);
    else entry.reject(new Error(msg.message));
  }

  /** Generate one PDF on the next worker in rotation (round-robin). */
  generate(json: string): Promise<Uint8Array> {
    const worker = this.workers[this.nextWorker];
    this.nextWorker = (this.nextWorker + 1) % this.workers.length;

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ type: "generate", id, json });
    });
  }

  /** Register a font on the main-thread cache and every live worker. */
  propagateFont(name: string, data: Uint8Array): void {
    this.fonts.set(name, data);
    for (const w of this.workers) w.postMessage({ type: "registerFont", name, data });
  }

  terminate(): void {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    for (const { reject } of this.pending.values()) reject(new Error("Worker pool terminated"));
    this.pending.clear();
  }
}

function workerUnsupportedError(cause: unknown): Error {
  return new Error(
    `initPool(): this platform doesn't support Workers (${
      cause instanceof Error ? cause.message : String(cause)
    }). ` +
      `Known case: Deno Deploy's isolate model has no OS threads. ` +
      `Don't call initPool() there — generate PDFs with the regular sync API instead.`,
  );
}

// ─── Public API ─────────────────────────────────────────────────────────────────

const _fontCache = new Map<string, Uint8Array>();
let _pool: PDFWorkerPool | null = null;

function _poolSize(): number {
  const cores = typeof navigator !== "undefined" && navigator.hardwareConcurrency > 0
    ? navigator.hardwareConcurrency
    : 2;
  return Math.min(cores, 4);
}

/**
 * Explicitly opt into worker-based generation. Throws if this platform can't
 * actually run Workers — see the module doc comment. Safe to call once at
 * startup; a second call while a pool is already active is a no-op.
 *
 * @param size Number of workers (default: min(cpu cores, 4)).
 */
export async function initPool(size?: number): Promise<void> {
  if (_pool) return;
  const factory = await makeWorkerFactory(workerEntryUrl());
  const pool = new PDFWorkerPool(factory, size ?? _poolSize());
  await pool.init(_fontCache);
  _pool = pool;
}

/** Terminate all pool workers and release their memory. */
export function terminatePool(): void {
  _pool?.terminate();
  _pool = null;
}

/** Whether a pool is currently active (`initPool()` succeeded and wasn't terminated). */
export function isPoolActive(): boolean {
  return _pool !== null;
}

/**
 * Register a font with the core WASM module *and* every live pool worker.
 * Use this instead of the regular `registerFont`/`loadFont` when you're using
 * the pool — those only register on the main thread, which workers never see.
 */
export function registerFont(name: string, data: Uint8Array): void {
  _fontCache.set(name, data);
  registerFontCore(name, data);
  _pool?.propagateFont(name, data);
}

/**
 * Generate a PDF on a pool worker instead of in-process.
 * @param pdf Anything with `toDocumentJSON()` — i.e. a `PDF` instance.
 * @throws If `initPool()` hasn't been called (or was terminated) yet.
 */
export async function generateWithPool(pdf: { toDocumentJSON(): string }): Promise<Uint8Array> {
  if (!_pool) {
    throw new Error(
      "generateWithPool() called before initPool() — call and await initPool() first.",
    );
  }
  return await _pool.generate(pdf.toDocumentJSON());
}
