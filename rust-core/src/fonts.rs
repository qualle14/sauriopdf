use crate::error::{PdfError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Note: font subsetting is handled automatically by Krilla during document.finish().
// Krilla uses the `subsetter` crate internally — it tracks every glyph drawn via
// draw_text() and subsets each font variant when serializing the PDF.
// No manual subsetting needed on our side.

/// Font family configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontFamily {
    pub name: String,
    pub normal: Option<Vec<u8>>,
    pub bold: Option<Vec<u8>>,
    pub italic: Option<Vec<u8>>,
    pub bold_italic: Option<Vec<u8>>,
}

/// Font manager — loads and provides font data to Krilla.
/// Subsetting is handled automatically by Krilla during PDF serialization.
pub struct FontManager {
    fonts: HashMap<String, FontFamily>,
    embedded_fonts_loaded: bool,
}

impl FontManager {
    pub fn new() -> Self {
        Self {
            fonts: HashMap::new(),
            embedded_fonts_loaded: false,
        }
    }

    /// Load embedded default fonts (Liberation Sans — 4 variants).
    /// Font bytes are compiled into the binary via include_bytes!.
    pub fn load_embedded_fonts(&mut self) -> Result<()> {
        if self.embedded_fonts_loaded {
            return Ok(());
        }

        self.fonts.insert(
            "Liberation Sans".to_string(),
            FontFamily {
                name: "Liberation Sans".to_string(),
                normal: Some(
                    include_bytes!("../../fonts/liberation-fonts-ttf-2.1.5/LiberationSans-Regular.ttf").to_vec(),
                ),
                bold: Some(
                    include_bytes!("../../fonts/liberation-fonts-ttf-2.1.5/LiberationSans-Bold.ttf").to_vec(),
                ),
                italic: Some(
                    include_bytes!("../../fonts/liberation-fonts-ttf-2.1.5/LiberationSans-Italic.ttf").to_vec(),
                ),
                bold_italic: Some(
                    include_bytes!("../../fonts/liberation-fonts-ttf-2.1.5/LiberationSans-BoldItalic.ttf").to_vec(),
                ),
            },
        );

        self.embedded_fonts_loaded = true;
        Ok(())
    }

    /// Register a custom font family
    pub fn register_font(&mut self, family: FontFamily) -> Result<()> {
        if family.normal.is_none()
            && family.bold.is_none()
            && family.italic.is_none()
            && family.bold_italic.is_none()
        {
            return Err(PdfError::FontError(
                "Font family must have at least one variant".to_string(),
            ));
        }

        self.fonts.insert(family.name.clone(), family);
        Ok(())
    }

    /// Get font data for a specific family and style
    pub fn get_font(&self, family: &str, bold: bool, italic: bool) -> Result<&[u8]> {
        let font_family = self
            .fonts
            .get(family)
            .ok_or_else(|| PdfError::FontError(format!("Font family '{}' not found", family)))?;

        let font_data = match (bold, italic) {
            (true, true) => font_family.bold_italic.as_ref(),
            (true, false) => font_family.bold.as_ref(),
            (false, true) => font_family.italic.as_ref(),
            (false, false) => font_family.normal.as_ref(),
        };

        font_data
            .or(font_family.normal.as_ref())
            .map(|v| v.as_slice())
            .ok_or_else(|| {
                PdfError::FontError(format!(
                    "No suitable font variant found for '{}'",
                    family
                ))
            })
    }

}

impl Default for FontManager {
    fn default() -> Self {
        Self::new()
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_font_manager_creation() {
        let manager = FontManager::new();
        assert_eq!(manager.fonts.len(), 0);
    }

    #[test]
    fn test_register_font() {
        let mut manager = FontManager::new();
        let family = FontFamily {
            name: "Test".to_string(),
            normal: Some(vec![1, 2, 3]),
            bold: None,
            italic: None,
            bold_italic: None,
        };

        assert!(manager.register_font(family).is_ok());
        assert_eq!(manager.fonts.len(), 1);
    }
}
