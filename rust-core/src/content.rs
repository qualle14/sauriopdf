use crate::types::{Color, Point, Rect, TextAlign};
use serde::{Deserialize, Serialize};

// ─── Stroke style enums ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub enum LineCap {
    #[default]
    Butt,
    Round,
    Square,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub enum LineJoin {
    #[default]
    Miter,
    Round,
    Bevel,
}

// ─── Text element ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextElement {
    pub content: String,
    pub position: Point,
    pub font_family: String,
    pub font_size: f32,
    pub color: Color,
    pub bold: bool,
    pub italic: bool,
    pub align: TextAlign,
    pub max_width: Option<f32>,
}

impl Default for TextElement {
    fn default() -> Self {
        Self {
            content: String::new(),
            position: Point::new(0.0, 0.0),
            font_family: "Liberation Sans".to_string(),
            font_size: 12.0,
            color: Color::black(),
            bold: false,
            italic: false,
            align: TextAlign::Left,
            max_width: None,
        }
    }
}

// ─── Image element ────────────────────────────────────────────────────────────

/// Base64-encoded image. Sent as a string in JSON to avoid the ~4× overhead
/// of serialising raw bytes as a JSON integer array.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageElement {
    pub data: String,
    pub position: Point,
    pub width: Option<f32>,
    pub height: Option<f32>,
    pub format: ImageFormat,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ImageFormat {
    Png,
    Jpeg,
    Webp,
}

// ─── Link element ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkElement {
    pub url: String,
    pub rect: Rect,
    pub text: Option<String>,
}

// ─── Shape elements ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShapeElement {
    Rectangle {
        rect: Rect,
        fill_color: Option<Color>,
        stroke_color: Option<Color>,
        stroke_width: f32,
        border_radius: f32,
    },
    Circle {
        center: Point,
        radius: f32,
        fill_color: Option<Color>,
        stroke_color: Option<Color>,
        stroke_width: f32,
    },
    Line {
        start: Point,
        end: Point,
        color: Color,
        width: f32,
        #[serde(default)]
        line_cap: LineCap,
        #[serde(default)]
        line_join: LineJoin,
        /// Dash pattern: alternating dash/gap lengths in points.
        /// Empty means solid line.
        #[serde(default)]
        dash_array: Vec<f32>,
        #[serde(default)]
        dash_offset: f32,
    },
    Path {
        points: Vec<Point>,
        stroke_color: Option<Color>,
        fill_color: Option<Color>,
        stroke_width: f32,
        closed: bool,
        #[serde(default)]
        line_cap: LineCap,
        #[serde(default)]
        line_join: LineJoin,
    },
}

// ─── Top-level content element ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContentElement {
    Text(TextElement),
    Image(ImageElement),
    Link(LinkElement),
    Shape(ShapeElement),
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_element_defaults() {
        let text = TextElement::default();
        assert_eq!(text.content, "");
        assert_eq!(text.font_size, 12.0);
        assert!(!text.bold);
    }

    #[test]
    fn line_cap_default_is_butt() {
        let cap = LineCap::default();
        assert!(matches!(cap, LineCap::Butt));
    }
}
