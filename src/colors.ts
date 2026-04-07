/**
 * Color parsing — converts any ColorInput to an internal RGBA object.
 * Supports 100+ CSS named colors, hex strings, and RGB/RGBA tuples.
 */

import type { ColorInput, RGBA } from "./types.ts";

export const CSS_COLORS: Record<string, string> = {
  // Basics
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  lime: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  silver: "#c0c0c0",
  gray: "#808080",
  grey: "#808080",
  maroon: "#800000",
  olive: "#808000",
  green: "#008000",
  purple: "#800080",
  teal: "#008080",
  navy: "#000080",
  aqua: "#00ffff",
  fuchsia: "#ff00ff",
  // Extended
  orange: "#ffa500",
  pink: "#ffc0cb",
  gold: "#ffd700",
  khaki: "#f0e68c",
  violet: "#ee82ee",
  indigo: "#4b0082",
  coral: "#ff7f50",
  salmon: "#fa8072",
  tomato: "#ff6347",
  crimson: "#dc143c",
  firebrick: "#b22222",
  chocolate: "#d2691e",
  brown: "#a52a2a",
  sienna: "#a0522d",
  peru: "#cd853f",
  tan: "#d2b48c",
  wheat: "#f5deb3",
  beige: "#f5f5dc",
  ivory: "#fffff0",
  lavender: "#e6e6fa",
  plum: "#dda0dd",
  orchid: "#da70d6",
  hotpink: "#ff69b4",
  deeppink: "#ff1493",
  lightpink: "#ffb6c1",
  turquoise: "#40e0d0",
  aquamarine: "#7fffd4",
  skyblue: "#87ceeb",
  deepskyblue: "#00bfff",
  dodgerblue: "#1e90ff",
  royalblue: "#4169e1",
  steelblue: "#4682b4",
  cadetblue: "#5f9ea0",
  slategray: "#708090",
  slategrey: "#708090",
  lightgray: "#d3d3d3",
  lightgrey: "#d3d3d3",
  darkgray: "#a9a9a9",
  darkgrey: "#a9a9a9",
  dimgray: "#696969",
  dimgrey: "#696969",
  whitesmoke: "#f5f5f5",
  gainsboro: "#dcdcdc",
  aliceblue: "#f0f8ff",
  ghostwhite: "#f8f8ff",
  snow: "#fffafa",
  seashell: "#fff5ee",
  floralwhite: "#fffaf0",
  honeydew: "#f0fff0",
  mintcream: "#f5fffa",
  azure: "#f0ffff",
  linen: "#faf0e6",
  antiquewhite: "#faebd7",
  bisque: "#ffe4c4",
  moccasin: "#ffe4b5",
  navajowhite: "#ffdead",
  peachpuff: "#ffdab9",
  mistyrose: "#ffe4e1",
  blanchedalmond: "#ffebcd",
  cornsilk: "#fff8dc",
  lemonchiffon: "#fffacd",
  lightyellow: "#ffffe0",
  palegoldenrod: "#eee8aa",
  darkkhaki: "#bdb76b",
  chartreuse: "#7fff00",
  lawngreen: "#7cfc00",
  greenyellow: "#adff2f",
  limegreen: "#32cd32",
  mediumspringgreen: "#00fa9a",
  springgreen: "#00ff7f",
  palegreen: "#98fb98",
  lightgreen: "#90ee90",
  mediumseagreen: "#3cb371",
  seagreen: "#2e8b57",
  forestgreen: "#228b22",
  darkgreen: "#006400",
  yellowgreen: "#9acd32",
  olivedrab: "#6b8e23",
  darkolivegreen: "#556b2f",
  darkseagreen: "#8fbc8f",
  midnightblue: "#191970",
  darkblue: "#00008b",
  mediumblue: "#0000cd",
  cornflowerblue: "#6495ed",
  mediumslateblue: "#7b68ee",
  slateblue: "#6a5acd",
  darkslateblue: "#483d8b",
  mediumpurple: "#9370db",
  blueviolet: "#8a2be2",
  darkviolet: "#9400d3",
  darkorchid: "#9932cc",
  darkmagenta: "#8b008b",
  mediumvioletred: "#c71585",
  palevioletred: "#db7093",
  rosybrown: "#bc8f8f",
  transparent: "#00000000",
};

export function parseColor(c: ColorInput): RGBA {
  if (typeof c === "string") {
    const resolved = CSS_COLORS[c.toLowerCase().trim()] ?? c;
    let hex = resolved.replace(/^#/, "").trim();

    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1.0,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
    throw new Error(`Invalid color: "${c}"`);
  }
  if (c.length === 3) return { r: c[0], g: c[1], b: c[2], a: 1.0 };
  return { r: c[0], g: c[1], b: c[2], a: c[3] };
}
