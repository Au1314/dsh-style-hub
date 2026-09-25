/**
 * The durable `style-hub` settings section, shared by the Host (schema +
 * composition base) and the browser (defaults while the section loads).
 *
 * The section is flat on purpose: the client settings scope writes one field
 * per call (`scope.set(field, value)`), so a flat shape keeps every user
 * gesture to a single write with one revision fence.
 */

/** Settings namespace registered on the Host and keyed by the settings card. */
export const SETTINGS_NS = 'style-hub' as const

/** Locale namespace carrying this feature's copy. */
export const LOCALE_NS = 'settings.style-hub' as const

/** Theme id meaning "leave the built-in Appearance preference alone". */
export const STOCK_THEME = 'stock'

/** One durable `style-hub` section. */
export interface StyleHubSettings {
  /** Master switch: off restores the stock appearance completely. */
  enabled: boolean
  /** `stock` or a registered preset id. */
  themeId: string
  /** Accent override as `#rrggbb`; empty follows the active theme. */
  accent: string
  /** Surface opacity 0.8..1; 1 keeps the theme's own fills (no translucency). */
  panelOpacity: number
  /** Uploaded wallpaper id; empty means no wallpaper. */
  wallpaperId: string
  /** Wallpaper sizing. */
  wallpaperFit: 'cover' | 'contain'
  /** Wallpaper layer opacity. */
  wallpaperOpacity: number
  /** Wallpaper blur in px. */
  wallpaperBlur: number
  /** Darkening mask over the wallpaper, 0..1. */
  wallpaperDim: number
}

/** Composition base: what an untouched deployment resolves to. */
export const DEFAULT_SETTINGS: StyleHubSettings = {
  enabled: false,
  themeId: STOCK_THEME,
  accent: '',
  panelOpacity: 1,
  wallpaperId: '',
  wallpaperFit: 'cover',
  wallpaperOpacity: 1,
  wallpaperBlur: 0,
  wallpaperDim: 0,
}

/** Clamp a number into a range. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/**
 * Judge a resolved section for constraints the schema deliberately does not
 * express (ranges, the known theme id set is checked by the client instead —
 * a preset may be registered only by the browser half).
 * @param value - the schema-resolved section.
 * @throws RangeError on an out-of-range numeric field.
 */
export function validateSettings(value: StyleHubSettings): void {
  assertRange(value.panelOpacity, 0.8, 1, 'panelOpacity')
  assertRange(value.wallpaperOpacity, 0, 1, 'wallpaperOpacity')
  assertRange(value.wallpaperBlur, 0, 50, 'wallpaperBlur')
  assertRange(value.wallpaperDim, 0, 1, 'wallpaperDim')
  if (value.wallpaperFit !== 'cover' && value.wallpaperFit !== 'contain') {
    throw new RangeError(`wallpaperFit must be cover or contain, got ${value.wallpaperFit}`)
  }
  if (!/^[0-9a-f]*$/i.test(value.wallpaperId)) {
    throw new RangeError('wallpaperId must be a hex id or empty')
  }
  if (value.accent !== '' && !/^#[0-9a-f]{6}$/i.test(value.accent)) {
    throw new RangeError(`accent must be #rrggbb or empty, got ${value.accent}`)
  }
}

function assertRange(value: number, min: number, max: number, field: string): void {
  if (typeof value !== 'number' || Number.isNaN(value) || value < min || value > max) {
    throw new RangeError(`${field} must be within ${min}..${max}, got ${value}`)
  }
}
