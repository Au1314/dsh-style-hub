/**
 * dsh-style-hub — Host half.
 *
 * Registers the `style-hub` settings namespace (the join key the settings
 * card is dispatched on), serves the wallpaper library over one prefix route,
 * and answers every index render with the boot wallpaper layer so the first
 * paint already shows the user's picture instead of the stock shell.
 *
 * Nothing here imports a DSH package at runtime: the service surfaces arrive
 * on `ctx` and their types come from type-only imports, so the Host half has
 * no runtime dependency beyond schemastery and Node built-ins.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createRoute, ROUTE_PATH } from './routes.ts'
import { DEFAULT_SETTINGS, SETTINGS_NS, type StyleHubSettings, validateSettings } from './shared/settings.ts'
import { ID_PATTERN, ImageStore } from './storage.ts'
import { WALLPAPER_ELEMENT, wallpaperCss, type WallpaperLayer } from './shared/wallpaper-css.ts'

/** Package name, surfaced to the plugin inspector. */
export const name = 'dsh-style-hub'

/**
 * The section schema. Only JSON primitives appear here: the client settings
 * scope writes one field per gesture, and every range constraint lives in
 * {@link validateSettings} so a stored document can be re-judged without a
 * schema upgrade.
 */
export const StyleHubSchema: z<StyleHubSettings> = z.object({
  enabled: z.boolean().default(DEFAULT_SETTINGS.enabled),
  themeId: z.string().default(DEFAULT_SETTINGS.themeId),
  accent: z.string().default(DEFAULT_SETTINGS.accent),
  panelOpacity: z.number().min(0.8).max(1).default(DEFAULT_SETTINGS.panelOpacity),
  wallpaperId: z.string().default(DEFAULT_SETTINGS.wallpaperId),
  wallpaperFit: z.union(['cover', 'contain'] as const).default(DEFAULT_SETTINGS.wallpaperFit),
  wallpaperOpacity: z.number().min(0).max(1).default(DEFAULT_SETTINGS.wallpaperOpacity),
  wallpaperBlur: z.number().min(0).max(50).default(DEFAULT_SETTINGS.wallpaperBlur),
  wallpaperDim: z.number().min(0).max(1).default(DEFAULT_SETTINGS.wallpaperDim),
})

/**
 * Resolve the plugin's data directory.
 *
 * The settings document is the most accurate DSH home signal available, so
 * its directory is preferred; an environment override and the default home
 * cover the compositions where no file provider is mounted.
 * @param ctx - the plugin context.
 * @returns an absolute directory owned by this plugin.
 */
export function resolveDataDir(ctx: Context): string {
  const explicit = process.env.DSH_STYLE_HUB_DIR
  if (explicit) return explicit
  const document = ctx.get('settings')?.documentPath
  const home = document ? dirname(document) : process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'dsh-style-hub')
}

/**
 * Build the boot wallpaper rule for one section.
 * @param settings - current resolved section.
 * @returns CSS, or '' when the first paint should stay stock.
 */
export function bootWallpaperCss(settings: StyleHubSettings): string {
  if (!settings.enabled || !ID_PATTERN.test(settings.wallpaperId)) return ''
  const layer: WallpaperLayer = {
    id: settings.wallpaperId,
    fit: settings.wallpaperFit === 'contain' ? 'contain' : 'cover',
    opacity: settings.wallpaperOpacity,
    blur: settings.wallpaperBlur,
    dim: settings.wallpaperDim,
  }
  return wallpaperCss(layer)
}

/**
 * Required services: none at composition time.
 *
 * The two services this half uses are both acquired *inside* `apply`, each
 * with its own local `ctx.inject`: a profile with no HTTP surface (headless,
 * TUI) must still compose this bundle and serve its settings namespace, so
 * `webServer` may arrive late or never, and neither case is a failure.
 */
export const inject: string[] = []

/**
 * Compose the Host half.
 * @param ctx - plugin context; `settings` and `webServer` are acquired locally.
 */
export function apply(ctx: Context): void {
  const store = new ImageStore(resolveDataDir(ctx))
  const route = createRoute(store)
  let scope: SettingsScope<StyleHubSettings> | undefined

  ctx.inject(['settings'], settingsCtx => {
    scope = settingsCtx.settings.register(SETTINGS_NS, StyleHubSchema, {
      validate: validateSettings,
    })
    console.log(`[dsh-style-hub] settings namespace "${SETTINGS_NS}" registered`)
  })

  // Not injected at composition time: `apply` runs when this row is loaded,
  // which can be before the web server provides. Waiting for it here keeps
  // the rest of the bundle (the settings namespace above) alive in a profile
  // that never provides one.
  ctx.inject(['webServer'], webCtx => {
    webCtx.effect(() => webCtx.webServer.register(route), `dsh-style-hub: ${route.path}`)
    console.log(`[dsh-style-hub] serving ${route.path}`)

    webCtx.on('webserver/index-inject', table => {
      // Read live: the rows must reflect the section as it stands at this render.
      let settings = DEFAULT_SETTINGS
      try {
        settings = scope?.get() ?? DEFAULT_SETTINGS
      } catch {
        settings = DEFAULT_SETTINGS
      }
      const css = bootWallpaperCss(settings)
      if (css) {
        // The element first (so the layer exists by the time the rule below
        // applies), then the rule.
        table.push({ kind: 'html', placement: 'body', html: WALLPAPER_ELEMENT })
        table.push({ kind: 'style', text: css })
      }
    })
  })
}

export { ROUTE_PATH }
export { ImageStore } from './storage.ts'
export { createRoute } from './routes.ts'
