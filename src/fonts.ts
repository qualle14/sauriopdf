/**
 * Built-in font name constants.
 * Both families are embedded in the WASM binary — always available.
 */

export const Font = {
  // Liberation Sans — proportional, general-purpose
  Sans: "Liberation Sans",
  SansBold: "Liberation Sans Bold",
  SansItalic: "Liberation Sans Italic",
  SansBoldItalic: "Liberation Sans Bold Italic",

  // Liberation Mono — monospaced, code blocks
  Mono: "Liberation Mono",
  MonoBold: "Liberation Mono Bold",
  MonoItalic: "Liberation Mono Italic",
  MonoBoldItalic: "Liberation Mono Bold Italic",
} as const;

/** Union of all built-in font name strings */
export type BuiltinFont = (typeof Font)[keyof typeof Font];
