/**
 * The tweak layer: the small set of adjustments the card exposes on top of
 * whatever style is active — an accent of the user's choosing, and surfaces
 * turned translucent so a wallpaper can show through them.
 *
 * Everything here is derived from the *registered* (uncomposed) tokens of the
 * active theme plus the settings, never from the composed snapshot: reading
 * the composed value back would read this layer's own previous alphas in and
 * compound them on every pass. The result is therefore a pure function of
 * (settings, active registered theme), which is what lets the runtime notice
 * "nothing actually changed" and skip the write that would otherwise emit
 * `theme/change` on every pass.
 */
import type { StyleHubSettings } from './settings.ts'
import { alpha, darken, lighten, parse } from './color.ts'
import type { ColorScheme } from './palettes.ts'
import { STOCK_SURFACES, SURFACE_TOKENS, type Tokens } from './tokens.ts'

/** One override token: the value to apply in each palette mode. */
export interface TokenModes {
  /** Value applied while the light base palette is active. */
  light: string
  /** Value applied while the dark base palette is active. */
  dark: string
}

/** An override layer: token name → per-mode values. */
export type Layer = Record<string, TokenModes>

/** Layer identity for `ctx.theme.overrideTokens` — one layer, replaced in place. */
export const TWEAK_SOURCE = 'dsh-style-hub:tweaks'

/** Opacity forced on the page canvas while a wallpaper shows, so the picture is visible under a still-solid frame. */
export const WALLPAPER_CANVAS_ALPHA = 0.85

/** Surfaces that follow the panel-opacity slider. The toast stays solid: it floats over everything. */
const TRANSLUCENT = [
  SURFACE_TOKENS.base,
  SURFACE_TOKENS.layer1,
  SURFACE_TOKENS.layer2,
  SURFACE_TOKENS.layer3,
  SURFACE_TOKENS.overlay,
  SURFACE_TOKENS.sidebar,
  SURFACE_TOKENS.menu,
] as const

/**
 * Whether a settings accent is a colour this layer can apply.
 * @param accent - the stored accent field.
 * @returns true when it is a six-digit hex colour.
 */
export function isAccent(accent: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(accent)
}

/**
 * Whether a wallpaper is currently selected and switched on.
 * @param settings - the resolved section.
 * @returns true when a wallpaper should paint.
 */
export function wallpaperActive(settings: StyleHubSettings): boolean {
  return settings.enabled && settings.wallpaperId.length > 0
}

/**
 * The surfaces to derive tweaks from, for both palette modes.
 *
 * Only the *active* scheme's registered theme can be known — the other scheme
 * is whatever the user picks next, and a scheme switch lands on that scheme's
 * theme, so the stock directory is the honest answer for it.
 * @param activeTokens - registered tokens of the active theme (may be empty).
 * @param activeScheme - colour scheme the active theme declares.
 * @returns opaque surface directory per scheme.
 */
export function tweakSurfaces(
  activeTokens: Tokens,
  activeScheme: ColorScheme,
): Record<ColorScheme, Record<string, string>> {
  const merged: Record<string, string> = { ...STOCK_SURFACES[activeScheme] }
  for (const name of Object.values(SURFACE_TOKENS)) {
    const value = activeTokens[name]
    if (typeof value === 'string' && parse(value)) merged[name] = value
  }
  // Built explicitly rather than with computed keys: a computed-key object
  // types as `{ [x: string]: ... }`, which does not prove both schemes present.
  const surfaces: Record<ColorScheme, Record<string, string>> = {
    light: STOCK_SURFACES.light,
    dark: STOCK_SURFACES.dark,
  }
  surfaces[activeScheme] = merged
  return surfaces
}

/**
 * Build the tweak layer for one section.
 * @param settings - the resolved section.
 * @param surfaces - opaque surface directory per scheme.
 * @returns the layer, or an empty object when no tweak applies — which means
 * the layer should be removed rather than re-registered.
 */
export function buildTweakLayer(
  settings: StyleHubSettings,
  surfaces: Record<ColorScheme, Record<string, string>>,
): Layer {
  if (!settings.enabled) return {}
  const layer: Layer = {}

  if (isAccent(settings.accent)) {
    const accent = settings.accent
    const shared: Record<string, string> = {
      '--dsw-alias-brand-primary': accent,
      '--dsw-alias-brand-primary-new-colorprimary-new-color': accent,
      '--dsw-alias-button-primary-fill': accent,
      '--dsw-alias-button-primary-dimmed': alpha(accent, 0.12),
      '--dsw-alias-button-info-fill': accent,
      '--dsw-alias-link': accent,
      '--dsw-alias-state-business-primary': accent,
      '--dsw-alias-state-business-tertiary': alpha(accent, 0.14),
      '--dsw-alias-interactive-bg-hover': alpha(accent, 0.06),
      '--dsw-alias-interactive-bg-hover-accent': alpha(accent, 0.14),
      '--dsw-alias-interactive-bg-active': alpha(accent, 0.1),
      '--dsw-alias-label-primary-bluish': accent,
    }
    for (const [name, value] of Object.entries(shared)) layer[name] = { light: value, dark: value }
    // Hover steps sit on the accent, so each scheme walks its own way from it
    // rather than sharing one literal.
    layer['--dsw-alias-button-primary-hover'] = {
      light: darken(accent, 0.12),
      dark: lighten(accent, 0.12),
    }
    layer['--dsw-alias-button-info-hover'] = {
      light: darken(accent, 0.1),
      dark: lighten(accent, 0.12),
    }
  }

  const canvasAlpha = wallpaperActive(settings)
    ? Math.min(settings.panelOpacity, WALLPAPER_CANVAS_ALPHA)
    : settings.panelOpacity

  if (canvasAlpha < 1 || settings.panelOpacity < 1) {
    for (const name of TRANSLUCENT) {
      const amount = name === SURFACE_TOKENS.base ? canvasAlpha : settings.panelOpacity
      if (amount >= 1) continue
      layer[name] = {
        light: alpha(surfaces.light[name], amount),
        dark: alpha(surfaces.dark[name], amount),
      }
    }
  }

  return layer
}

/**
 * Serialize a layer for change comparison.
 * @param layer - the layer to fingerprint.
 * @returns a stable string; equal strings mean the two layers are interchangeable.
 */
export function fingerprint(layer: Layer): string {
  return JSON.stringify(
    Object.keys(layer)
      .sort()
      .map(name => [name, layer[name].light, layer[name].dark]),
  )
}
