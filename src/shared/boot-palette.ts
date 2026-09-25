/**
 * The boot palette: what the Host paints the very first frame with.
 *
 * The registry that owns a style exists only once the browser half has
 * registered it, and until the presenter writes its snapshot the design
 * system's own stylesheets paint the stock palette — so a selected style used
 * to land a beat after the page did. This module derives the *same* directory
 * the browser half will register (one preset plus the tweak layer, so the
 * accent and the panel translucency are already right) and hands the Host a
 * `script` injection row that writes it where the presenter writes it: inline
 * custom properties on `body`, the palette attribute, and the root
 * `color-scheme`.
 *
 * Inline declarations beat every stylesheet however it is ordered, and the
 * token names are exactly the ones the presenter tracks — so its retraction
 * removes this layer by name when the feature is switched off rather than
 * stranding it under a stock palette.
 *
 * Like everything else under `shared/`, no DSH package is imported: by the
 * time the Host pushes the row it is plain text.
 */
import { findPreset, type ColorScheme } from './palettes.ts'
import { STOCK_THEME, type StyleHubSettings } from './settings.ts'
import { buildTweakLayer, tweakSurfaces } from './tweaks.ts'
import { tokensFor, type Tokens } from './tokens.ts'

/** Body attribute the presenter sets to select the dark base palette. */
const DARK_ATTRIBUTE = 'data-ds-dark-theme'

/** One resolved first-paint palette. */
export interface BootPalette {
  /** Scheme the palette belongs to, written to the root `color-scheme`. */
  scheme: ColorScheme
  /** Variable name → value, tweak layer already folded in. */
  tokens: Tokens
}

/**
 * Derive the first-paint palette for one section.
 * @param settings - the resolved section.
 * @returns the palette, or undefined when the first paint should stay stock
 * (feature off, `stock` selected, or an id the catalogue does not carry).
 */
export function bootPalette(settings: StyleHubSettings): BootPalette | undefined {
  if (!settings.enabled || settings.themeId === STOCK_THEME) return undefined
  const preset = findPreset(settings.themeId)
  if (preset === undefined) return undefined
  const tokens = tokensFor(preset.palette, preset.colorScheme)
  const layer = buildTweakLayer(settings, tweakSurfaces(tokens, preset.colorScheme))
  for (const [name, modes] of Object.entries(layer)) tokens[name] = modes[preset.colorScheme]
  return { scheme: preset.colorScheme, tokens }
}

/**
 * Render one section's palette as the text of a `script` injection row.
 *
 * The row is placed directly after the opening `<body>` tag, so it runs while
 * the document is still parsing — before the composition's module scripts, and
 * therefore before anything else could paint. `<` never survives into the
 * payload, so the text is safe to place in the document verbatim.
 * @param settings - the resolved section.
 * @returns script text, or '' when the first paint should stay stock.
 */
export function bootPaletteScript(settings: StyleHubSettings): string {
  const boot = bootPalette(settings)
  if (boot === undefined) return ''
  const payload = JSON.stringify(boot.tokens).replaceAll('<', '\\u003c')
  return (
    `(function(t,s,d){var b=document.body;if(!b)return;` +
    `if(s==='dark')b.setAttribute(d,'');else b.removeAttribute(d);` +
    `document.documentElement.style.colorScheme=s;` +
    `for(var n in t)b.style.setProperty(n,t[n])})` +
    `(${payload},${JSON.stringify(boot.scheme)},${JSON.stringify(DARK_ATTRIBUTE)})`
  )
}
