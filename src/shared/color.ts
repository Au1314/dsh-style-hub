/**
 * Colour arithmetic for token derivation.
 *
 * Every value a preset publishes is produced here rather than hand-written,
 * so a palette of twelve swatches is enough to describe a whole style and the
 * relationship between two tokens stays true in every scheme. Parsing is
 * deliberately narrow (`#rgb`, `#rrggbb`, `#rrggbbaa`) and fails to
 * `undefined` rather than guessing, so a malformed swatch degrades to its
 * input instead of silently painting the wrong surface.
 */

/** A parsed sRGB colour with an alpha in 0..1. */
export interface Rgba {
  /** Red, 0..255. */
  r: number
  /** Green, 0..255. */
  g: number
  /** Blue, 0..255. */
  b: number
  /** Alpha, 0..1. */
  a: number
}

/**
 * Parse a CSS hex colour.
 * @param color - `#rgb`, `#rrggbb`, or `#rrggbbaa`, case-insensitive.
 * @returns the colour, or undefined when the input is not a hex colour.
 */
export function parse(color: string): Rgba | undefined {
  const hex = color.trim().replace(/^#/, '')
  if (!/^[0-9a-f]+$/i.test(hex)) return undefined
  if (hex.length === 3) {
    const [r, g, b] = [...hex].map(char => Number.parseInt(char + char, 16))
    return { r, g, b, a: 1 }
  }
  if (hex.length === 6 || hex.length === 8) {
    const read = (start: number): number => Number.parseInt(hex.slice(start, start + 2), 16)
    return { r: read(0), g: read(2), b: read(4), a: hex.length === 8 ? read(6) / 255 : 1 }
  }
  return undefined
}

/**
 * Format a colour back to CSS.
 * @param color - the parsed colour.
 * @returns `#rrggbb` when fully opaque, otherwise `rgba(r, g, b, a)`.
 */
export function toCss(color: Rgba): string {
  const hex = (value: number): string => clampByte(value).toString(16).padStart(2, '0')
  if (color.a >= 1) return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`
  const amount = Math.round(color.a * 1000) / 1000
  return `rgba(${clampByte(color.r)}, ${clampByte(color.g)}, ${clampByte(color.b)}, ${amount})`
}

/**
 * Linear interpolation between two colours.
 * @param from - source colour.
 * @param to - destination colour.
 * @param amount - weight of `to`, 0..1.
 * @returns the mixed colour; `from` unchanged when either side is unparseable.
 */
export function mix(from: string, to: string, amount: number): string {
  const a = parse(from)
  const b = parse(to)
  if (!a || !b) return from
  const t = clamp01(amount)
  return toCss({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  })
}

/**
 * Apply an alpha to a colour, multiplying any alpha it already carries rather
 * than replacing it — a translucent swatch read twice stays translucent
 * instead of snapping back to opaque.
 * @param color - source colour.
 * @param amount - alpha to apply, 0..1.
 * @returns the colour at the requested alpha; `color` unchanged when unparseable.
 */
export function alpha(color: string, amount: number): string {
  const parsed = parse(color)
  if (!parsed) return color
  return toCss({ ...parsed, a: parsed.a * clamp01(amount) })
}

/**
 * Lighten a colour toward white.
 * @param color - source colour.
 * @param amount - weight of white, 0..1.
 * @returns the lightened colour.
 */
export function lighten(color: string, amount: number): string {
  return mix(color, '#ffffff', amount)
}

/**
 * Darken a colour toward black.
 * @param color - source colour.
 * @param amount - weight of black, 0..1.
 * @returns the darkened colour.
 */
export function darken(color: string, amount: number): string {
  return mix(color, '#000000', amount)
}

/**
 * Drop a colour's alpha, keeping its hue — the solid canvas a translucent
 * surface should be read against.
 * @param color - source colour.
 * @returns the same colour fully opaque; `color` unchanged when unparseable.
 */
export function solid(color: string): string {
  const parsed = parse(color)
  if (!parsed) return color
  return toCss({ ...parsed, a: 1 })
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}
