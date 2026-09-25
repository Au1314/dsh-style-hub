/**
 * dsh-style-hub — browser half.
 *
 * Three responsibilities, in the order they depend on each other:
 *
 * 1. Register the eight bundled styles with the theme registry and the card's
 *    dictionaries with the locale service.
 * 2. Reconcile the `style-hub` section onto the live presentation: the selected
 *    style, the accent and panel-opacity tweaks, and the wallpaper layer.
 * 3. Contribute the settings card into the configurable-plugins tab.
 *
 * The third half of the reconciliation is where the interesting constraint
 * lives. The theme preference is a *stock* preference: `setTheme` persists only
 * `light`, `dark`, or `system`, so a style this plugin registered is lost across
 * a reload by design. The section is what remembers it, and this file replays it
 * — which is also why the switch-off path restores the preference the user had
 * before rather than a fixed default: nothing here should decide what "normal"
 * looks like for somebody else's deployment.
 *
 * Nothing here imports a DSH package at runtime: every service arrives on `ctx`
 * and the packages are type-only imports, so the browser half keeps the bundle
 * purity rule (cross-plugin collaboration through cordis, never through values).
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import {
  DEFAULT_SETTINGS,
  LOCALE_NS,
  SETTINGS_NS,
  STOCK_THEME,
  type StyleHubSettings,
} from '../shared/settings.ts'
import {
  WALLPAPER_ATTR,
  WALLPAPER_SELECTOR,
  wallpaperCss,
  type WallpaperLayer,
} from '../shared/wallpaper-css.ts'
import { StyleHubController, type StyleHubCardFace } from './controller.ts'
import { en, zh } from './locales.ts'
import { PRESETS, registryIdOf, themeIdOf, THEME_ID_PREFIX } from './palettes.ts'
import { STYLE_ELEMENT_ID, installCardStyles } from './styles.ts'
import { SURFACE_TOKENS, surfacesOf, tokensFor } from './tokens.ts'
import { StyleHubCard } from './StyleHubCard.tsx'
import { buildTweakLayer, fingerprint, TWEAK_SOURCE, tweakSurfaces } from './tweaks.ts'

/** Id of the stylesheet element carrying the live wallpaper rule. */
const WALLPAPER_STYLE_ID = 'dsh-style-hub-wallpaper'

/**
 * Required services: the slot registry and locale seat the card registers
 * through, the settings transport that carries the section, `remote` (which
 * `settingsScope.bind` subscribes to on this context), and the theme registry
 * the styles are contributed to.
 */
export const inject = ['slots', 'locale', 'remote', 'settingsScope', 'theme']

/**
 * Compose the browser half.
 * @param ctx - client cordis context; every injected service is ready here.
 */
export function apply(ctx: ClientContext): void {
  const scope = ctx.settingsScope.bind<StyleHubSettings>({ namespace: SETTINGS_NS })

  for (const preset of PRESETS) {
    ctx.effect(
      () =>
        ctx.theme.register({
          id: themeIdOf(preset.id),
          colorScheme: preset.colorScheme,
          tokens: tokensFor(preset.palette, preset.colorScheme),
        }),
      `dsh-style-hub: style ${preset.id}`,
    )
  }

  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-style-hub: dictionaries')

  ctx.effect(() => {
    const owned = installCardStyles()
    return () => {
      if (owned) document.getElementById(STYLE_ELEMENT_ID)?.remove()
    }
  }, 'dsh-style-hub: card stylesheet')

  const controller = new StyleHubController(scope)
  ctx.effect(() => controller.start(), 'dsh-style-hub: card controller')

  const face: StyleHubCardFace = {
    snapshot: controller.snapshot,
    subscribe: controller.subscribe,
    patch: controller.patch,
    upload: controller.upload,
    removeWallpaper: controller.removeWallpaper,
  }

  ctx.slots.inject('settings.plugin.item', () =>
    ctx.slots.register(
      {
        name: 'settings.plugin.item',
        key: SETTINGS_NS,
        locale: LOCALE_NS,
        registrant: 'dsh-style-hub',
        inject: () => face,
      },
      StyleHubCard,
    ),
  )

  /**
   * The presentation reconciliation. Re-entrant calls are dropped rather than
   * queued: `setTheme` and `overrideTokens` both emit `theme/change`, so a
   * pipeline that re-entered itself would chase its own tail.
   */
  let applying = false
  /** The preference the user held before this plugin ever selected one of its own. */
  let stockPreference: string | undefined
  /** Whether the last reconciliation left a style of ours selected. */
  let engaged = false
  /** Tweak layer currently stacked, and the fingerprint that produced it. */
  let releaseTweak: (() => void) | undefined
  let tweakFingerprint: string | undefined

  // Remember the preference in force before this plugin ever selected one of
  // its own. Without this, a first switch-off would have nothing to hand back
  // to: the section is replayed before any `theme/change` has been observed.
  const heldBeforeUs = ctx.theme.getTheme().preference
  if (!heldBeforeUs.startsWith(THEME_ID_PREFIX)) stockPreference = heldBeforeUs

  /**
   * Read the section and make the page match it.
   *
   * `status !== 'ready'` is a no-op, not a reset: the Host's boot layer is
   * already painting the right wallpaper from the same section, and acting on
   * the composition base while the first read is in flight would strip it.
   */
  const sync = (): void => {
    if (applying) return
    const view = scope.getSnapshot()
    if (view.status !== 'ready') return
    const settings = view.value ?? DEFAULT_SETTINGS
    applying = true
    try {
      syncTheme(ctx, settings, () => stockPreference, engaged, next => (engaged = next))
      // The preference just changed (or was confirmed), so the registry's own
      // snapshot is the one to derive from — never a stale read from earlier.
      const theme = ctx.theme.getTheme()
      const registered = theme.themes.find(candidate => candidate.id === theme.active.id) ?? theme.active
      syncTweak(
        ctx,
        settings,
        registered.tokens,
        registered.colorScheme,
        releaseTweak,
        next => (releaseTweak = next),
        tweakFingerprint,
        next => (tweakFingerprint = next),
      )
      syncWallpaper(settings, registered.tokens, registered.colorScheme)
    } finally {
      applying = false
    }
  }

  ctx.effect(() => scope.subscribe(sync), 'dsh-style-hub: section reconciliation')
  ctx.effect(
    () =>
      ctx.on('theme/change', snapshot => {
        // Anything that is not ours is the preference the user actually holds;
        // remembering it is what makes "turn the feature off" a restore.
        if (!snapshot.preference.startsWith(THEME_ID_PREFIX)) stockPreference = snapshot.preference
        sync()
      }),
    'dsh-style-hub: theme observation',
  )
  sync()

  ctx.effect(() => {
    return () => {
      releaseTweak?.()
      paintWallpaper(undefined, undefined)
      // Give the preference back while our styles are still registered, so the
      // registry reset that follows lands on the user's choice rather than on
      // whichever value happens to be underneath ours.
      if (engaged && stockPreference && ctx.theme.getTheme().preference.startsWith(THEME_ID_PREFIX)) {
        ctx.theme.setTheme(stockPreference)
      }
    }
  }, 'dsh-style-hub: presentation teardown')
}

/**
 * Select the style the section names, or hand the preference back.
 *
 * `themeId === 'stock'` deliberately calls nothing: "follow the system
 * appearance" means leave the Appearance preference where the user put it, and
 * writing a value there — even the value already stored — would turn a
 * non-decision into one.
 * @param ctx - client context holding the theme registry.
 * @param settings - the resolved section.
 * @param readStock - the preference remembered from before us.
 * @param engaged - whether the last pass selected one of our styles.
 * @param writeEngaged - records whether this pass selected one of ours.
 */
function syncTheme(
  ctx: ClientContext,
  settings: StyleHubSettings,
  readStock: () => string | undefined,
  engaged: boolean,
  writeEngaged: (next: boolean) => void,
): void {
  const snapshot = ctx.theme.getTheme()
  if (settings.enabled && settings.themeId !== STOCK_THEME) {
    // The section names the preset; the registry knows it under its prefix.
    const registryId = registryIdOf(settings.themeId)
    const known = snapshot.themes.some(theme => theme.id === registryId)
    if (known && snapshot.preference !== registryId) ctx.theme.setTheme(registryId)
    writeEngaged(true)
    return
  }
  if (engaged) {
    // The switch just came off (or moved to `stock`): hand the preference back.
    // `system` is the last resort only for the case where the plugin took hold
    // of a preference it never saw a stock value under.
    const stock = readStock() ?? 'system'
    if (snapshot.preference !== stock) ctx.theme.setTheme(stock)
  }
  writeEngaged(settings.enabled)
}

/**
 * Restack the accent / panel-translucency override layer.
 *
 * An empty layer is torn down rather than registered as `{}`: a layer that
 * contributes nothing should not exist, because its presence is what the
 * fingerprint comparison reads as "already applied".
 * @param ctx - client context holding the theme registry.
 * @param settings - the resolved section.
 * @param registeredTokens - uncomposed tokens of the active theme.
 * @param scheme - colour scheme the active theme declares.
 * @param release - disposer of the layer currently stacked, if any.
 * @param writeRelease - records the new disposer.
 * @param known - fingerprint of the layer currently stacked, if any.
 * @param writeKnown - records the new fingerprint.
 */
function syncTweak(
  ctx: ClientContext,
  settings: StyleHubSettings,
  registeredTokens: Record<string, string>,
  scheme: 'light' | 'dark',
  release: (() => void) | undefined,
  writeRelease: (next: (() => void) | undefined) => void,
  known: string | undefined,
  writeKnown: (next: string | undefined) => void,
): void {
  const layer = buildTweakLayer(settings, tweakSurfaces(registeredTokens, scheme))
  const empty = Object.keys(layer).length === 0
  if (empty) {
    if (known === undefined) return
    release?.()
    writeRelease(undefined)
    writeKnown(undefined)
    return
  }
  const next = fingerprint(layer)
  if (next === known) return
  release?.()
  writeRelease(ctx.theme.overrideTokens(TWEAK_SOURCE, layer))
  writeKnown(next)
}

/**
 * Paint or clear the wallpaper layer.
 *
 * The rule lives in its own element beside the Host's boot rule, so this is
 * the authoritative copy while the browser half is running; clearing removes
 * both the rule and the plane, which is what turns the boot layer off again.
 * @param settings - the resolved section.
 * @param registeredTokens - uncomposed tokens of the active theme.
 * @param scheme - colour scheme the active theme declares.
 */
function syncWallpaper(
  settings: StyleHubSettings,
  registeredTokens: Record<string, string>,
  scheme: 'light' | 'dark',
): void {
  if (!settings.enabled || settings.wallpaperId === '') {
    paintWallpaper(undefined, undefined)
    return
  }
  const layer: WallpaperLayer = {
    id: settings.wallpaperId,
    fit: settings.wallpaperFit === 'contain' ? 'contain' : 'cover',
    opacity: settings.wallpaperOpacity,
    blur: settings.wallpaperBlur,
    dim: settings.wallpaperDim,
  }
  const base = surfacesOf(registeredTokens, scheme)[SURFACE_TOKENS.base]
  paintWallpaper(layer, base)
}

/**
 * Install or remove the live wallpaper rule and its plane.
 * @param layer - the layer to paint, or undefined to clear it.
 * @param base - solid canvas colour to sit behind a translucent image.
 */
function paintWallpaper(layer: WallpaperLayer | undefined, base: string | undefined): void {
  if (typeof document === 'undefined') return
  const style = document.getElementById(WALLPAPER_STYLE_ID)
  const plane = document.querySelector<HTMLElement>(WALLPAPER_SELECTOR)
  if (!layer) {
    style?.remove()
    plane?.remove()
    return
  }
  const tag = style ?? document.createElement('style')
  if (!style) {
    tag.id = WALLPAPER_STYLE_ID
    document.head.append(tag)
  }
  tag.textContent = wallpaperCss(layer, base)
  if (!plane && document.body) {
    const element = document.createElement('div')
    element.setAttribute(WALLPAPER_ATTR, '')
    document.body.append(element)
  }
}
