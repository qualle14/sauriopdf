//! Real glyph advance widths, read from the font's own `hmtx`/`hhea` tables.
//!
//! TypeScript's layout engine (wrapping, alignment) needs to know how wide a
//! string renders in a given font before Krilla ever draws it. Rather than
//! guessing with an average character width, we read the actual per-glyph
//! advance straight from the font data already loaded for rendering.

use crate::error::{PdfError, Result};

/// Per-character advance widths (in points) for `text` set in `font_data` at
/// `font_size`. One entry per Unicode scalar value in `text`, in order.
///
/// A character the font has no glyph for (and the control characters — advance
/// zero) falls back to half an em, so one unmapped glyph can't derail wrapping.
pub fn measure_chars(font_data: &[u8], text: &str, font_size: f32) -> Result<Vec<f32>> {
    let face = ttf_parser::Face::parse(font_data, 0)
        .map_err(|e| PdfError::FontError(format!("Invalid font data: {e}")))?;
    let units_per_em = face.units_per_em() as f32;
    let fallback = font_size * 0.5;

    Ok(text
        .chars()
        .map(|ch| {
            face.glyph_index(ch)
                .and_then(|gid| face.glyph_hor_advance(gid))
                .map(|units| units as f32 / units_per_em * font_size)
                .unwrap_or(fallback)
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    const LIBERATION_SANS: &[u8] =
        include_bytes!("../../fonts/liberation-fonts-ttf-2.1.5/LiberationSans-Regular.ttf");

    #[test]
    fn measures_one_width_per_char() {
        let widths = measure_chars(LIBERATION_SANS, "Hi!", 12.0).unwrap();
        assert_eq!(widths.len(), 3);
        assert!(widths.iter().all(|w| *w > 0.0));
    }

    #[test]
    fn narrow_and_wide_glyphs_differ() {
        // 'i' and 'M' should not have the same advance in a proportional font.
        let widths = measure_chars(LIBERATION_SANS, "iM", 12.0).unwrap();
        assert!(widths[1] > widths[0]);
    }

    #[test]
    fn scales_linearly_with_font_size() {
        let small = measure_chars(LIBERATION_SANS, "A", 10.0).unwrap();
        let big = measure_chars(LIBERATION_SANS, "A", 20.0).unwrap();
        assert!((big[0] - small[0] * 2.0).abs() < 0.01);
    }
}
