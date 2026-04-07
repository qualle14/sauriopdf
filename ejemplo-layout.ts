/**
 * Ejemplo: Modo Layout
 * El cursor avanza solo, page breaks automáticos, tú solo dices QUÉ.
 */

import { init, PDF } from "./mod.ts";

await init();

const pdf = new PDF({ title: "Factura #1042", author: "Taquería El Borrego" });

// Header en todas las páginas
pdf.header(44, (ctx) => {
  ctx.add({
    Shape: {
      Rectangle: {
        rect: { x: 0, y: 0, width: ctx.width, height: ctx.height },
        fill_color: { r: 180, g: 30, b: 30, a: 1 },
        stroke_color: null,
        stroke_width: 0,
        border_radius: 0,
      },
    },
  });
});

// Footer con número de página
pdf.footer(24, (ctx) => {
  ctx.add({
    Text: {
      content: `Página ${ctx.pageNum} de ${ctx.totalPages}`,
      position: { x: 0, y: 8 },
      font_family: "Liberation Sans",
      font_size: 9,
      color: { r: 120, g: 120, b: 120, a: 1 },
      bold: false,
      italic: false,
      align: "Center",
      max_width: ctx.width,
    },
  });
});

pdf
  .h1("Factura #1042")
  .spacer(4)
  .p("Fecha: 1 de marzo 2026  |  Vence: 31 de marzo 2026", { color: "slategray" })
  .spacer(20)
  .section({ background: "#f8fafc", borderColor: "#cbd5e1", padding: 14 }, (s) => {
    s.p("Facturar a:", { bold: true, size: 10, color: "slategray" });
    s.p("Globex Corporation\n742 Evergreen Terrace\nCDMX, México");
  })
  .spacer(20)
  .h2("Conceptos")
  .spacer(6)
  .table({
    headers: ["Descripción", "Cant", "Precio unitario", "Total"],
    rows: [
      ["Tacos de canasta (docena)", "5", "$85.00", "$425.00"],
      ["Agua de horchata (litro)", "3", "$35.00", "$105.00"],
      ["Torta de pierna", "10", "$55.00", "$550.00"],
      ["Flautas de papa (orden)", "2", "$70.00", "$140.00"],
    ],
    striped: true,
    headerBg: "#b41e1e",
    widths: [0.45, 0.1, 0.25, 0.2],
  })
  .spacer(8)
  .p("Subtotal: $1,220.00", { align: "Right", size: 11 })
  .p("IVA 16%:  $195.20", { align: "Right", size: 11, color: "slategray" })
  .p("Total:    $1,415.20", { align: "Right", size: 14, bold: true })
  .spacer(24)
  .hr({ color: "#e2e8f0" })
  .spacer(12)
  .p(
    "Pago en efectivo o transferencia en un plazo de 30 días. ¡Gracias por su preferencia!",
    {
      color: "slategray",
      align: "Center",
      size: 10,
    },
  );

await pdf.save("ejemplo-layout.pdf");
console.log("✓ ejemplo-layout.pdf generado");
