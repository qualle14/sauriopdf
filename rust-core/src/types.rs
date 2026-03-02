use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Page size presets
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum PageSize {
    A4,
    A3,
    A5,
    Letter,
    Legal,
    Tabloid,
    Custom,
}

/// Page orientation
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Orientation {
    Portrait,
    Landscape,
}

/// Text alignment
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum TextAlign {
    Left,
    Center,
    Right,
    Justify,
}

/// Font weight
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum FontWeight {
    Thin,
    ExtraLight,
    Light,
    Normal,
    Medium,
    SemiBold,
    Bold,
    ExtraBold,
    Black,
}

/// Font style
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum FontStyle {
    Normal,
    Italic,
    Oblique,
}

/// Color representation (RGB)
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: f32,
}

#[wasm_bindgen]
impl Color {
    #[wasm_bindgen(constructor)]
    pub fn new(r: u8, g: u8, b: u8, a: f32) -> Self {
        Self { r, g, b, a }
    }

    /// Create color from hex string (e.g., "#FF5733")
    pub fn from_hex(hex: &str) -> Result<Color, JsValue> {
        let hex = hex.trim_start_matches('#');

        if hex.len() != 6 && hex.len() != 8 {
            return Err(JsValue::from_str("Invalid hex color format"));
        }

        let r = u8::from_str_radix(&hex[0..2], 16)
            .map_err(|_| JsValue::from_str("Invalid hex color"))?;
        let g = u8::from_str_radix(&hex[2..4], 16)
            .map_err(|_| JsValue::from_str("Invalid hex color"))?;
        let b = u8::from_str_radix(&hex[4..6], 16)
            .map_err(|_| JsValue::from_str("Invalid hex color"))?;

        let a = if hex.len() == 8 {
            u8::from_str_radix(&hex[6..8], 16)
                .map_err(|_| JsValue::from_str("Invalid hex color"))? as f32 / 255.0
        } else {
            1.0
        };

        Ok(Color { r, g, b, a })
    }

    /// Black color
    pub fn black() -> Color {
        Color { r: 0, g: 0, b: 0, a: 1.0 }
    }

    /// White color
    pub fn white() -> Color {
        Color { r: 255, g: 255, b: 255, a: 1.0 }
    }
}

/// Point/Position in 2D space
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

#[wasm_bindgen]
impl Point {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
}

/// Rectangle/Size
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[wasm_bindgen]
impl Rect {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self { x, y, width, height }
    }
}

/// Page dimensions
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct PageDimensions {
    pub width: f32,
    pub height: f32,
}

impl PageDimensions {
    pub fn from_page_size(size: PageSize, orientation: Orientation) -> Self {
        let (w, h) = match size {
            PageSize::A4 => (595.0, 842.0),      // 210mm x 297mm
            PageSize::A3 => (842.0, 1191.0),     // 297mm x 420mm
            PageSize::A5 => (420.0, 595.0),      // 148mm x 210mm
            PageSize::Letter => (612.0, 792.0),  // 8.5" x 11"
            PageSize::Legal => (612.0, 1008.0),  // 8.5" x 14"
            PageSize::Tabloid => (792.0, 1224.0), // 11" x 17"
            PageSize::Custom => (595.0, 842.0),  // Default to A4
        };

        match orientation {
            Orientation::Portrait => PageDimensions { width: w, height: h },
            Orientation::Landscape => PageDimensions { width: h, height: w },
        }
    }
}

/// Margin specification
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Margin {
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
    pub left: f32,
}

#[wasm_bindgen]
impl Margin {
    #[wasm_bindgen(constructor)]
    pub fn new(top: f32, right: f32, bottom: f32, left: f32) -> Self {
        Self { top, right, bottom, left }
    }

    /// Create uniform margin
    pub fn uniform(value: f32) -> Self {
        Self {
            top: value,
            right: value,
            bottom: value,
            left: value,
        }
    }

    /// Create symmetric margin
    pub fn symmetric(vertical: f32, horizontal: f32) -> Self {
        Self {
            top: vertical,
            right: horizontal,
            bottom: vertical,
            left: horizontal,
        }
    }
}
