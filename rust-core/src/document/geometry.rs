//! Path-building math for shapes that Krilla has no native primitive for
//! (rounded rectangles, circles). Pure geometry — no Krilla surface calls.

/// Build a rectangle path. When `radius > 0`, corners are rounded with cubic Béziers.
pub(super) fn build_rect_path(
    pb: &mut krilla::geom::PathBuilder,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    r: f32,
) {
    if r <= 0.0 {
        pb.move_to(x, y);
        pb.line_to(x + w, y);
        pb.line_to(x + w, y + h);
        pb.line_to(x, y + h);
    } else {
        // Clamp radius so it can't exceed half the shortest side.
        let r = r.min(w / 2.0).min(h / 2.0);
        // Bézier control-point offset that best approximates a quarter-circle arc.
        let k = r * 0.5519_1502_f32;

        pb.move_to(x + r, y);
        pb.line_to(x + w - r, y);
        pb.cubic_to(x + w - r + k, y, x + w, y + r - k, x + w, y + r);
        pb.line_to(x + w, y + h - r);
        pb.cubic_to(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h);
        pb.line_to(x + r, y + h);
        pb.cubic_to(x + r - k, y + h, x, y + h - r + k, x, y + h - r);
        pb.line_to(x, y + r);
        pb.cubic_to(x, y + r - k, x + r - k, y, x + r, y);
    }
    pb.close();
}

/// Build a circle path using four cubic Bézier arcs.
pub(super) fn build_circle_path(
    cx: f32,
    cy: f32,
    r: f32,
) -> crate::error::Result<krilla::geom::Path> {
    let k = r * 0.5519_1502_f32;
    let mut pb = krilla::geom::PathBuilder::new();

    pb.move_to(cx + r, cy);
    pb.cubic_to(cx + r, cy + k, cx + k, cy + r, cx, cy + r);
    pb.cubic_to(cx - k, cy + r, cx - r, cy + k, cx - r, cy);
    pb.cubic_to(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
    pb.cubic_to(cx + k, cy - r, cx + r, cy - k, cx + r, cy);
    pb.close();

    pb.finish()
        .ok_or_else(|| crate::error::PdfError::RenderError("Invalid circle path".to_string()))
}
