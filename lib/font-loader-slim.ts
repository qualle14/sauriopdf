/**
 * Font Loader — slim build variant.
 * Identical to font-loader.ts but registers fonts into the slim WASM instance.
 */

import { registerFont } from "../wasm-slim/sauriopdf_core.js";

export type { FontConfig } from "./font-loader.ts";

export async function loadBuiltinFonts(): Promise<void> {
  const base = new URL("../fonts/liberation-fonts-ttf-2.1.5", import.meta.url).href;
  await loadLiberationSans(base);
  await loadLiberationMono(base);
}

export async function loadLiberationMono(
  basePath = "fonts/liberation-fonts-ttf-2.1.5",
): Promise<void> {
  await loadFonts([
    { name: "Liberation Mono", path: `${basePath}/LiberationMono-Regular.ttf` },
    { name: "Liberation Mono Bold", path: `${basePath}/LiberationMono-Bold.ttf` },
    { name: "Liberation Mono Italic", path: `${basePath}/LiberationMono-Italic.ttf` },
    { name: "Liberation Mono Bold Italic", path: `${basePath}/LiberationMono-BoldItalic.ttf` },
  ]);
}

export async function loadLiberationSans(
  basePath = "fonts/liberation-fonts-ttf-2.1.5",
): Promise<void> {
  await loadFonts([
    { name: "Liberation Sans", path: `${basePath}/LiberationSans-Regular.ttf` },
    { name: "Liberation Sans Bold", path: `${basePath}/LiberationSans-Bold.ttf` },
    { name: "Liberation Sans Italic", path: `${basePath}/LiberationSans-Italic.ttf` },
    { name: "Liberation Sans Bold Italic", path: `${basePath}/LiberationSans-BoldItalic.ttf` },
  ]);
}

export async function loadFonts(
  fonts: { name: string; path: string }[],
): Promise<void> {
  for (const font of fonts) {
    const data = await readBytes(font.path);
    registerFont(font.name, data);
  }
}

export async function loadFont(name: string, path: string): Promise<void> {
  const data = await readBytes(path);
  registerFont(name, data);
}

// ── Runtime-agnostic file reader (shared logic) ───────────────────────────────

async function readBytes(path: string): Promise<Uint8Array> {
  const isFileUrl = path.startsWith("file:");

  // deno-lint-ignore no-explicit-any
  const _Deno = (globalThis as any).Deno as
    | { readFile(p: string | URL): Promise<Uint8Array> }
    | undefined;

  if (_Deno !== undefined) {
    return _Deno.readFile(isFileUrl ? new URL(path) : path);
  }

  // deno-lint-ignore no-explicit-any
  const _process = (globalThis as any).process;
  if (
    typeof _process !== "undefined" &&
    typeof _process.versions !== "undefined" &&
    _process.versions.node
  ) {
    const { readFile } = await import("node:fs/promises");
    if (isFileUrl) {
      const { fileURLToPath } = await import("node:url");
      return new Uint8Array(await readFile(fileURLToPath(path)));
    }
    return new Uint8Array(await readFile(path));
  }

  const resp = await fetch(path);
  if (!resp.ok) {
    throw new Error(`Failed to load font "${path}": HTTP ${resp.status}`);
  }
  return new Uint8Array(await resp.arrayBuffer());
}
