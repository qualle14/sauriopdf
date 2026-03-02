/**
 * Ejemplo: Modo Manual
 * Tú controlas exactamente las coordenadas x,y de cada elemento.
 * Útil para credenciales, tarjetas, tickets, diplomas, etc.
 */

import { init, PDF, text, rect, circle, line } from "./mod.ts";

await init();

// Tarjeta de empleado — tamaño crédito: 85.6mm × 54mm = 243 × 153 pt
const W = 243;
const H = 153;

const pdf = new PDF({
  title: "Gafete Empleado",
  pageSize: "A4",      // página A4 normal
  margin: 72,
});

// ── fondo de la tarjeta ───────────────────────────────────────────────────────
pdf.add(rect(0, 0, W, H).fill("#1a1a2e"));

// ── franja de color ───────────────────────────────────────────────────────────
pdf.add(rect(0, 0, 8, H).fill("#e11d48"));

// ── avatar circular ───────────────────────────────────────────────────────────
pdf.add(circle(48, 62, 28).fill("#334155").stroke("#e11d48", 2));
// inicial del nombre
pdf.add(text("MG").at(37, 55).size(18).bold().color("white"));

// ── nombre y puesto ───────────────────────────────────────────────────────────
pdf.add(text("Mario García").at(88, 38).size(14).bold().color("white"));
pdf.add(text("Desarrollador Full Stack").at(88, 56).size(9).color("#94a3b8"));

// ── separador ─────────────────────────────────────────────────────────────────
pdf.add(line(88, 72, W - 14, 72).color("#334155").width(0.5));

// ── empresa ───────────────────────────────────────────────────────────────────
pdf.add(text("ACME CORP").at(88, 82).size(8).color("#e11d48").bold());

// ── ID y departamento ─────────────────────────────────────────────────────────
pdf.add(text("ID: EMP-2024-042").at(88, 98).size(8).color("#64748b"));
pdf.add(text("Depto: Ingeniería").at(88, 112).size(8).color("#64748b"));

// ── borde completo de la tarjeta ──────────────────────────────────────────────
pdf.add(rect(0, 0, W, H).stroke("#334155", 1));

// ── vigencia ──────────────────────────────────────────────────────────────────
pdf.add(text("Vigencia: 2024–2025").at(14, H - 14).size(7).color("#475569"));

await pdf.save("ejemplo-manual.pdf");
console.log("✓ ejemplo-manual.pdf generado");
