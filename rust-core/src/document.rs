use crate::content::ContentElement;
use crate::error::Result;
use crate::fonts::FontManager;
use crate::types::{Margin, Orientation, PageDimensions, PageSize};
use serde::{Deserialize, Serialize};

mod geometry;
mod render;

// ─── Document metadata ────────────────────────────────────────────────────────

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

// ─── Document configuration ───────────────────────────────────────────────────

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
    /// Width in points when page_size = Custom.
    #[serde(default)]
    pub custom_width: Option<f32>,
    /// Height in points when page_size = Custom.
    #[serde(default)]
    pub custom_height: Option<f32>,
}

impl Default for DocumentConfig {
    fn default() -> Self {
        Self {
            page_size: PageSize::A4,
            orientation: Orientation::Portrait,
            margin: Margin::uniform(72.0),
            metadata: DocumentMetadata::default(),
            compress: true,
            pdf_version: "1.7".to_string(),
            pdfa: None,
            custom_width: None,
            custom_height: None,
        }
    }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page {
    pub dimensions: PageDimensions,
    pub content: Vec<ContentElement>,
}

impl Page {
    pub fn new(dimensions: PageDimensions) -> Self {
        Self { dimensions, content: Vec::new() }
    }

    pub fn add_content(&mut self, element: ContentElement) {
        self.content.push(element);
    }
}

// ─── PDF document ─────────────────────────────────────────────────────────────
//
// Rendering (`render()` and friends) lives in `document::render`; path-building
// math lives in `document::geometry`. Both are submodules so they can still
// reach these private fields.

pub struct PdfDocument {
    config: DocumentConfig,
    pages: Vec<Page>,
    font_manager: FontManager,
}

impl PdfDocument {
    pub fn new(config: DocumentConfig) -> Self {
        let mut font_manager = FontManager::new();
        let _ = font_manager.load_embedded_fonts();
        Self { config, pages: Vec::new(), font_manager }
    }

    pub fn add_page(&mut self) -> &mut Page {
        let dimensions = match self.config.page_size {
            PageSize::Custom => PageDimensions::custom(
                self.config.custom_width.unwrap_or(595.0),
                self.config.custom_height.unwrap_or(842.0),
            ),
            _ => PageDimensions::from_page_size(self.config.page_size, self.config.orientation),
        };
        self.pages.push(Page::new(dimensions));
        self.pages.last_mut().unwrap()
    }

    pub fn current_page(&mut self) -> &mut Page {
        if self.pages.is_empty() {
            self.add_page();
        }
        self.pages.last_mut().unwrap()
    }

    pub fn font_manager(&mut self) -> &mut FontManager {
        &mut self.font_manager
    }

    pub fn register_font_family(&mut self, family: crate::fonts::FontFamily) -> Result<()> {
        self.font_manager.register_font(family)
    }
}
