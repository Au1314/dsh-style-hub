/**
 * Preset palette → the `--dsw-alias-*` / `--dsw-specific-*` token directory.
 *
 * The design system splits its variables into a static palette
 * (`--dsw-static-*`, shared by every theme) and a semantic layer the themes
 * actually own. A preset supplies twelve swatches; everything below derives
 * the semantic layer from them, so relationships that must hold — secondary
 * text sits a fixed distance from primary, a border is the text colour at a
 * fixed alpha, a hover tint is the accent a fixed way through the surface —
 * hold in every bundled style without being restated eight times.
 *
 * Nothing here emits a `--dsw-static-*` variable: those are the shared
 * constants of the system, and overriding them would leak one theme's choices
 * into every other theme.
 */
import { alpha, darken, lighten, mix, solid } from './color.ts'
import type { ColorScheme, Palette } from './palettes.ts'

/** Theme token dictionary: variable name → CSS value. */
export type Tokens = Record<string, string>

/**
 * Derive a preset's full semantic token directory.
 * @param palette - the preset's twelve swatches.
 * @param scheme - the scheme the preset builds on.
 * @returns the tokens to register with `ctx.theme.register`.
 */
export function tokensFor(palette: Palette, scheme: ColorScheme): Tokens {
  const { bg, s1, s2, s3, side, code, fg, fg2, accent, success, error, warning } = palette
  const dark = scheme === 'dark'
  // A token that reads "farther from the text" is the text colour walked
  // toward the canvas by a fixed fraction — the same walk in both schemes.
  const recede = (amount: number): string => mix(fg, bg, amount)

  return {
    // Surfaces.
    '--dsw-alias-bg-base': bg,
    '--dsw-alias-bg-layer-1': s1,
    '--dsw-alias-bg-layer-2': s2,
    '--dsw-alias-bg-layer-3': s3,
    '--dsw-alias-bg-overlay': s3,
    '--dsw-alias-bg-module-platform': mix(s1, s2, 0.5),
    '--dsw-alias-bg-multi-select': mix(s1, s2, 0.5),
    '--dsw-alias-bg-skeleton': alpha(fg, 0.06),

    // Masks. The pattern mirrors the base stylesheet: a veil over the content,
    // and a drop mask that reads light in light schemes, dark in dark ones.
    '--dsw-alias-bg-mask-1': alpha('#000000', dark ? 0.5 : 0.24),
    '--dsw-alias-bg-mask-2': alpha('#000000', 0.12),
    '--dsw-alias-bg-mask-3': alpha('#000000', 0.48),
    '--dsw-alias-bg-mask-photo': alpha('#000000', 0.88),
    '--dsw-alias-bg-mask-drop': dark ? alpha('#272730', 0.7) : alpha('#ffffff', 0.7),

    // Borders: the text colour at a rising alpha, so they track the palette.
    '--dsw-alias-border-l1': alpha(fg, dark ? 0.06 : 0.04),
    '--dsw-alias-border-l2-darkmode-thin': alpha(fg, dark ? 0.06 : 0.04),
    '--dsw-alias-border-l2': alpha(fg, dark ? 0.12 : 0.1),
    '--dsw-alias-border-l3': alpha(fg, dark ? 0.16 : 0.12),
    '--dsw-alias-border-l4': alpha(fg, dark ? 0.2 : 0.16),
    '--dsw-alias-border-inverted': 'transparent',
    '--dsw-alias-border-inverted2': 'transparent',

    // Brand and the buttons that carry it.
    '--dsw-alias-brand-primary': accent,
    '--dsw-alias-brand-primary-new-colorprimary-new-color': accent,
    '--dsw-alias-brand-primary-invert': bg,
    '--dsw-alias-brand-text': fg,
    '--dsw-alias-button-primary-fill': accent,
    '--dsw-alias-button-primary-hover': dark ? lighten(accent, 0.12) : darken(accent, 0.12),
    '--dsw-alias-button-primary-dimmed': alpha(accent, 0.12),
    '--dsw-alias-button-contrast-fill': dark ? s3 : darken(bg, 0.45),
    '--dsw-alias-button-elevated-fill': bg,
    '--dsw-alias-button-floating-fill': s1,
    '--dsw-alias-button-floating-hover': s2,
    '--dsw-alias-button-info-fill': accent,
    '--dsw-alias-button-info-hover': dark ? lighten(accent, 0.12) : darken(accent, 0.1),
    '--dsw-alias-button-ghost-active-border': alpha(fg, 0.5),
    '--dsw-alias-button-ghost-active-fill': alpha(fg, 0.08),
    '--dsw-alias-button-ghost-active-hover': alpha(fg, 0.12),
    '--dsw-alias-button-tool-bar-fill': alpha(fg, 0.45),
    '--dsw-alias-button-tool-bar-fill-invisible': alpha(fg, 0.3),
    '--dsw-alias-button-tool-bar-hover': alpha(fg, 0.55),

    // Interaction tints.
    '--dsw-alias-interactive-bg-hover': alpha(accent, 0.06),
    '--dsw-alias-interactive-bg-hover-accent': alpha(accent, 0.14),
    '--dsw-alias-interactive-bg-hover-solid': s2,
    '--dsw-alias-interactive-bg-hover-danger': alpha(error, 0.05),
    '--dsw-alias-interactive-bg-active': alpha(accent, 0.1),

    // Labels: one ladder off the primary colour.
    '--dsw-alias-label-primary': fg,
    '--dsw-alias-label-primary-bluish': accent,
    '--dsw-alias-label-primary-dimmed': recede(0.15),
    '--dsw-alias-label-primary-foreground': bg,
    '--dsw-alias-label-primary-inverted': bg,
    '--dsw-alias-label-secondary': fg2,
    '--dsw-alias-label-tertiary': recede(0.42),
    '--dsw-alias-label-caption': recede(0.55),
    '--dsw-alias-label-dimmed': recede(0.7),
    '--dsw-alias-link': accent,

    // Markdown and code.
    '--dsw-alias-markdown-citation': alpha(accent, 0.14),
    '--dsw-alias-markdown-code-block': code,
    '--dsw-alias-markdown-code-block-banner': mix(code, bg, 0.4),
    '--dsw-alias-markdown-code-segment-selected': alpha(accent, 0.2),
    '--dsw-alias-markdown-code-segment-unselected': s2,
    '--dsw-alias-markdown-inline-code': code,
    '--dsw-alias-markdown-placeholder': mix(s1, bg, 0.3),
    '--dsw-alias-markdown-tag': s2,

    // Scrollbars: the text colour at rising alpha, matching the base system.
    '--dsw-alias-scrollbar-bg-l1': alpha(fg, 0.18),
    '--dsw-alias-scrollbar-bg-l2': alpha(fg, 0.28),
    '--dsw-alias-scrollbar-hover-l1': alpha(fg, 0.35),
    '--dsw-alias-scrollbar-hover-l2': alpha(fg, 0.45),

    // States. Secondary stays a readable step off primary in light schemes
    // and collapses onto it in dark ones, as the base system does.
    '--dsw-alias-state-business-primary': accent,
    '--dsw-alias-state-business-tertiary': alpha(accent, 0.14),
    '--dsw-alias-state-error-primary': error,
    '--dsw-alias-state-error-secondary': dark ? error : lighten(error, 0.25),
    '--dsw-alias-state-success-primary': success,
    '--dsw-alias-state-success-secondary': dark ? success : lighten(success, 0.25),
    '--dsw-alias-state-success-tertiary': alpha(success, 0.16),
    '--dsw-alias-state-warn-primary': warning,
    '--dsw-alias-state-warn-label': warning,
    '--dsw-alias-state-warn-secondary': dark ? warning : lighten(warning, 0.2),
    '--dsw-alias-state-warn-tertiary': alpha(warning, 0.16),

    // Floating chrome. Toasts and tooltips invert against the page the way the
    // base system does — dark on a light page, lifted on a dark one — so the
    // inverted label tokens keep lining up with them.
    '--dsw-alias-toast-bg': mix(bg, fg, dark ? 0.15 : 0.85),
    '--dsw-alias-tooltip-bg': mix(bg, fg, dark ? 0.18 : 0.82),

    // The rest of the semantic layer.
    '--dsw-specific-bubble': mix(s1, accent, dark ? 0.06 : 0.08),
    '--dsw-specific-bubble-highlight': mix(s1, accent, 0.2),
    '--dsw-specific-input-major': dark ? s2 : bg,
    '--dsw-specific-login-input': dark ? darken(bg, 0.06) : mix(bg, s1, 0.6),
    '--dsw-specific-menu': s3,
    '--dsw-specific-selector': mix(s1, s2, 0.5),
    '--dsw-specific-sidebar-fill': side,
    '--dsw-specific-sidebar-nav-item-hover': mix(side, fg, 0.07),
    '--dsw-specific-sidebar-nav-item-active': alpha(accent, dark ? 0.2 : 0.16),
    '--dsw-specific-sidebar-nav-item-active-accent': alpha(accent, dark ? 0.34 : 0.28),
    '--dsw-specific-tip': mix(s1, s2, 0.5),
  }
}

/**
 * The surfaces a wallpaper has to be read through, and the solid canvas they
 * sit on. Used by the tweak layer (translucency) and by the runtime (the
 * canvas colour behind a translucent image).
 */
export const SURFACE_TOKENS = Object.freeze({
  base: '--dsw-alias-bg-base',
  layer1: '--dsw-alias-bg-layer-1',
  layer2: '--dsw-alias-bg-layer-2',
  layer3: '--dsw-alias-bg-layer-3',
  overlay: '--dsw-alias-bg-overlay',
  sidebar: '--dsw-specific-sidebar-fill',
  menu: '--dsw-specific-menu',
  toast: '--dsw-alias-toast-bg',
})

/** The opaque stock surfaces of each built-in scheme, for a theme with no tokens of its own. */
export const STOCK_SURFACES: Readonly<Record<ColorScheme, Readonly<Record<string, string>>>> = Object.freeze({
  light: Object.freeze({
    [SURFACE_TOKENS.base]: '#ffffff',
    [SURFACE_TOKENS.layer1]: '#ffffff',
    [SURFACE_TOKENS.layer2]: '#ffffff',
    [SURFACE_TOKENS.layer3]: '#ffffff',
    [SURFACE_TOKENS.overlay]: '#e9ecf2',
    [SURFACE_TOKENS.sidebar]: '#f9fafb',
    [SURFACE_TOKENS.menu]: '#ffffff',
    [SURFACE_TOKENS.toast]: '#353638',
  }),
  dark: Object.freeze({
    [SURFACE_TOKENS.base]: '#151517',
    [SURFACE_TOKENS.layer1]: '#232324',
    [SURFACE_TOKENS.layer2]: '#2c2c2e',
    [SURFACE_TOKENS.layer3]: '#353638',
    [SURFACE_TOKENS.overlay]: '#61666b',
    [SURFACE_TOKENS.sidebar]: '#1b1b1c',
    [SURFACE_TOKENS.menu]: '#353638',
    [SURFACE_TOKENS.toast]: '#43454a',
  }),
})

/**
 * Read the opaque surface directory of the theme one snapshot is built on.
 *
 * The snapshot's `active` definition has the tweak layer folded into it, so
 * reading surfaces from it would read this plugin's own previous alphas back
 * in and compound them on every pass. The registered (raw) definition is the
 * uncomposed source; a built-in theme carries no tokens, so it falls back to
 * the stock values of its scheme.
 * @param registeredTokens - the active theme's registered tokens.
 * @param scheme - the active colour scheme.
 * @returns surface variable → opaque colour.
 */
export function surfacesOf(registeredTokens: Tokens, scheme: ColorScheme): Record<string, string> {
  const stock = STOCK_SURFACES[scheme]
  const merged: Record<string, string> = { ...stock }
  for (const name of Object.values(SURFACE_TOKENS)) {
    const value = registeredTokens[name]
    if (typeof value === 'string') merged[name] = solid(value)
  }
  return merged
}
