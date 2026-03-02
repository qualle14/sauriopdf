/**
 * Integration tests for SaurioPDF Core
 */

use sauriopdf_core::*;

#[test]
fn test_version() {
    let ver = version();
    assert_eq!(ver, "0.1.0");
}

#[test]
fn test_document_creation() {
    let config = document::DocumentConfig::default();
    let mut doc = document::PdfDocument::new(config);

    // Should start with no pages
    // (pages are added lazily)

    // Add a page
    doc.add_page();

    // Should render without error (even if empty)
    let result = doc.render();
    assert!(result.is_ok(), "Failed to render empty document");
}

#[test]
fn test_text_element() {
    use content::{TextElement, ContentElement};
    use types::{Point, Color, TextAlign};

    let text = TextElement {
        content: "Test text".to_string(),
        position: Point { x: 100.0, y: 100.0 },
        font_family: "Liberation Sans".to_string(),
        font_size: 12.0,
        color: Color { r: 0, g: 0, b: 0, a: 1.0 },
        bold: false,
        italic: false,
        align: TextAlign::Left,
        max_width: None,
    };

    let element = ContentElement::Text(text);

    // Should serialize to JSON
    let json = serde_json::to_string(&element);
    assert!(json.is_ok());
}

#[test]
fn test_color_creation() {
    use types::Color;

    let black = Color { r: 0, g: 0, b: 0, a: 1.0 };
    assert_eq!(black.r, 0);
    assert_eq!(black.a, 1.0);

    let transparent = Color { r: 255, g: 0, b: 0, a: 0.5 };
    assert_eq!(transparent.a, 0.5);
}

#[test]
fn test_page_dimensions() {
    use types::{PageSize, Orientation, PageDimensions};

    let a4_portrait = PageDimensions::from_page_size(PageSize::A4, Orientation::Portrait);
    assert_eq!(a4_portrait.width, 595.0);
    assert_eq!(a4_portrait.height, 842.0);

    let a4_landscape = PageDimensions::from_page_size(PageSize::A4, Orientation::Landscape);
    assert_eq!(a4_landscape.width, 842.0);
    assert_eq!(a4_landscape.height, 595.0);
}

#[test]
fn test_margin_creation() {
    use types::Margin;

    let uniform = Margin::uniform(72.0);
    assert_eq!(uniform.top, 72.0);
    assert_eq!(uniform.right, 72.0);
    assert_eq!(uniform.bottom, 72.0);
    assert_eq!(uniform.left, 72.0);

    let symmetric = Margin::symmetric(50.0, 30.0);
    assert_eq!(symmetric.top, 50.0);
    assert_eq!(symmetric.bottom, 50.0);
    assert_eq!(symmetric.left, 30.0);
    assert_eq!(symmetric.right, 30.0);
}

#[test]
fn test_error_handling() {
    use error::PdfError;

    let err = PdfError::FontError("Test error".to_string());
    assert!(err.to_string().contains("Font error"));

    let err2 = PdfError::RenderError("Test render error".to_string());
    assert!(err2.to_string().contains("Rendering error"));
}
