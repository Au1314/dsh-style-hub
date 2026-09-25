/**
 * The Style Hub settings card.
 *
 * A pure function of the controller's state: it owns no data, performs no
 * network work, and writes only through the injected face — which is what
 * lets the same component render identically whether the Host document is
 * writable, read-only, or still loading. Controls disable themselves from
 * `writable` rather than being hidden, so a read-only deployment still shows
 * what is configured.
 */
import { useSyncExternalStore, useRef, type JSX } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { StyleHubCardFace } from './controller.ts'
import type { StyleHubKey } from './locales.ts'
import { LOCALE_NS } from '../shared/settings.ts'
import { findPreset, presetIdOf, PRESETS, themeIdOf, type PresetId } from '../shared/palettes.ts'
import { wallpaperSrc } from './api.ts'

/** Accent used for the colour control's own display when no override is set. */
const FALLBACK_ACCENT = '#4176e6'

/**
 * The framework's composed share for one `settings.plugin.item` entry: the
 * owner props the tab renders with, the locale seat, and this registrant's
 * injected face. The component references this composition rather than
 * restating it, so a contract change on either side fails at the register call.
 */
export type StyleHubCardProps = PropsRuntime<'settings.plugin.item'> &
  PropsLocale<typeof LOCALE_NS> &
  InjectFace<StyleHubCardFace>

/**
 * Render one plugin card.
 * @param props - the injected face and the locale seat.
 * @returns the card, or nothing while the namespace is not served here.
 */
export function StyleHubCard(props: StyleHubCardProps): JSX.Element | null {
  const state = useSyncExternalStore(props.subscribe, props.snapshot)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const t = props.t

  if (state.status !== 'ready') return null

  const { value } = state
  const locked = !state.writable
  const preset = findPreset(value.themeId)
  // Whatever form the section stores, the chips compare in preset ids.
  const active = presetIdOf(value.themeId) ?? value.themeId

  return (
    <section className="dshsh-card">
      <header className="dshsh-head">
        <div className="dshsh-title">{t('card.title')}</div>
        <div className="dshsh-desc">{t('card.description')}</div>
      </header>

      <div className="dshsh-group">
        <label className="dshsh-field">
          <span className="dshsh-fieldText">
            <span className="dshsh-label">{t('enable.label')}</span>
            <span className="dshsh-hint">{t('enable.hint')}</span>
          </span>
          <input
            className="dshsh-switch"
            type="checkbox"
            checked={value.enabled}
            disabled={locked}
            onChange={event => props.patch({ enabled: event.target.checked })}
          />
        </label>
      </div>

      <div className="dshsh-group">
        <div className="dshsh-label">{t('style.label')}</div>
        <div className="dshsh-hint">{t('style.hint')}</div>
        <div className="dshsh-grid">
          <button
            type="button"
            className={`dshsh-chip${active === 'stock' ? ' dshsh-chipOn' : ''}`}
            aria-pressed={active === 'stock'}
            disabled={locked}
            onClick={() => props.patch({ themeId: 'stock' })}
          >
            <span className="dshsh-chipName">{t('style.stock')}</span>
          </button>
          {PRESETS.map(option => {
            const on = active === option.id
            return (
              <button
                key={option.id}
                type="button"
                className={`dshsh-chip${on ? ' dshsh-chipOn' : ''}`}
                aria-pressed={on}
                disabled={locked}
                onClick={() => props.patch(presetOn(themeIdOf(option.id), value.enabled))}
              >
                <span className="dshsh-dots">
                  <span className="dshsh-dot" style={{ background: option.palette.bg }} />
                  <span className="dshsh-dot" style={{ background: option.palette.s1 }} />
                  <span className="dshsh-dot" style={{ background: option.palette.accent }} />
                  <span className="dshsh-dot" style={{ background: option.palette.fg }} />
                </span>
                <span className="dshsh-chipName">{t(`preset.${option.id}`)}</span>
                <span className="dshsh-chipScheme">
                  {option.colorScheme === 'dark' ? t('scheme.dark') : t('scheme.light')}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="dshsh-group">
        <label className="dshsh-field">
          <span className="dshsh-fieldText">
            <span className="dshsh-label">{t('accent.label')}</span>
            <span className="dshsh-hint">{t('accent.hint')}</span>
          </span>
          <span className="dshsh-row">
            <button
              type="button"
              className="dshsh-btn"
              disabled={locked || value.accent === ''}
              onClick={() => props.patch({ accent: '' })}
            >
              {t('accent.reset')}
            </button>
            <input
              className="dshsh-color"
              type="color"
              aria-label={t('accent.label')}
              value={value.accent || preset?.palette.accent || FALLBACK_ACCENT}
              disabled={locked}
              onChange={event => props.patch({ accent: event.target.value })}
            />
          </span>
        </label>
        <Slider
          label={t('panel.label')}
          hint={t('panel.hint')}
          value={value.panelOpacity}
          min={0.8}
          max={1}
          step={0.05}
          display={`${Math.round(value.panelOpacity * 100)}${t('unit.percent')}`}
          disabled={locked}
          onChange={panelOpacity => props.patch({ panelOpacity })}
        />
      </div>

      <div className="dshsh-group">
        <div className="dshsh-label">{t('wallpaper.label')}</div>
        <div className="dshsh-hint">{t('wallpaper.hint')}</div>
        {state.error ? <div className="dshsh-error">{resolveError(t, state.error)}</div> : null}
        <div className="dshsh-row">
          <button
            type="button"
            className="dshsh-btn"
            disabled={locked || state.busy}
            onClick={() => fileInput.current?.click()}
          >
            {state.busy ? t('wallpaper.uploading') : t('wallpaper.upload')}
          </button>
          <button
            type="button"
            className="dshsh-btn"
            disabled={locked || state.busy || value.wallpaperId === ''}
            onClick={() => props.patch({ wallpaperId: '' })}
          >
            {t('wallpaper.none')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void props.upload(file)
            }}
          />
        </div>
        {state.wallpapers.length === 0 ? (
          <div className="dshsh-empty">
            {state.libraryLoading ? t('wallpaper.uploading') : t('wallpaper.empty')}
          </div>
        ) : (
          <div className="dshsh-thumbs">
            {state.wallpapers.map(wallpaper => {
              const on = value.wallpaperId === wallpaper.id
              return (
                <div key={wallpaper.id} className={`dshsh-thumb${on ? ' dshsh-thumbOn' : ''}`}>
                  <button
                    type="button"
                    className="dshsh-thumbBtn"
                    aria-pressed={on}
                    disabled={locked}
                    onClick={() => props.patch({ wallpaperId: wallpaper.id })}
                  >
                    <img
                      className="dshsh-thumbImg"
                      src={wallpaperSrc(wallpaper.id)}
                      alt={wallpaper.name}
                    />
                  </button>
                  <span className="dshsh-thumbBar">
                    <span className="dshsh-thumbName" title={wallpaper.name}>
                      {wallpaper.name}
                    </span>
                    {on ? <span className="dshsh-badge">{t('wallpaper.selected')}</span> : null}
                    <button
                      type="button"
                      className="dshsh-thumbDel"
                      disabled={locked || state.busy}
                      onClick={() => {
                        if (globalThis.confirm(t('wallpaper.deleteConfirm'))) {
                          void props.removeWallpaper(wallpaper.id)
                        }
                      }}
                    >
                      {t('wallpaper.delete')}
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <Select
          label={t('wallpaper.fit')}
          value={value.wallpaperFit}
          disabled={locked || value.wallpaperId === ''}
          options={[
            { value: 'cover', label: t('wallpaper.fit.cover') },
            { value: 'contain', label: t('wallpaper.fit.contain') },
          ]}
          onChange={value => props.patch({ wallpaperFit: narrowFit(value) })}
        />
        <Slider
          label={t('wallpaper.opacity')}
          value={value.wallpaperOpacity}
          min={0}
          max={1}
          step={0.05}
          display={`${Math.round(value.wallpaperOpacity * 100)}${t('unit.percent')}`}
          disabled={locked || value.wallpaperId === ''}
          onChange={wallpaperOpacity => props.patch({ wallpaperOpacity })}
        />
        <Slider
          label={t('wallpaper.blur')}
          value={value.wallpaperBlur}
          min={0}
          max={50}
          step={1}
          display={`${value.wallpaperBlur}${t('unit.px')}`}
          disabled={locked || value.wallpaperId === ''}
          onChange={wallpaperBlur => props.patch({ wallpaperBlur })}
        />
        <Slider
          label={t('wallpaper.dim')}
          value={value.wallpaperDim}
          min={0}
          max={1}
          step={0.05}
          display={`${Math.round(value.wallpaperDim * 100)}${t('unit.percent')}`}
          disabled={locked || value.wallpaperId === ''}
          onChange={wallpaperDim => props.patch({ wallpaperDim })}
        />
      </div>

      {!state.writable ? <div className="dshsh-hint">{t('status.readonly')}</div> : null}
      {/*
        The card's own confirmation of what is selected: the chips say it
        visually, this says it in words — and it stays honest when the section
        points at a theme this plugin did not register (a leftover, or one
        owned by another plugin), where no chip is lit.
      */}
      <div className="dshsh-hint">
        {`${t('style.label')}: ${currentStyleName(t, value.themeId, preset)}`}
      </div>
    </section>
  )
}

/**
 * The write picking a style performs.
 *
 * Picking a style is a wish to see it, so it also switches the feature on;
 * the two land as one ordered pair of writes rather than requiring a second
 * gesture the user did not ask for.
 * @param id - the registered theme id of the preset.
 * @param enabled - whether the section is already switched on.
 * @returns the fields to write.
 */
function presetOn(id: string, enabled: boolean): { themeId: string; enabled?: boolean } {
  return enabled ? { themeId: id } : { themeId: id, enabled: true }
}

/**
 * Resolve a controller error for display.
 * @param t - the namespace's dictionary reader.
 * @param error - a dictionary key marked with `@`, or the Host's own message.
 * @returns the text to show.
 */
function resolveError(t: StyleHubCardProps['t'], error: string): string {
  return error.startsWith('@') ? t(error.slice(1) as StyleHubKey) : error
}

/**
 * Name the selected style for the status line.
 * @param t - the namespace's dictionary reader.
 * @param themeId - whatever theme id the section points at.
 * @param preset - the matching bundled preset, if any.
 * @returns a display name; an unrecognised id is shown verbatim rather than
 * silently blanked, so a stale or foreign selection is visible.
 */
function currentStyleName(t: StyleHubCardProps['t'], themeId: string, preset?: { id: PresetId }): string {
  if (themeId === 'stock') return t('style.stock')
  if (preset) return t(`preset.${preset.id}`)
  return themeId
}

/**
 * Narrow a select's raw reported value to the two shapes the section stores.
 * @param value - the option the control reports.
 * @returns the fit the settings schema accepts.
 */
function narrowFit(value: string): 'cover' | 'contain' {
  return value === 'contain' ? 'contain' : 'cover'
}

/** A labelled range control. */
function Slider(props: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  display: string
  disabled: boolean
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <label className="dshsh-field">
      <span className="dshsh-fieldText">
        <span className="dshsh-label">{props.label}</span>
        {props.hint ? <span className="dshsh-hint">{props.hint}</span> : null}
      </span>
      <span className="dshsh-row" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <span className="dshsh-value">{props.display}</span>
        <input
          className="dshsh-range"
          type="range"
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          disabled={props.disabled}
          onChange={event => props.onChange(Number(event.target.value))}
        />
      </span>
    </label>
  )
}

/** A labelled select control. */
function Select(props: {
  label: string
  value: string
  options: { value: string; label: string }[]
  disabled: boolean
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <label className="dshsh-field">
      <span className="dshsh-fieldText">
        <span className="dshsh-label">{props.label}</span>
      </span>
      <select
        className="dshsh-select"
        value={props.value}
        disabled={props.disabled}
        onChange={event => props.onChange(event.target.value)}
      >
        {props.options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
