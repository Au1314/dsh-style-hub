/**
 * The wallpaper-engine glass wash — a cross-plugin colour conflict.
 *
 * wallpaper-engine tints the whole settings window with its own persisted
 * glass colour (`--we-glass-color`, written onto `body`), and that tint is
 * used in *both* appearances: left dark while one of this plugin's light
 * styles is active, the dialog washes to flat grey. This module decides
 * whether that conflict is on right now, watches for it to change, and — on
 * request — clears it through wallpaper-engine's own settings route.
 *
 * The route replaces the whole config file, so the write is always a
 * read-merge-write: sending the single field alone would reset every other
 * knob that plugin owns back to its default.
 *
 * Everything DOM-shaped here is guarded rather than assumed: the card's
 * controller starts before any of it is known to exist (a headless render, a
 * deployment without the neighbouring plugin, a test without a document), and
 * each guard degrades to "no conflict" instead of a thrown error.
 */

/** The colour this plugin writes: wallpaper-engine's own white-glass preset. */
export const WHITE_GLASS = '#ffffff'

/**
 * The tint the settings glass carries when wallpaper-engine has written
 * nothing: their stylesheet falls back to white under a light scheme, which
 * is exactly the scheme a light style of ours presents.
 */
const STOCK_TINT = '#ffffff'

/** The alpha their stylesheet falls back to when `--we-glass-alpha` is unset. */
const STOCK_ALPHA = 0.5

/**
 * The mixed surface luminance below which a light style reads as washed grey.
 *
 * The glass layer is a tint composited over the light dialog at wall-paper-
 * engine's alpha (0.03–0.25). The observed wash — their deep navy default at
 * the default alpha — lands near 0.61; a white or pastel tint stays above
 * 0.8 at every alpha, and a near-transparent glass cannot darken anything
 * regardless of tint. 0.7 separates those families while leaving headroom.
 */
const WASH_LIMIT = 0.7

/** What the document currently says about the neighbour's glass. */
export interface GlassState {
  /** Whether wallpaper-engine's whole-window glass master switch is on. */
  windowGlass: boolean
  /** The written tint, or `''` when wallpaper-engine has written none. */
  tint: string
  /** The alpha the tint is mixed at, resolved against their fallback. */
  alpha: number
}

/**
 * Parse a hex colour into 0–255 channels.
 * @param color - `#rgb` or `#rrggbb`, the shapes wallpaper-engine writes.
 * @returns the channels, or undefined for anything else.
 */
function channels(color: string): [number, number, number] | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!match) return undefined
  const hex = match[1]
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map(part => part + part)
          .join('')
      : hex
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
}

/**
 * Relative luminance of 0–255 sRGB channels (WCAG definition).
 * @param rgb - the channels.
 * @returns luminance in 0–1.
 */
function luminanceOf(rgb: [number, number, number]): number {
  const linear = rgb.map(value => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

/**
 * Relative luminance of an sRGB colour (WCAG definition).
 * @param color - a hex colour.
 * @returns luminance in 0–1, or -1 when the colour cannot be parsed.
 */
export function luminance(color: string): number {
  const rgb = channels(color)
  return rgb ? luminanceOf(rgb) : -1
}

/**
 * Does this tint wash a light surface to grey at this alpha?
 *
 * The layer composites in sRGB, so the mixed channel is the tint's own over
 * the light dialog beneath it — the same arithmetic the neighbour's
 * `color-mix` performs, reduced to one number to compare against
 * {@link WASH_LIMIT}.
 * @param tint - the glass tint, as written on the body.
 * @param alpha - the glass alpha it is mixed at, 0–1.
 * @returns true when the result would read as flat grey under a light style.
 */
export function glassWashes(tint: string, alpha: number): boolean {
  const rgb = channels(tint)
  if (!rgb) return false
  const a = Number.isFinite(alpha) ? Math.min(Math.max(alpha, 0), 1) : STOCK_ALPHA
  const mixed = rgb.map(value => value * a + 255 * (1 - a)) as [number, number, number]
  return luminanceOf(mixed) < WASH_LIMIT
}

/**
 * Read what the document says about the neighbour's glass.
 * @returns the current state, or undefined when there is no document to read.
 */
export function readGlassState(): GlassState | undefined {
  if (typeof document === 'undefined' || !document.body) return undefined
  const body = document.body
  const windowGlass = typeof body.hasAttribute === 'function' && body.hasAttribute('data-we-glass-window')
  let tint = ''
  let alpha = STOCK_ALPHA
  if (typeof getComputedStyle === 'function') {
    try {
      const computed = getComputedStyle(body)
      tint = computed.getPropertyValue('--we-glass-color').trim()
      const written = Number.parseFloat(computed.getPropertyValue('--we-glass-alpha'))
      if (Number.isFinite(written)) alpha = Math.min(Math.max(written, 0), 1)
    } catch {
      // A document that cannot be computed is a document with nothing to read.
    }
  }
  return { windowGlass, tint, alpha }
}

/**
 * Is the neighbour's glass currently washing an active light style?
 * @param state - what the document says, as returned by {@link readGlassState}.
 * @param lightStyleActive - whether one of this plugin's light styles holds.
 * @returns true when the wash is on right now.
 */
export function glassWashesLightStyle(state: GlassState | undefined, lightStyleActive: boolean): boolean {
  if (!lightStyleActive || !state || !state.windowGlass) return false
  // Nothing written: the stylesheet's own white fallback applies — the
  // answer stays honest instead of depending on that detail staying true.
  return glassWashes(state.tint === '' ? STOCK_TINT : state.tint, state.alpha)
}

/**
 * Watch for the neighbour repainting its glass.
 *
 * wallpaper-engine writes the tint onto the body's inline style, and its
 * master switch is a body attribute, so those two attribute names are the
 * complete set of signals that can change the answer.
 * @param onChange - invoked whenever either signal changes.
 * @returns the disposer, or undefined when there is nothing to observe.
 */
export function observeGlass(onChange: () => void): (() => void) | undefined {
  if (typeof MutationObserver !== 'function') return undefined
  if (typeof document === 'undefined' || !document.body) return undefined
  const observer = new MutationObserver(onChange)
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['style', 'data-we-glass-window'],
  })
  return () => observer.disconnect()
}

/**
 * Persist white glass in the neighbour's settings and repaint immediately.
 *
 * The repaint matters because their settings page holds its own copy of the
 * colour: without it the dialog would keep the old tint until something else
 * re-apply their effects, which is also the one case the caller cannot fix —
 * a later edit from their page re-asserts the colour they still hold, and the
 * card's detection reports that honestly rather than pretending the conflict
 * is gone for good.
 */
export async function switchToWhiteGlass(): Promise<void> {
  const route = '/wallpaper-engine/settings'
  const current = await fetch(route, { method: 'GET' })
  if (!current.ok) throw new Error(`${current.status} ${current.statusText}`)
  const body = (await current.json()) as { settings?: Record<string, unknown> | null }
  const settings = body.settings
  if (!settings) throw new Error('wallpaper-engine has no saved settings')
  const write = await fetch(route, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...settings, glassColor: WHITE_GLASS }),
  })
  if (!write.ok) throw new Error(`${write.status} ${write.statusText}`)
  if (typeof document !== 'undefined' && document.body?.style) {
    document.body.style.setProperty('--we-glass-color', WHITE_GLASS)
  }
}
