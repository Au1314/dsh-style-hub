/**
 * Settings-contract tests: the shared section, the Host schema, and the boot
 * wallpaper rule that derives from it.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_SETTINGS, SETTINGS_NS, validateSettings } from '../src/shared/settings.ts'
import { bootWallpaperCss, StyleHubSchema } from '../src/index.ts'
import { WALLPAPER_SELECTOR } from '../src/shared/wallpaper-css.ts'

/** An id the storage layer would actually have issued. */
const ID = 'abc123abc123abc123abc123abc123ab'

test('the composition base satisfies every constraint the schema deliberately omits', () => {
  validateSettings(DEFAULT_SETTINGS)
})

test('the section is flat, so one gesture is one write', () => {
  for (const [field, value] of Object.entries(DEFAULT_SETTINGS)) {
    assert.notEqual(typeof value, 'object', `${field} must be a scalar for scope.set`)
  }
})

test('the card keys the namespace the Host registers', () => {
  assert.equal(SETTINGS_NS, 'style-hub')
})

test('out-of-range numbers are refused even though the schema allows them', () => {
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, panelOpacity: 0.5 }), RangeError)
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, wallpaperBlur: 51 }), RangeError)
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, wallpaperDim: -0.1 }), RangeError)
})

test('a malformed accent or wallpaper id is refused', () => {
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, accent: 'red' }), RangeError)
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, wallpaperId: '../../etc/passwd' }), RangeError)
})

test('the Host schema fills an untouched section with the composition base', () => {
  const resolved = StyleHubSchema({})
  assert.deepEqual({ ...resolved }, { ...DEFAULT_SETTINGS })
})

test('the Host schema still refuses a value outside its declared range', () => {
  assert.throws(() => StyleHubSchema({ panelOpacity: 0.5 }))
})

test('the boot rule paints nothing while the feature is off', () => {
  assert.equal(bootWallpaperCss({ ...DEFAULT_SETTINGS, wallpaperId: ID }), '')
})

test('the boot rule paints the layer while the feature is on', () => {
  const css = bootWallpaperCss({ ...DEFAULT_SETTINGS, enabled: true, wallpaperId: ID })
  assert.ok(css.includes(WALLPAPER_SELECTOR), 'addresses the namespaced plane')
  assert.ok(
    css.includes(`url("/api/style-hub/wallpapers/${ID}")`),
    'points at the stored bytes as an <image> — a bare string there is dropped by the browser',
  )
  assert.ok(!css.includes('html{'), 'leaves the canvas alone on the first paint')
})

test('the boot rule refuses an id the storage layer would not have issued', () => {
  assert.equal(bootWallpaperCss({ ...DEFAULT_SETTINGS, enabled: true, wallpaperId: 'nope' }), '')
})
