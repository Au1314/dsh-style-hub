/**
 * The bundled style presets.
 *
 * A preset is twelve swatches plus a scheme; every surface, border, and label
 * token the GUI reads is derived from them by `tokensFor`, which is what keeps
 * a preset to a description a human can check instead of a hundred literals
 * that can drift apart. Ids are namespaced so they can never collide with a
 * theme registered by another plugin or by the host.
 */

/** Which base palette a preset builds on. */
export type ColorScheme = 'light' | 'dark'

/** The twelve swatches every preset is described by. */
export interface Palette {
  /** Page canvas. */
  bg: string
  /** Primary raised surface. */
  s1: string
  /** Secondary nested surface. */
  s2: string
  /** Tertiary surface: overlays, menus, toasts. */
  s3: string
  /** Sidebar column. */
  side: string
  /** Code blocks and inline code. */
  code: string
  /** Primary text. */
  fg: string
  /** Secondary text. */
  fg2: string
  /** Brand accent. */
  accent: string
  /** Success state. */
  success: string
  /** Error state. */
  error: string
  /** Warning state. */
  warning: string
}

/**
 * Identifiers of the bundled presets.
 *
 * A union rather than `string` so `preset.${id}` reads in the dictionary are
 * checked against the translation table at compile time instead of resolving
 * to a blank at runtime.
 */
export type PresetId =
  | 'nord'
  | 'dracula'
  | 'mocha'
  | 'tokyo-night'
  | 'gruvbox-dark'
  | 'solarized-light'
  | 'github-light'
  | 'latte'

/** One selectable bundled style. */
export interface Preset {
  /** Stable id; the registered theme id is `${THEME_ID_PREFIX}${id}`. */
  id: PresetId
  /** Scheme the preset builds on. */
  colorScheme: ColorScheme
  /** Swatches every token derives from. */
  palette: Palette
}

/** Prefix separating this plugin's registered theme ids from everyone else's. */
export const THEME_ID_PREFIX = 'sh:'

/**
 * Registered theme id for one preset.
 * @param id - the preset id.
 * @returns the theme id to register and select.
 */
export function themeIdOf(id: string): string {
  return `${THEME_ID_PREFIX}${id}`
}

/**
 * Inverse of {@link themeIdOf}.
 * @param id - a theme id.
 * @returns the preset id it names, or undefined when it is not one of ours.
 */
export function presetIdOf(id: string): string | undefined {
  return id.startsWith(THEME_ID_PREFIX) ? id.slice(THEME_ID_PREFIX.length) : undefined
}

/** Nord. */
const NORD: Palette = {
  bg: '#2e3440',
  s1: '#3b4252',
  s2: '#434c5e',
  s3: '#4c566a',
  side: '#2e3440',
  code: '#3b4252',
  fg: '#eceff4',
  fg2: '#d8dee9',
  accent: '#88c0d0',
  success: '#a3be8c',
  error: '#bf616a',
  warning: '#ebcb8b',
}

/** Dracula. */
const DRACULA: Palette = {
  bg: '#282a36',
  s1: '#343746',
  s2: '#3a3d4d',
  s3: '#44475a',
  side: '#21222c',
  code: '#343746',
  fg: '#f8f8f2',
  fg2: '#bdbeba',
  accent: '#bd93f9',
  success: '#50fa7b',
  error: '#ff5555',
  warning: '#f1fa8c',
}

/** Catppuccin Mocha. */
const MOCHA: Palette = {
  bg: '#1e1e2e',
  s1: '#313244',
  s2: '#45475a',
  s3: '#585b70',
  side: '#181825',
  code: '#313244',
  fg: '#cdd6f4',
  fg2: '#a6adc8',
  accent: '#89b4fa',
  success: '#a6e3a1',
  error: '#f38ba8',
  warning: '#f9e2af',
}

/** Tokyo Night. */
const TOKYO_NIGHT: Palette = {
  bg: '#1a1b26',
  s1: '#24283b',
  s2: '#2f3349',
  s3: '#414868',
  side: '#16161e',
  code: '#24283b',
  fg: '#c0caf5',
  fg2: '#a9b1d6',
  accent: '#7aa2f7',
  success: '#9ece6a',
  error: '#f7768e',
  warning: '#e0af68',
}

/** Gruvbox Dark. */
const GRUVBOX_DARK: Palette = {
  bg: '#282828',
  s1: '#32302f',
  s2: '#3c3836',
  s3: '#504945',
  side: '#1d2021',
  code: '#32302f',
  fg: '#ebdbb2',
  fg2: '#d5c4a1',
  accent: '#83a598',
  success: '#b8bb26',
  error: '#fb4934',
  warning: '#fabd2f',
}

/** Solarized Light. */
const SOLARIZED_LIGHT: Palette = {
  bg: '#fdf6e3',
  s1: '#eee8d5',
  s2: '#e6dcc2',
  s3: '#dcd3b7',
  side: '#eee8d5',
  code: '#eee8d5',
  fg: '#37474f',
  fg2: '#586e75',
  accent: '#268bd2',
  success: '#6c8c2a',
  error: '#dc322f',
  warning: '#b58900',
}

/** GitHub Light. */
const GITHUB_LIGHT: Palette = {
  bg: '#ffffff',
  s1: '#f6f8fa',
  s2: '#eef1f4',
  s3: '#e4e8ec',
  side: '#f6f8fa',
  code: '#f6f8fa',
  fg: '#1f2328',
  fg2: '#59636e',
  accent: '#0969da',
  success: '#1a7f37',
  error: '#cf222e',
  warning: '#9a6700',
}

/** Catppuccin Latte. */
const LATTE: Palette = {
  bg: '#eff1f5',
  s1: '#e6e9ef',
  s2: '#dde1e8',
  s3: '#ccd0da',
  side: '#e6e9ef',
  code: '#e6e9ef',
  fg: '#4c4f69',
  fg2: '#6c6f85',
  accent: '#1e66f5',
  success: '#40a02b',
  error: '#d20f39',
  warning: '#df8e1d',
}

/** The bundled catalogue, dark styles first. */
export const PRESETS: readonly Preset[] = Object.freeze([
  Object.freeze({ id: 'nord', colorScheme: 'dark', palette: NORD }),
  Object.freeze({ id: 'dracula', colorScheme: 'dark', palette: DRACULA }),
  Object.freeze({ id: 'mocha', colorScheme: 'dark', palette: MOCHA }),
  Object.freeze({ id: 'tokyo-night', colorScheme: 'dark', palette: TOKYO_NIGHT }),
  Object.freeze({ id: 'gruvbox-dark', colorScheme: 'dark', palette: GRUVBOX_DARK }),
  Object.freeze({ id: 'solarized-light', colorScheme: 'light', palette: SOLARIZED_LIGHT }),
  Object.freeze({ id: 'github-light', colorScheme: 'light', palette: GITHUB_LIGHT }),
  Object.freeze({ id: 'latte', colorScheme: 'light', palette: LATTE }),
])

/** Every bundled preset id, for membership checks. */
export const PRESET_IDS: ReadonlySet<string> = new Set(PRESETS.map(preset => preset.id))

/**
 * Look one preset up.
 *
 * The section stores the registered id (`sh:nord`), but a bare preset id is
 * accepted too: the card used to write one, so a section written before that
 * was corrected still has to resolve to the same chip.
 * @param id - registered theme id or preset id.
 * @returns the preset, or undefined when the id is not bundled.
 */
export function findPreset(id: string): Preset | undefined {
  const bare = presetIdOf(id) ?? id
  return PRESETS.find(preset => preset.id === bare)
}

/**
 * Registered theme id for whatever the section stores.
 *
 * Ids the registry needs are prefixed; the section may hold either form, and
 * passing a bare id through would miss the registry and select nothing.
 * @param id - registered theme id, preset id, or {@link STOCK_THEME}.
 * @returns the id to look up and select.
 */
export function registryIdOf(id: string): string {
  return id.startsWith(THEME_ID_PREFIX) ? id : themeIdOf(id)
}
