/**
 * SaurioPDF — worker-pool tests. Separate from main_test.ts since the pool is
 * an opt-in module: these tests exercise real Worker spawning, so they're
 * slower than the rest of the suite and deliberately kept apart.
 * Run with: deno test --allow-read --allow-write pool_test.ts
 */

import { assert, assertEquals, assertRejects } from "@std/assert";
import { init, PDF } from "./mod.ts";
import { generateWithPool, initPool, isPoolActive, terminatePool } from "./pool.ts";

await init();

Deno.test("isPoolActive(): false before initPool()", () => {
  assertEquals(isPoolActive(), false);
});

Deno.test("generateWithPool(): throws before initPool() is called", async () => {
  const pdf = new PDF();
  pdf.p("never generated");
  await assertRejects(() => generateWithPool(pdf), Error, "initPool()");
});

Deno.test("terminatePool(): safe no-op when no pool is active", () => {
  terminatePool();
  assertEquals(isPoolActive(), false);
});

Deno.test("initPool() + generateWithPool(): generates real PDF bytes across workers", async () => {
  await initPool(2);
  assert(isPoolActive());

  try {
    const pdfs = Array.from({ length: 3 }, (_, i) => {
      const pdf = new PDF({ title: `Pool doc ${i}` });
      pdf.h1(`Doc ${i}`).p("Generated on a worker.");
      return pdf;
    });

    const results = await Promise.all(pdfs.map((p) => generateWithPool(p)));
    assertEquals(results.length, 3);
    for (const bytes of results) {
      assert(bytes.length > 0);
      assertEquals(String.fromCharCode(...bytes.slice(0, 5)), "%PDF-");
    }
  } finally {
    terminatePool();
  }

  assertEquals(isPoolActive(), false);
});
