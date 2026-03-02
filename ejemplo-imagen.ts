/**
 * Prueba real: PDF con imagen PNG
 * Descarga una imagen real de internet y la embebe en el PDF.
 */

import { init, PDF } from "./mod.ts";

await init();

// Descargar imagen PNG real
console.log("Descargando imagen...");
const resp = await fetch("https://www.gstatic.com/webp/gallery/1.jpg");
const imgBytes = new Uint8Array(await resp.arrayBuffer());
console.log(`Imagen cargada: ${imgBytes.length} bytes (${(imgBytes.length / 1024).toFixed(1)} KB)`);

const pdf = new PDF({ title: "Prueba de imagen" });

pdf
  .h1("Imágenes en SaurioPDF")
  .spacer(8)
  .p(
    `Imagen JPEG de ${(imgBytes.length / 1024).toFixed(1)} KB embebida correctamente.`,
    { color: "slategray" },
  )
  .spacer(16);

// Modo layout — imagen al tamaño que quieras
pdf.img(imgBytes, { width: 400, height: 265 });

pdf
  .spacer(12)
  .p("Imagen renderizada con Krilla/WASM — bytes enviados como base64.", {
    size: 9,
    color: "gray",
    align: "Center",
  });

await pdf.save("ejemplo-imagen.pdf");
console.log("✓ ejemplo-imagen.pdf generado");
