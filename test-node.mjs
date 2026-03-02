// Prueba Node.js — init + imagen + PDF
import { init, PDF } from "./dist/mod.js";
import { writeFileSync } from "node:fs";

console.log("Iniciando WASM en Node.js...");
await init();
console.log("WASM listo.");

// Descargar imagen
const resp = await fetch("https://www.gstatic.com/webp/gallery/1.jpg");
const imgBytes = new Uint8Array(await resp.arrayBuffer());
console.log(`Imagen cargada: ${(imgBytes.length / 1024).toFixed(1)} KB`);

const pdf = new PDF({ title: "Prueba Node.js" });

pdf
  .h1("Generado desde Node.js")
  .spacer(8)
  .p("Si ves esto, SaurioPDF funciona en Node.js con WASM cargado por readFileSync.", {
    color: "slategray",
  })
  .spacer(16)
  .img(imgBytes, { width: 400, height: 265 })
  .spacer(12)
  .table({
    headers: ["Runtime", "Estado", "WASM"],
    rows: [
      ["Deno",    "✓ OK", "fetch(URL)"],
      ["Node.js", "✓ OK", "readFileSync"],
      ["Browser", "✓ OK", "fetch(URL)"],
    ],
    striped: true,
    headerBg: "#1a1a2e",
  });

const bytes = await pdf.generate();
writeFileSync("test-node-output.pdf", bytes);
console.log(`✓ test-node-output.pdf generado (${(bytes.length / 1024).toFixed(1)} KB)`);
