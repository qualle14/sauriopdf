use thiserror::Error;
use wasm_bindgen::prelude::*;

/// Result type for PDF operations
pub type Result<T> = std::result::Result<T, PdfError>;

/// Errors that can occur during PDF generation
#[derive(Error, Debug)]
pub enum PdfError {
    #[error("Invalid document configuration: {0}")]
    InvalidConfiguration(String),

    #[error("Font error: {0}")]
    FontError(String),

    #[error("Image error: {0}")]
    ImageError(String),

    #[error("Rendering error: {0}")]
    RenderError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("Invalid UTF-8: {0}")]
    Utf8Error(String),

    #[error("WASM error: {0}")]
    WasmError(String),
}

// Convert PdfError to JsValue for WASM boundary
impl From<PdfError> for JsValue {
    fn from(error: PdfError) -> Self {
        JsValue::from_str(&error.to_string())
    }
}

impl From<serde_json::Error> for PdfError {
    fn from(error: serde_json::Error) -> Self {
        PdfError::SerializationError(error.to_string())
    }
}

impl From<std::io::Error> for PdfError {
    fn from(error: std::io::Error) -> Self {
        PdfError::IoError(error.to_string())
    }
}

impl From<std::string::FromUtf8Error> for PdfError {
    fn from(error: std::string::FromUtf8Error) -> Self {
        PdfError::Utf8Error(error.to_string())
    }
}

impl From<image::ImageError> for PdfError {
    fn from(error: image::ImageError) -> Self {
        PdfError::ImageError(error.to_string())
    }
}
