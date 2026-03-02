use wasm_bindgen::prelude::*;
use web_sys::console;

/// Log message to browser/Node console
pub fn log(message: &str) {
    console::log_1(&JsValue::from_str(message));
}
