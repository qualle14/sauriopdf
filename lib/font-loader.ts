/**
 * Font Loader — universal (Deno, Node.js, Browser).
 * Reads font files from the filesystem or via fetch, then registers
 * them with the WASM module so Krilla can use them for rendering.
 */

import { registerFont } from "../wasm/sauriopdf_core.js";

export interface FontConfig {
  name: string;
  path: string;
}

/** Load Liberation Sans (4 variants: regular, bold, italic, bold-italic) */
export async function loadLiberationSans(
  basePath = "fonts/liberation-fonts-ttf-2.1.5",
): Promise<void> {
  await loadFonts([
    { name: "Liberation Sans",             path: `${basePath}/LiberationSans-Regular.ttf` },
    { name: "Liberation Sans Bold",        path: `${basePath}/LiberationSans-Bold.ttf` },
    { name: "Liberation Sans Italic",      path: `${basePath}/LiberationSans-Italic.ttf` },
    { name: "Liberation Sans Bold Italic", path: `${basePath}/LiberationSans-BoldItalic.ttf` },
  ]);
}

/** Load multiple fonts from file paths (or URLs in the browser) */
export async function loadFonts(fonts: FontConfig[]): Promise<void> {
  for (const font of fonts) {
    const data = await readBytes(font.path);
    registerFont(font.name, data);
  }
}

/** Load a single font by name and path */
export async function loadFont(name: string, path: string): Promise<void> {
  const data = await readBytes(path);
  registerFont(name, data);
}

// ── Runtime-agnostic file reader ───────────────────────────────────────────────

async function readBytes(path: string): Promise<Uint8Array> {
  // deno-lint-ignore no-explicit-any
  const _Deno = (globalThis as any).Deno as
    | { readFile(p: string): Promise<Uint8Array> }
    | undefined;

  // Deno
  if (_Deno !== undefined) {
    return _Deno.readFile(path);
  }

  // Node.js
  // deno-lint-ignore no-explicit-any
  const _process = (globalThis as any).process;
  if (
    typeof _process !== "undefined" &&
    typeof _process.versions !== "undefined" &&
    _process.versions.node
  ) {
    const { readFile } = await import("node:fs/promises");
    return new Uint8Array(await readFile(path));
  }

  // Browser / other (fetch)
  const resp = await fetch(path);
  if (!resp.ok) {
    throw new Error(`Failed to load font "${path}": HTTP ${resp.status}`);
  }
  return new Uint8Array(await resp.arrayBuffer());
}
