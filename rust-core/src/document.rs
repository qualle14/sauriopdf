use crate::content::{ContentElement, ImageElement, ShapeElement, TextElement};
use crate::error::{PdfError, Result};
use crate::fonts::FontManager;
use crate::types::{Margin, Orientation, PageDimensions, PageSize};
use serde::{Deserialize, Serialize};

/// PDF document metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub subject: Option<String>,
    pub keywords: Vec<String>,
    pub creator: String,
    pub producer: String,
}

impl Default for DocumentMetadata {
    fn default() -> Self {
        Self {
            title: None,
            author: None,
            subject: None,
            keywords: Vec::new(),
            creator: "SaurioPDF".to_string(),
            producer: "SaurioPDF/Krilla".to_string(),
        }
    }
}

/// PDF document configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentConfig {
    pub page_size: PageSize,
    pub orientation: Orientation,
    pub margin: Margin,
    pub metadata: DocumentMetadata,
    pub compress: bool,
    pub pdf_version: String,
    /// PDF/A conformance level: "1a", "1b", "2a", "2b", "2u", "3a", "3b", "3u"
    #[serde(default)]
    pub pdfa: Option<String>,
}

impl Default for DocumentConfig {
    fn default() -> Self {
        Self {
            page_size: PageSize::A4,
            orientation: Orientation::Portrait,
            margin: Margin::uniform(72.0), // 1 inch
            metadata: DocumentMetadata::default(),
            compress: true,
            pdf_version: "1.7".to_string(),
            pdfa: None,
        }
    }
}

/// Represents a page in the PDF document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page {
    pub dimensions: PageDimensions,
    pub content: Vec<ContentElement>,
}

impl Page {
    pub fn new(dimensions: PageDimensions) -> Self {
        Self {
            dimensions,
            content: Vec::new(),
        }
    }

    pub fn add_content(&mut self, element: ContentElement) {
        self.content.push(element);
    }
}

/// PDF Document structure
pub struct PdfDocument {
    config: DocumentConfig,
    pages: Vec<Page>,
    font_manager: FontManager,
}

impl PdfDocument {
    pub fn new(config: DocumentConfig) -> Self {
        let mut font_manager = FontManager::new();
        let _ = font_manager.load_embedded_fonts();

        Self {
            config,
            pages: Vec::new(),
            font_manager,
        }
    }

    /// Add a new page
    pub fn add_page(&mut self) -> &mut Page {
        let dimensions =
            PageDimensions::from_page_size(self.config.page_size, self.config.orientation);

        let page = Page::new(dimensions);
        self.pages.push(page);
        self.pages.last_mut().unwrap()
    }

    /// Get current page (or create one if none exists)
    pub fn current_page(&mut self) -> &mut Page {
        if self.pages.is_empty() {
            self.add_page();
        }
        self.pages.last_mut().unwrap()
    }

    /// Get font manager
    pub fn font_manager(&mut self) -> &mut FontManager {
        &mut self.font_manager
    }

    /// Register a font family
    pub fn register_font_family(&mut self, font_family: crate::fonts::FontFamily) -> Result<()> {
        self.font_manager.register_font(font_family)
    }

    /// Render the PDF to bytes using Krilla
    pub fn render(&self) -> Result<Vec<u8>> {
        use krilla::Document;
        use krilla::page::PageSettings;
        use krilla::metadata::Metadata;
        use krilla::annotation::{Annotation, LinkAnnotation, Target};
        use krilla::action::{Action, LinkAction};
        use krilla::geom::Rect;
        use krilla::SerializeSettings;
        use krilla::configure::{Configuration, Validator};

        // Create a Krilla document — with PDF/A settings when requested
        let mut document = if let Some(ref pdfa) = self.config.pdfa {
            let validator = match pdfa.as_str() {
                "1a" => Validator::A1_A,
                "1b" => Validator::A1_B,
                "2a" => Validator::A2_A,
                "2b" => Validator::A2_B,
                "2u" => Validator::A2_U,
                "3a" => Validator::A3_A,
                "3b" => Validator::A3_B,
                "3u" => Validator::A3_U,
                _    => Validator::A2_B, // safe default
            };
            let mut settings = SerializeSettings::default();
            settings.configuration = Configuration::new_with_validator(validator);
            Document::new_with(settings)
        } else {
            Document::new()
        };

        // Set metadata
        let mut metadata = Metadata::new();

        if let Some(title) = &self.config.metadata.title {
            metadata = metadata.title(title.clone());
        }
        if let Some(author) = &self.config.metadata.author {
            metadata = metadata.authors(vec![author.clone()]);
        }
        if let Some(subject) = &self.config.metadata.subject {
            metadata = metadata.description(subject.clone());
        }

        metadata = metadata.creator(self.config.metadata.creator.clone());
        metadata = metadata.producer(self.config.metadata.producer.clone());

        document.set_metadata(metadata);

        // Add pages
        for page in &self.pages {
            // Create page with dimensions
            let page_settings = PageSettings::from_wh(
                page.dimensions.width as f32,
                page.dimensions.height as f32,
            )
            .ok_or_else(|| PdfError::RenderError("Invalid page dimensions".to_string()))?;

            let mut pdf_page = document.start_page_with(page_settings);

            // First pass: render all visual content (skip Link elements)
            {
                let mut surface = pdf_page.surface();
                for element in &page.content {
                    if !matches!(element, ContentElement::Link(_)) {
                        self.render_content_element(&mut surface, element)?;
                    }
                }
                surface.finish();
            }

            // Second pass: add link annotations at page level
            for element in &page.content {
                if let ContentElement::Link(link) = element {
                    let krilla_rect = Rect::from_ltrb(
                        link.rect.x,
                        link.rect.y,
                        link.rect.x + link.rect.width,
                        link.rect.y + link.rect.height,
                    )
                    .ok_or_else(|| PdfError::RenderError("Invalid link rect".to_string()))?;

                    let action = Action::Link(LinkAction::new(link.url.clone()));
                    let annotation = Annotation::from(
                        LinkAnnotation::new(krilla_rect, Target::Action(action)),
                    );
                    pdf_page.add_annotation(annotation);
                }
            }

            pdf_page.finish();
        }

        // Render to bytes
        let pdf_bytes = document
            .finish()
            .map_err(|e| PdfError::RenderError(format!("Failed to render PDF: {:?}", e)))?;

        Ok(pdf_bytes)
    }

    /// Render a single content element using Krilla's Surface API
    fn render_content_element(
        &self,
        surface: &mut krilla::surface::Surface,
        element: &ContentElement,
    ) -> Result<()> {
        match element {
            ContentElement::Text(text) => {
                self.render_text(surface, text)?;
            }
            ContentElement::Image(img) => {
                self.render_image(surface, img)?;
            }
            ContentElement::Link(_) => {
                // Links are handled as page annotations, not surface content.
                // This branch is unreachable in normal rendering (render() skips links
                // before calling render_content_element), but kept for exhaustiveness.
            }
            ContentElement::Shape(shape) => {
                self.render_shape(surface, shape)?;
            }
        }

        Ok(())
    }

    /// Render text element
    fn render_text(&self, surface: &mut krilla::surface::Surface, text: &TextElement) -> Result<()> {
        use krilla::text::{Font, TextDirection};
        use krilla::geom::Point;
        use krilla::paint::Fill;
        use krilla::color::rgb;
        use krilla::num::NormalizedF32;

        // Get font data
        let font_data = self
            .font_manager
            .get_font(&text.font_family, text.bold, text.italic)?;

        // Create Krilla font
        let font = Font::new(font_data.to_vec().into(), 0)
            .ok_or_else(|| PdfError::FontError("Invalid font data".to_string()))?;

        // Text is fill-only — explicitly clear any stale stroke from previous shapes.
        // Krilla's surface keeps fill and stroke state persistent across draw calls,
        // so we must set BOTH to avoid leaking state between elements.
        surface.set_stroke(None);
        surface.set_fill(Some(Fill {
            paint: rgb::Color::new(text.color.r, text.color.g, text.color.b).into(),
            opacity: NormalizedF32::new(text.color.a).unwrap_or(NormalizedF32::ONE),
            rule: Default::default(),
        }));

        let point = Point::from_xy(text.position.x as f32, text.position.y as f32);
        surface.draw_text(point, font, text.font_size as f32, &text.content, false, TextDirection::Auto);

        Ok(())
    }

    /// Render image element
    fn render_image(&self, surface: &mut krilla::surface::Surface, img: &ImageElement) -> Result<()> {
        use krilla::geom::{Transform, Size};
        use krilla::Data;
        use base64::{Engine as _, engine::general_purpose};

        // Decode base64 → raw bytes (avoids sending huge integer arrays over JSON)
        let data = general_purpose::STANDARD
            .decode(&img.data)
            .map_err(|e| PdfError::ImageError(format!("Base64 decode error: {}", e)))?;

        // Determine image format and create Krilla image
        let krilla_image = if data.starts_with(b"\x89PNG") {
            krilla::image::Image::from_png(Data::from(data), false)
                .map_err(|e| PdfError::ImageError(format!("PNG error: {}", e)))?
        } else if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
            krilla::image::Image::from_jpeg(Data::from(data), false)
                .map_err(|e| PdfError::ImageError(format!("JPEG error: {}", e)))?
        } else {
            // Fallback: try to decode with image crate and convert to PNG bytes
            let image = image::load_from_memory(&data)
                .map_err(|e| PdfError::ImageError(e.to_string()))?;

            let mut png_bytes = Vec::new();
            image.write_to(&mut std::io::Cursor::new(&mut png_bytes), image::ImageFormat::Png)
                .map_err(|e| PdfError::ImageError(format!("Failed to encode PNG: {}", e)))?;

            krilla::image::Image::from_png(Data::from(png_bytes), false)
                .map_err(|e| PdfError::ImageError(format!("PNG error: {}", e)))?
        };

        // Get image dimensions
        let width = img.width.unwrap_or(100.0); // Default width
        let height = img.height.unwrap_or(100.0); // Default height

        // Apply transform to position
        let transform = Transform::from_translate(img.position.x as f32, img.position.y as f32);
        surface.push_transform(&transform);

        // Draw image with size
        let size = Size::from_wh(width, height)
            .ok_or_else(|| PdfError::ImageError("Invalid image dimensions".to_string()))?;
        surface.draw_image(krilla_image, size);

        // Pop transform
        surface.pop();

        Ok(())
    }

    /// Render shape element.
    ///
    /// IMPORTANT: Krilla's Surface keeps fill and stroke state persistent between
    /// draw calls. Every draw_path() uses BOTH the current fill AND stroke — whatever
    /// was set last, even from a different element. We must always set both explicitly
    /// (clearing unused ones with None) before every draw call.
    fn render_shape(&self, surface: &mut krilla::surface::Surface, shape: &ShapeElement) -> Result<()> {
        use krilla::geom::PathBuilder;
        use krilla::paint::{Fill, Stroke};
        use krilla::color::rgb;
        use krilla::num::NormalizedF32;

        // Helper: build Fill from our Color type
        let make_fill = |c: &crate::types::Color| Fill {
            paint: rgb::Color::new(c.r, c.g, c.b).into(),
            opacity: NormalizedF32::new(c.a).unwrap_or(NormalizedF32::ONE),
            rule: Default::default(),
        };

        // Helper: build Stroke from our Color type and width
        let make_stroke = |c: &crate::types::Color, w: f32| Stroke {
            paint: rgb::Color::new(c.r, c.g, c.b).into(),
            opacity: NormalizedF32::new(c.a).unwrap_or(NormalizedF32::ONE),
            width: w,
            ..Default::default()
        };

        match shape {
            ShapeElement::Rectangle {
                rect,
                fill_color,
                stroke_color,
                stroke_width,
                border_radius: _,
            } => {
                let mut pb = PathBuilder::new();
                pb.move_to(rect.x as f32, rect.y as f32);
                pb.line_to((rect.x + rect.width) as f32, rect.y as f32);
                pb.line_to((rect.x + rect.width) as f32, (rect.y + rect.height) as f32);
                pb.line_to(rect.x as f32, (rect.y + rect.height) as f32);
                pb.close();
                let path = pb.finish()
                    .ok_or_else(|| PdfError::RenderError("Invalid rect path".to_string()))?;

                // Set both fill and stroke explicitly — draw once
                surface.set_fill(fill_color.as_ref().map(&make_fill));
                surface.set_stroke(stroke_color.as_ref().map(|c| make_stroke(c, *stroke_width as f32)));
                surface.draw_path(&path);
            }

            ShapeElement::Circle {
                center,
                radius,
                fill_color,
                stroke_color,
                stroke_width,
            } => {
                let r  = *radius as f32;
                let c  = r * 0.5519150244; // Bézier approximation constant
                let cx = center.x as f32;
                let cy = center.y as f32;

                let mut pb = PathBuilder::new();
                pb.move_to(cx + r, cy);
                pb.cubic_to(cx + r, cy + c, cx + c, cy + r, cx, cy + r);
                pb.cubic_to(cx - c, cy + r, cx - r, cy + c, cx - r, cy);
                pb.cubic_to(cx - r, cy - c, cx - c, cy - r, cx, cy - r);
                pb.cubic_to(cx + c, cy - r, cx + r, cy - c, cx + r, cy);
                pb.close();
                let path = pb.finish()
                    .ok_or_else(|| PdfError::RenderError("Invalid circle path".to_string()))?;

                surface.set_fill(fill_color.as_ref().map(&make_fill));
                surface.set_stroke(stroke_color.as_ref().map(|c| make_stroke(c, *stroke_width as f32)));
                surface.draw_path(&path);
            }

            ShapeElement::Line { start, end, color, width } => {
                let mut pb = PathBuilder::new();
                pb.move_to(start.x as f32, start.y as f32);
                pb.line_to(end.x as f32, end.y as f32);
                let path = pb.finish()
                    .ok_or_else(|| PdfError::RenderError("Invalid line path".to_string()))?;

                // Lines are stroke-only — explicitly clear fill
                surface.set_fill(None);
                surface.set_stroke(Some(make_stroke(color, *width as f32)));
                surface.draw_path(&path);
            }

            ShapeElement::Path {
                points,
                fill_color,
                stroke_color,
                stroke_width,
                closed,
            } => {
                if points.is_empty() {
                    return Ok(());
                }

                let mut pb = PathBuilder::new();
                pb.move_to(points[0].x as f32, points[0].y as f32);
                for point in &points[1..] {
                    pb.line_to(point.x as f32, point.y as f32);
                }
                if *closed {
                    pb.close();
                }
                let path = pb.finish()
                    .ok_or_else(|| PdfError::RenderError("Invalid path".to_string()))?;

                surface.set_fill(fill_color.as_ref().map(&make_fill));
                surface.set_stroke(stroke_color.as_ref().map(|c| make_stroke(c, *stroke_width as f32)));
                surface.draw_path(&path);
            }
        }

        Ok(())
    }
}

