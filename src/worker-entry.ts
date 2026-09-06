/// <reference lib="webworker" />

/**
 * Entry point loaded inside each pool worker — never imported directly by
 * user code. Runs its own private WASM instance and answers messages from
 * the main thread (`src/pool.ts`).
 *
 * Deno / Bun / browser workers use the standard `self`/`postMessage` Worker
 * API; Node.js workers use `node:worker_threads`'s `parentPort` instead —
 * this file detects which one it's running under and binds accordingly.
 *
 * The `webworker` lib reference above (instead of this project's usual
 * `deno.window`) is why this file is type-checked on its own
 * (`deno check src/worker-entry.ts`), not as part of `deno task check` —
 * `self` here is a worker global scope, not the window/main-thread one.
 */

import { ensureWasmReady, generatePdf, registerFont } from "./wasm.ts";

// ─── Message protocol (mirrors src/pool.ts) ──────────────────────────────────────

type InMessage =
  | { type: "registerFont"; name: string; data: Uint8Array }
  | { type: "generate"; id: number; json: string };

type OutMessage =
  | { type: "ready" }
  | { type: "result"; id: number; bytes: Uint8Array }
  | { type: "error"; id: number; message: string };

function handle(msg: InMessage, reply: (r: OutMessage, transfer?: Transferable[]) => void): void {
  if (msg.type === "registerFont") {
    registerFont(msg.name, msg.data);
    return;
  }

  try {
    const bytes = generatePdf(msg.json);
    reply({ type: "result", id: msg.id, bytes }, [bytes.buffer as ArrayBuffer]);
  } catch (e) {
    reply({ type: "error", id: msg.id, message: e instanceof Error ? e.message : String(e) });
  }
}

// ─── Runtime binding ─────────────────────────────────────────────────────────────

/** Mirrors src/pool.ts's isNode() — must agree on which side spawned this worker. */
function isNode(): boolean {
  const g = globalThis as Record<string, unknown>;
  if (g["Deno"] !== undefined) return false;
  const versions = (g["process"] as { versions?: Record<string, string> } | undefined)?.versions;
  if (!versions || typeof versions["bun"] === "string") return false;
  return typeof versions["node"] === "string";
}

async function main(): Promise<void> {
  await ensureWasmReady();

  if (isNode()) {
    const { parentPort } = await import("node:worker_threads");
    if (!parentPort) {
      throw new Error("worker-entry.ts must run inside a worker_threads Worker");
    }
    parentPort.on(
      "message",
      (msg: InMessage) => handle(msg, (reply, transfer) => parentPort.postMessage(reply, transfer as never)),
    );
    parentPort.postMessage({ type: "ready" } satisfies OutMessage);
  } else {
    self.onmessage = (e: MessageEvent<InMessage>) =>
      handle(e.data, (reply, transfer) => self.postMessage(reply, transfer ?? []));
    self.postMessage({ type: "ready" } satisfies OutMessage);
  }
}

await main();
