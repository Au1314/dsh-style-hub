/**
 * The settings card's controller: the bridge between one bound settings
 * scope, the wallpaper library, and the component.
 *
 * The component never talks to the wire. It reads an immutable state object
 * through `snapshot()`/`subscribe()` — the `useSyncExternalStore` contract,
 * so a render only happens when a field the controller already reconciled
 * actually changed — and writes through `patch`, which is a plain field write
 * over the Host-backed scope. Availability, writability, and in-flight work
 * all live here so the component stays a pure function of state.
 */
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { DEFAULT_SETTINGS, type StyleHubSettings } from '../shared/settings.ts'
import { findPreset } from '../shared/palettes.ts'
import { MAX_UPLOAD_BYTES, type WallpaperInfo } from '../shared/wallpapers.ts'
import { deleteWallpaper, listWallpapers, uploadWallpaper } from './api.ts'
import { glassWashesLightStyle, observeGlass, readGlassState, switchToWhiteGlass } from './glass.ts'

/** What the card renders. */
export interface StyleHubCardState {
  /** Sync state of the namespace; `unavailable` renders nothing at all. */
  status: 'loading' | 'ready' | 'unavailable'
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Last accepted section, or the composition base before the first one. */
  value: StyleHubSettings
  /** Stored wallpaper library, newest first. */
  wallpapers: WallpaperInfo[]
  /** Whether the library is being read. */
  libraryLoading: boolean
  /** Whether an upload or delete is crossing the wire. */
  busy: boolean
  /** Last failure to surface under the control that caused it. */
  error: string | undefined
  /** Whether wallpaper-engine's glass is washing an active light style grey. */
  glassWash: boolean
  /** Whether the glass fix is crossing the wire. */
  glassBusy: boolean
  /** Last failure of the glass fix, shown beside its own control. */
  glassError: string | undefined
}

/** The business face the card's slot entry injects. */
export interface StyleHubCardFace {
  /** Current state; stable between changes. */
  snapshot: () => StyleHubCardState
  /** Observe state replacements. */
  subscribe: (listener: () => void) => () => void
  /** Write one or more section fields immediately. */
  patch: (fields: Partial<StyleHubSettings>) => void
  /** Store one image, refresh the library, and put it to use. */
  upload: (file: File) => Promise<void>
  /** Remove one image from the library and from the selection. */
  removeWallpaper: (id: string) => Promise<void>
  /** Persist white glass in wallpaper-engine's settings and repaint it. */
  fixGlass: () => Promise<void>
}

/**
 * Own the card's state over one settings scope.
 *
 * Construction is inert: {@link start} wires the scope subscription and the
 * first library read, and its disposer tears both down.
 */
export class StyleHubController {
  private readonly scope: SettingsScope<StyleHubSettings>
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribeScope: () => void
  private state: StyleHubCardState
  private libraryRequest = 0
  private disposeGlassObserver: (() => void) | undefined

  /** @param scope - the bound scope for the `style-hub` namespace. */
  constructor(scope: SettingsScope<StyleHubSettings>) {
    this.scope = scope
    this.state = {
      status: 'unavailable',
      writable: false,
      value: DEFAULT_SETTINGS,
      wallpapers: [],
      libraryLoading: false,
      busy: false,
      error: undefined,
      glassWash: false,
      glassBusy: false,
      glassError: undefined,
    }
    this.unsubscribeScope = scope.subscribe(() => this.sync())
    this.sync()
  }

  /**
   * Wire the controller: adopt the scope's first snapshot, read the wallpaper
   * library once, and start watching the neighbour's glass.
   * @returns the disposer releasing the subscriptions and listeners.
   */
  start(): () => void {
    void this.refresh()
    this.recheckGlass()
    this.disposeGlassObserver = observeGlass(() => this.recheckGlass())
    return () => {
      this.disposeGlassObserver?.()
      this.unsubscribeScope()
      this.listeners.clear()
    }
  }

  /** Current state; a stable reference until something changes. */
  readonly snapshot = (): StyleHubCardState => this.state

  /**
   * Observe state replacements.
   * @param listener - invoked after each change.
   * @returns the disposer removing the listener.
   */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Write section fields immediately. Rapid writes preserve order through the
   * scope, so a multi-field gesture settles as the user laid it down.
   * @param fields - fields to write; absent keys are left alone.
   */
  readonly patch = (fields: Partial<StyleHubSettings>): void => {
    for (const [field, value] of Object.entries(fields)) {
      if (value === undefined) continue
      void this.scope.set(field, value).catch((cause: unknown) => {
        this.publish({ error: cause instanceof Error ? cause.message : String(cause) })
      })
    }
  }

  /**
   * Store one image and put it to use.
   * @param file - the picked image; refused here before a round trip when it
   * is not an image or is over the Host's cap.
   */
  readonly upload = async (file: File): Promise<void> => {
    if (file.size > MAX_UPLOAD_BYTES) {
      // Client-side refusals carry a dictionary key (the `@` prefix marks one)
      // so the card can render them in the active locale; a server refusal
      // arrives as the Host's own message and is shown verbatim.
      this.publish({ error: '@wallpaper.tooLarge' })
      return
    }
    this.publish({ busy: true, error: undefined })
    try {
      const wallpaper = await uploadWallpaper(file)
      const enable = !this.state.value.enabled
      this.patch(enable ? { wallpaperId: wallpaper.id, enabled: true } : { wallpaperId: wallpaper.id })
      await this.refresh()
      this.publish({ busy: false })
    } catch (cause) {
      this.publish({ busy: false, error: message(cause) })
    }
  }

  /**
   * Remove one image.
   * @param id - the wallpaper to delete.
   */
  readonly removeWallpaper = async (id: string): Promise<void> => {
    this.publish({ busy: true, error: undefined })
    try {
      await deleteWallpaper(id)
      if (this.state.value.wallpaperId === id) this.patch({ wallpaperId: '' })
      await this.refresh()
      this.publish({ busy: false })
    } catch (cause) {
      this.publish({ busy: false, error: message(cause) })
    }
  }

  /**
   * Clear the wash: persist wallpaper-engine's glass colour as white through
   * their own route, repaint it, and let the detection confirm the answer
   * rather than asserting it here.
   */
  readonly fixGlass = async (): Promise<void> => {
    this.publish({ glassBusy: true, glassError: undefined })
    try {
      await switchToWhiteGlass()
      this.publish({ glassBusy: false })
      this.recheckGlass()
    } catch {
      this.publish({ glassBusy: false, glassError: '@glass.failed' })
    }
  }

  /** Re-read the wallpaper library. */
  private async refresh(): Promise<void> {
    const ticket = ++this.libraryRequest
    this.publish({ libraryLoading: true })
    try {
      const wallpapers = await listWallpapers()
      // A slower earlier read must not overwrite a newer one.
      if (ticket !== this.libraryRequest) return
      this.publish({ libraryLoading: false, wallpapers })
    } catch (cause) {
      if (ticket !== this.libraryRequest) return
      this.publish({ libraryLoading: false, error: message(cause) })
    }
  }

  /** Reconcile the state object with the scope and the local flags. */
  private sync(): void {
    const snapshot = this.scope.getSnapshot()
    this.publish({
      status: snapshot.status,
      writable: snapshot.writable,
      value: snapshot.value ?? DEFAULT_SETTINGS,
    })
    // The section names the style, so a style change can create or dissolve
    // the conflict on its own — no DOM signal is needed for that half.
    this.recheckGlass()
  }

  /**
   * Ask the document whether the neighbour's glass is washing an active
   * light style, and publish the answer only when it changed.
   */
  private recheckGlass(): void {
    const preset = findPreset(this.state.value.themeId)
    const lightStyleActive = this.state.value.enabled && preset?.colorScheme === 'light'
    this.publish({ glassWash: glassWashesLightStyle(readGlassState(), lightStyleActive) })
  }

  /**
   * Apply a partial change and notify only when it actually differs.
   * @param next - fields to merge over the current state.
   */
  private publish(next: Partial<StyleHubCardState>): void {
    const merged: StyleHubCardState = { ...this.state, ...next }
    if (
      merged.status === this.state.status &&
      merged.writable === this.state.writable &&
      merged.value === this.state.value &&
      merged.wallpapers === this.state.wallpapers &&
      merged.libraryLoading === this.state.libraryLoading &&
      merged.busy === this.state.busy &&
      merged.error === this.state.error &&
      merged.glassWash === this.state.glassWash &&
      merged.glassBusy === this.state.glassBusy &&
      merged.glassError === this.state.glassError
    ) {
      return
    }
    this.state = merged
    for (const listener of [...this.listeners]) listener()
  }
}

/**
 * Render a thrown value as a short message.
 * @param cause - whatever the call rejected with.
 * @returns a message fit for the card's error line.
 */
function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
