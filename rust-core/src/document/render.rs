//! Turns a `PdfDocument` into PDF bytes via Krilla. Everything that touches
//! `krilla::surface::Surface` lives here — `document.rs` only holds the model.

use super::geometry::{build_circle_path, build_rect_path};
use super::PdfDocument;
use crate::content::{ContentElement, ImageElement, LineCap, LineJoin, ShapeElement, TextElement};
use crate::error::{PdfError, Result};
use krilla::text::Font;
use std::collections::HashMap;

/// `Font::new()` parses the font (table directory, hashing, skrifa setup) —
/// real work, not just a wrapper. `Font` itself is `Arc`-backed and cheap to
/// clone, so it's meant to be built once per font and reused, not
/// reconstructed per draw call. A document with hundreds of wrapped text
/// lines makes hundreds of `render_text()` calls in the same font; without
/// this cache each one re-parsed it from scratch — measured 6x slower render
/// time for the same text split into many small elements vs one large one.
type FontCache = HashMap<(String, bool, bool), Font>;

impl PdfDocument {
    pub fn render(&self) -> Result<Vec<u8>> {
        use krilla::annotation::{Annotation, LinkAnnotation, Target};
        use krilla::action::{Action, LinkAction};
        use krilla::configure::{Archival, ConfigurationBuilder};
        use krilla::geom::Rect;
        use krilla::metadata::Metadata;
        use krilla::page::PageSettings;
        use krilla::{Document, SerializeSettings};

        let mut document = if let Some(ref pdfa) = self.config.pdfa {
            let archival = match pdfa.as_str() {
                "1a" => Archival::A1_A,
                "1b" => Archival::A1_B,
                "2a" => Archival::A2_A,
                "2b" => Archival::A2_B,
                "2u" => Archival::A2_U,
                "3a" => Archival::A3_A,
                "3b" => Archival::A3_B,
                "3u" => Archival::A3_U,
                _ => Archival::A2_B,
            };
            let configuration = ConfigurationBuilder::new()
                .with_archival_validator(archival)
                .finish()
                .map_err(|e| PdfError::RenderError(format!("Invalid PDF/A configuration: {e:?}")))?;
            let settings = SerializeSettings { configuration, ..Default::default() };
            Document::new_with(settings)
        } else {
            Document::new()
        };

        let mut meta = Metadata::new().creation_date(current_utc_date());
        if let Some(t) = &self.config.metadata.title {
            meta = meta.title(t.clone());
        }
        if let Some(a) = &self.config.metadata.author {
            meta = meta.authors(vec![a.clone()]);
        }
        if let Some(s) = &self.config.metadata.subject {
            meta = meta.description(s.clone());
        }
        meta = meta
            .creator(self.config.metadata.creator.clone())
            .producer(self.config.metadata.producer.clone());
        document.set_metadata(meta);

        let mut font_cache: FontCache = HashMap::new();

        for page in &self.pages {
            let settings = PageSettings::from_wh(
                page.dimensions.width,
                page.dimensions.height,
            )
            .ok_or_else(|| PdfError::RenderError("Invalid page dimensions".to_string()))?;

            let mut pdf_page = document.start_page_with(settings);

            // First pass: render all visual content (links are annotation-only).
            {
                let mut surface = pdf_page.surface();
                for element in &page.content {
                    if !matches!(element, ContentElement::Link(_)) {
                        self.render_element(&mut surface, element, &mut font_cache)?;
                    }
                }
                surface.finish();
            }

            // Second pass: add link annotations.
            for element in &page.content {
                if let ContentElement::Link(link) = element {
                    let r = Rect::from_ltrb(
                        link.rect.x,
                        link.rect.y,
                        link.rect.x + link.rect.width,
                        link.rect.y + link.rect.height,
                    )
                    .ok_or_else(|| PdfError::RenderError("Invalid link rect".to_string()))?;

                    let action = Action::Link(LinkAction::new(link.url.clone()));
                    pdf_page.add_annotation(Annotation::from(
                        LinkAnnotation::new(r, Target::Action(action)),
                    ));
                }
            }

            pdf_page.finish();
        }

        document
            .finish()
            .map_err(|e| PdfError::RenderError(format!("Krilla render failed: {:?}", e)))
    }

    // ── Element dispatcher ────────────────────────────────────────────────────

    fn render_element(
        &self,
        surface: &mut krilla::surface::Surface,
        element: &ContentElement,
        font_cache: &mut FontCache,
    ) -> Result<()> {
        match element {
            ContentElement::Text(t) => self.render_text(surface, t, font_cache),
            ContentElement::Image(img) => self.render_image(surface, img),
            ContentElement::Shape(s) => self.render_shape(surface, s),
            // Links are handled as page annotations in the second pass.
            ContentElement::Link(_) => Ok(()),
        }
    }

    // ── Text ──────────────────────────────────────────────────────────────────

    /// Build (or reuse) the parsed `Font` for `family`/`bold`/`italic`, caching
    /// it in `font_cache` — see the `FontCache` doc comment for why this matters.
    fn get_font(
        &self,
        font_cache: &mut FontCache,
        family: &str,
        bold: bool,
        italic: bool,
    ) -> Result<Font> {
        let key = (family.to_string(), bold, italic);
        if let Some(font) = font_cache.get(&key) {
            return Ok(font.clone());
        }

        let font_data = self.font_manager.get_font(family, bold, italic)?;
        let font = Font::new(font_data.to_vec().into(), 0)
            .ok_or_else(|| PdfError::FontError("Invalid font data".to_string()))?;
        font_cache.insert(key, font.clone());
        Ok(font)
    }

    fn render_text(
        &self,
        surface: &mut krilla::surface::Surface,
        text: &TextElement,
        font_cache: &mut FontCache,
    ) -> Result<()> {
        use krilla::color::rgb;
        use krilla::geom::Point;
        use krilla::num::NormalizedF32;
        use krilla::paint::Fill;
        use krilla::text::TextDirection;

        let font = self.get_font(font_cache, &text.font_family, text.bold, text.italic)?;

        // Text is fill-only. Krilla keeps fill/stroke state between draw calls,
        // so we must explicitly clear stroke to avoid leaking from a prior shape.
        surface.set_stroke(None);
        surface.set_fill(Some(Fill {
            paint: rgb::Color::new(text.color.r, text.color.g, text.color.b).into(),
            opacity: NormalizedF32::new(text.color.a).unwrap_or(NormalizedF32::ONE),
            rule: Default::default(),
        }));

        surface.draw_text(
            Point::from_xy(text.position.x, text.position.y),
            font,
            text.font_size,
            &text.content,
            false,
            TextDirection::Auto,
        );

        Ok(())
    }

    // ── Image ─────────────────────────────────────────────────────────────────

    fn render_image(
        &self,
        surface: &mut krilla::surface::Surface,
        img: &ImageElement,
    ) -> Result<()> {
        use base64::{engine::general_purpose, Engine as _};
        use krilla::geom::{Size, Transform};
        use krilla::Data;

        let data = general_purpose::STANDARD
            .decode(&img.data)
            .map_err(|e| PdfError::ImageError(format!("Base64 decode error: {e}")))?;

        let krilla_image = if data.starts_with(b"\x89PNG") {
            krilla::image::Image::from_png(Data::from(data), false)
                .map_err(|e| PdfError::ImageError(format!("PNG error: {e}")))?
        } else if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
            krilla::image::Image::from_jpeg(Data::from(data), false)
                .map_err(|e| PdfError::ImageError(format!("JPEG error: {e}")))?
        } else {
            // Unknown format — try decoding with the `image` crate and re-encode as PNG.
            let decoded = image::load_from_memory(&data)
                .map_err(|e| PdfError::ImageError(format!("Unsupported image format: {e}")))?;
            let mut png = Vec::new();
            decoded
                .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
                .map_err(|e| PdfError::ImageError(format!("PNG re-encode failed: {e}")))?;
            krilla::image::Image::from_png(Data::from(png), false)
                .map_err(|e| PdfError::ImageError(format!("PNG error: {e}")))?
        };

        let width = img.width.unwrap_or(100.0);
        let height = img.height.unwrap_or(100.0);

        let size = Size::from_wh(width, height)
            .ok_or_else(|| PdfError::ImageError("Invalid image dimensions".to_string()))?;

        surface.push_transform(&Transform::from_translate(img.position.x, img.position.y));
        surface.draw_image(krilla_image, size);
        surface.pop();

        Ok(())
    }

    // ── Shapes ────────────────────────────────────────────────────────────────

    /// IMPORTANT: Krilla's Surface keeps fill and stroke state across draw calls.
    /// We must set *both* explicitly before every draw_path() to avoid state leaks.
    fn render_shape(
        &self,
        surface: &mut krilla::surface::Surface,
        shape: &ShapeElement,
    ) -> Result<()> {
        use krilla::color::rgb;
        use krilla::geom::PathBuilder;
        use krilla::num::NormalizedF32;
        use krilla::paint::{Fill, LineCap as KCap, LineJoin as KJoin, Stroke};

        let make_fill = |c: &crate::types::Color| Fill {
            paint: rgb::Color::new(c.r, c.g, c.b).into(),
            opacity: NormalizedF32::new(c.a).unwrap_or(NormalizedF32::ONE),
            rule: Default::default(),
        };

        let make_stroke = |c: &crate::types::Color,
                           w: f32,
                           cap: LineCap,
                           join: LineJoin|
         -> Stroke {
            Stroke {
                paint: rgb::Color::new(c.r, c.g, c.b).into(),
                opacity: NormalizedF32::new(c.a).unwrap_or(NormalizedF32::ONE),
                width: w,
                line_cap: match cap {
                    LineCap::Butt => KCap::Butt,
                    LineCap::Round => KCap::Round,
                    LineCap::Square => KCap::Square,
                },
                line_join: match join {
                    LineJoin::Miter => KJoin::Miter,
                    LineJoin::Round => KJoin::Round,
                    LineJoin::Bevel => KJoin::Bevel,
                },
                ..Default::default()
            }
        };

        match shape {
            ShapeElement::Rectangle { rect, fill_color, stroke_color, stroke_width, border_radius } => {
                let mut pb = PathBuilder::new();
                build_rect_path(&mut pb, rect.x, rect.y, rect.width, rect.height, *border_radius);
                let path = pb
                    .finish()
                    .ok_or_else(|| PdfError::RenderError("Invalid rect path".to_string()))?;

                surface.set_fill(fill_color.as_ref().map(&make_fill));
                surface.set_stroke(stroke_color.as_ref().map(|c| {
                    make_stroke(c, *stroke_width, LineCap::Butt, LineJoin::Miter)
                }));
                surface.draw_path(&path);
            }

            ShapeElement::Circle { center, radius, fill_color, stroke_color, stroke_width } => {
                let path = build_circle_path(center.x, center.y, *radius)?;

                surface.set_fill(fill_color.as_ref().map(&make_fill));
                surface.set_stroke(stroke_color.as_ref().map(|c| {
                    make_stroke(c, *stroke_width, LineCap::Round, LineJoin::Round)
                }));
                surface.draw_path(&path);
            }

            ShapeElement::Line { start, end, color, width, line_cap, line_join, .. } => {
                let mut pb = PathBuilder::new();
                pb.move_to(start.x, start.y);
                pb.line_to(end.x, end.y);
                let path = pb
                    .finish()
                    .ok_or_else(|| PdfError::RenderError("Invalid line path".to_string()))?;

                // Lines are stroke-only; clear fill to avoid state leak.
                surface.set_fill(None);
                surface.set_stroke(Some(make_stroke(color, *width, *line_cap, *line_join)));
                surface.draw_path(&path);
            }

            ShapeElement::Path {
                points,
                fill_color,
                stroke_color,
                stroke_width,
                closed,
                line_cap,
                line_join,
            } => {
                if points.is_empty() {
                    return Ok(());
                }

                let mut pb = PathBuilder::new();
                pb.move_to(points[0].x, points[0].y);
                for p in &points[1..] {
                    pb.line_to(p.x, p.y);
                }
                if *closed {
                    pb.close();
                }
                let path = pb
                    .finish()
                    .ok_or_else(|| PdfError::RenderError("Invalid path".to_string()))?;

                surface.set_fill(fill_color.as_ref().map(&make_fill));
                surface.set_stroke(stroke_color.as_ref().map(|c| {
                    make_stroke(c, *stroke_width, *line_cap, *line_join)
                }));
                surface.draw_path(&path);
            }
        }

        Ok(())
    }
}

// ─── Creation-date helper ───────────────────────────────────────────────────────

/// The document creation date. Krilla's PDF/A validators reject documents without
/// one. WASM has no system clock, so we read the host JS `Date`; native builds
/// (e.g. `cargo test`) fall back to `SystemTime`, since `js_sys` calls panic there.
#[cfg(target_arch = "wasm32")]
fn current_utc_date() -> krilla::metadata::DateTime {
    let now = js_sys::Date::new_0();
    krilla::metadata::DateTime::new(now.get_utc_full_year() as u16)
        .month(now.get_utc_month() as u8 + 1)
        .day(now.get_utc_date() as u8)
        .hour(now.get_utc_hours() as u8)
        .minute(now.get_utc_minutes() as u8)
        .second(now.get_utc_seconds() as u8)
        .utc_offset_hour(0)
}

#[cfg(not(target_arch = "wasm32"))]
fn current_utc_date() -> krilla::metadata::DateTime {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let (days, secs_of_day) = (secs / 86_400, secs % 86_400);
    let (year, month, day) = civil_from_days(days as i64);

    krilla::metadata::DateTime::new(year as u16)
        .month(month)
        .day(day)
        .hour((secs_of_day / 3600) as u8)
        .minute((secs_of_day / 60 % 60) as u8)
        .second((secs_of_day % 60) as u8)
        .utc_offset_hour(0)
}

/// Convert a day count since the Unix epoch (1970-01-01) to a (year, month, day)
/// civil date. Howard Hinnant's `civil_from_days` algorithm — proleptic Gregorian,
/// correct over the full `i64` range, no external date library needed.
#[cfg(not(target_arch = "wasm32"))]
fn civil_from_days(z: i64) -> (i64, u8, u8) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u8;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u8;
    (if m <= 2 { y + 1 } else { y }, m, d)
}
