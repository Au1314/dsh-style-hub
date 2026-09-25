/**
 * The wallpaper layer's CSS, shared by both halves.
 *
 * The Host renders it into `index.html` as an injection row so the very first
 * paint already shows the wallpaper, and the browser half renders the exact
 * same rule into its own `<style>` element on every parameter change — one
 * source, so the boot layer and the live layer can never drift.
 *
 * The layer is a dedicated element rather than `body::before`: owning a
 * namespaced node is what lets the runtime create, restyle, and remove the
 * layer without touching anyone else's pseudo-element, and lets a running page
 * drop a wallpaper that was present when it loaded.
 */

/** Attribute naming the layer element this plugin owns exclusively. */
export const WALLPAPER_ATTR = 'data-ds-style-hub-wallpaper'

/** Selector addressing the layer element. */
export const WALLPAPER_SELECTOR = `[${WALLPAPER_ATTR}]`

/** Boot row markup: the element the first paint paints, created by the Host. */
export const WALLPAPER_ELEMENT = `<div ${WALLPAPER_ATTR}></div>`

/** Wallpaper layer inputs. */
export interface WallpaperLayer {
  /** Storage id of the selected image. */
  id: string
  /** `cover` crops, `contain` letterboxes. */
  fit: 'cover' | 'contain'
  /** Layer opacity, 0..1. */
  opacity: number
  /** Blur radius in px, 0..50. */
  blur: number
  /** Black veil strength, 0..1. */
  dim: number
}

/**
 * URL of one stored wallpaper, relative so a proxy path still resolves.
 * @param id - storage id.
 * @returns the request path.
 */
export function wallpaperUrl(id: string): string {
  return `/api/style-hub/wallpapers/${id}`
}

/**
 * Build the layer rule, or an empty string when no layer should paint.
 *
 * The element is fixed to the viewport at `z-index: -1`, so it sits above the
 * canvas and below the application frame — which is what lets a translucent
 * frame (`bg-base` at less than full opacity) reveal the picture.
 *
 * A blurred plane leaves a soft seam at the viewport edge, so the plane is
 * scaled up a hair while blurred; at zero blur the transform is dropped
 * entirely to keep the plane pixel-exact.
 * @param layer - the current selection and its parameters.
 * @param base - solid canvas colour to paint behind a translucent image, so
 * the picture blends against the theme instead of the UA's default white.
 * @returns CSS rules, or '' when there is nothing to show.
 */
export function wallpaperCss(layer: WallpaperLayer, base?: string): string {
  if (!layer.id) return ''
  // A bare string in `background-image` is not an <image>, and the browser
  // drops the whole declaration for it — the layer would paint nothing.
  const image = `url("${wallpaperUrl(layer.id)}")`
  const veil = layer.dim > 0 ? `linear-gradient(rgba(0,0,0,${layer.dim}),rgba(0,0,0,${layer.dim})), ` : ''
  const transform = layer.blur > 0 ? ';transform:scale(1.03)' : ''
  const plane =
    `${WALLPAPER_SELECTOR}{position:fixed;inset:0;z-index:-1;pointer-events:none;` +
    `background-image:${veil}${image};background-size:${layer.fit};background-position:center;` +
    `background-repeat:no-repeat;opacity:${clampUnit(layer.opacity)};filter:blur(${clampBlur(layer.blur)}px)${transform}}`
  return base ? `html{background-color:${base}}${plane}` : plane
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1
}

function clampBlur(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(50, value)) : 0
}
