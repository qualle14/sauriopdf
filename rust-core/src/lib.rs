/*!
# SaurioPDF Core

High-performance PDF generation library using Krilla, compiled to WebAssembly.

This library provides the core PDF generation functionality, exposing a clean API
through wasm-bindgen for use in TypeScript/JavaScript environments.

## Architecture

The Rust core is organized into modules:
- `document`: PDF document structure and building
- `content`: Content elements (text, images, shapes)
- `fonts`: Font management and subsetting
- `types`: Core types and value objects
- `error`: Error handling
- `utils`: Utility functions
*/

use wasm_bindgen::prelude::*;
use std::sync::Mutex;
use std::collections::HashMap;

pub mod document;
pub mod content;
pub mod fonts;
pub mod types;
pub mod error;
pub mod utils;

// Re-export main types
pub use document::{PdfDocument, DocumentConfig};
pub use error::{PdfError, Result};

// Global font registry
static FONT_REGISTRY: Mutex<Option<HashMap<String, fonts::FontFamily>>> = Mutex::new(None);

/// Initialize the library (sets up panic hooks for better error messages in WASM)
#[wasm_bindgen(start)]
pub fn initialize() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    utils::log("SaurioPDF Core initialized");
}

/// Get library version
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Generate PDF from JSON document structure
///
/// This is the main entry point for TypeScript to generate PDFs.
/// It receives a JSON string representing the document and returns PDF bytes.
#[wasm_bindgen(js_name = generatePdf)]
pub fn generate_pdf(document_json: &str) -> std::result::Result<Vec<u8>, JsValue> {
    // Parse JSON into document structure
    let doc_data: DocumentData = serde_json::from_str(document_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse document JSON: {}", e)))?;

    // Create PDF document with custom fonts from registry
    let mut pdf_doc = PdfDocument::new(doc_data.config);

    // Load fonts from global registry
    let registry = FONT_REGISTRY.lock()
        .map_err(|e| JsValue::from_str(&format!("Failed to lock font registry: {}", e)))?;

    if let Some(fonts) = registry.as_ref() {
        for (_, font_family) in fonts.iter() {
            pdf_doc.register_font_family(font_family.clone())
                .map_err(|e| JsValue::from_str(&format!("Failed to register font: {}", e)))?;
        }
    }
    drop(registry); // Release the lock

    // Add pages
    for page_data in doc_data.pages {
        let page = pdf_doc.add_page();

        // Add content elements to page
        for element in page_data.content {
            page.add_content(element);
        }
    }

    // Render PDF
    let pdf_bytes = pdf_doc
        .render()
        .map_err(|e| JsValue::from_str(&format!("Failed to render PDF: {}", e)))?;

    Ok(pdf_bytes)
}

/// Document data structure for JSON serialization
#[derive(Debug, serde::Deserialize)]
struct DocumentData {
    config: DocumentConfig,
    pages: Vec<PageData>,
}

/// Page data structure for JSON serialization
#[derive(Debug, serde::Deserialize)]
struct PageData {
    content: Vec<content::ContentElement>,
}

/// Register a custom font (receives font bytes)
#[wasm_bindgen(js_name = registerFont)]
pub fn register_font(
    name: String,
    font_data: Vec<u8>,
) -> std::result::Result<(), JsValue> {
    let mut registry = FONT_REGISTRY.lock()
        .map_err(|e| JsValue::from_str(&format!("Failed to lock font registry: {}", e)))?;

    if registry.is_none() {
        *registry = Some(HashMap::new());
    }

    let fonts = registry.as_mut().unwrap();

    // Determine which variant this is based on the name
    let (family_name, variant) = if name.ends_with(" Bold Italic") || name.ends_with(" BoldItalic") {
        (name.trim_end_matches(" Bold Italic").trim_end_matches(" BoldItalic").to_string(), "bold_italic")
    } else if name.ends_with(" Bold") {
        (name.trim_end_matches(" Bold").to_string(), "bold")
    } else if name.ends_with(" Italic") {
        (name.trim_end_matches(" Italic").to_string(), "italic")
    } else {
        (name.clone(), "normal")
    };

    // Get or create font family
    let font_family = fonts.entry(family_name.clone()).or_insert_with(|| fonts::FontFamily {
        name: family_name,
        normal: None,
        bold: None,
        italic: None,
        bold_italic: None,
    });

    // Set the appropriate variant
    match variant {
        "normal" => font_family.normal = Some(font_data),
        "bold" => font_family.bold = Some(font_data),
        "italic" => font_family.italic = Some(font_data),
        "bold_italic" => font_family.bold_italic = Some(font_data),
        _ => {}
    }

    Ok(())
}

/// Simple test function to verify WASM is working
#[wasm_bindgen(js_name = testWasm)]
pub fn test_wasm() -> String {
    "WASM is working! 🦕".to_string()
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert_eq!(version(), "0.1.0");
    }

    #[test]
    fn test_wasm_function() {
        assert!(test_wasm().contains("WASM"));
    }
}
