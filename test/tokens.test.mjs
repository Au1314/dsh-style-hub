/**
 * Token-derivation tests.
 *
 * The contract under test is the one a shipped style depends on: a preset must
 * define every semantic variable the design system's own stylesheet defines, or
 * the page falls back to whatever the stock palette left behind for the tokens
 * nobody remembered. The reference list is read out of the installed base
 * stylesheet rather than restated here, so the test tracks the design system
 * instead of a copy of it.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { DEFAULT_SETTINGS } from '../src/shared/settings.ts'
import { PRESETS, THEME_ID_PREFIX } from '../src/client/palettes.ts'
import { SURFACE_TOKENS, tokensFor } from '../src/client/tokens.ts'
import {
  buildTweakLayer,
  fingerprint,
  TWEAK_SOURCE,
  tweakSurfaces,
  WALLPAPER_CANVAS_ALPHA,
} from '../src/client/tweaks.ts'

const ROOT = process.cwd()

/** Every semantic variable the design system's base stylesheet defines. */
function requiredTokens() {
  const source = readFileSync(
    join(ROOT, 'node_modules', '@deepseek-ai', 'dsh-client-ui-theme', 'lib', 'client.js'),
    'utf8',
  )
  const match = /var design_platform_css_default = "([\s\S]*?)";\n/.exec(source)
  assert.ok(match, 'the installed base stylesheet should be readable')
  return [...new Set([...match[1].matchAll(/--dsw-(?:alias|specific)-[\w-]+/g)].map(hit => hit[0]))]
}

const REQUIRED = requiredTokens()

test('the reference list is a real directory, not an empty match', () => {
  assert.ok(REQUIRED.length > 80, `expected a full directory, got ${REQUIRED.length}`)
  assert.ok(REQUIRED.includes('--dsw-alias-bg-base'))
  assert.ok(REQUIRED.includes('--dsw-specific-menu'))
})

for (const preset of PRESETS) {
  test(`the ${preset.id} style defines every semantic token`, () => {
    const tokens = tokensFor(preset.palette, preset.colorScheme)
    const missing = REQUIRED.filter(name => typeof tokens[name] !== 'string' || tokens[name] === '')
    assert.deepEqual(missing, [], `missing tokens: ${missing.join(', ')}`)
  })
}

test('no style reaches into the shared static palette', () => {
  for (const preset of PRESETS) {
    const statics = Object.keys(tokensFor(preset.palette, preset.colorScheme)).filter(name =>
      name.startsWith('--dsw-static-'),
    )
    assert.deepEqual(statics, [], `${preset.id} overrides shared constants`)
  }
})

test('the surfaces a tweak reads are all tokens the system defines', () => {
  for (const name of Object.values(SURFACE_TOKENS)) {
    assert.ok(REQUIRED.includes(name), `${name} is not a design-system token`)
  }
})

test('the registered theme ids are namespaced away from everyone else', () => {
  assert.equal(THEME_ID_PREFIX, 'sh:')
  for (const preset of PRESETS) {
    assert.ok(`${THEME_ID_PREFIX}${preset.id}`.startsWith(THEME_ID_PREFIX))
  }
})

test('an untouched section applies no tweaks at all', () => {
  const tokens = tokensFor(PRESETS[0].palette, PRESETS[0].colorScheme)
  const layer = buildTweakLayer(DEFAULT_SETTINGS, tweakSurfaces(tokens, 'dark'))
  assert.deepEqual(layer, {})
})

test('a wallpaper caps the canvas so the picture is visible under the frame', () => {
  const tokens = tokensFor(PRESETS[0].palette, PRESETS[0].colorScheme)
  const settings = { ...DEFAULT_SETTINGS, enabled: true, wallpaperId: 'abc123' }
  const layer = buildTweakLayer(settings, tweakSurfaces(tokens, 'dark'))
  assert.equal(layer['--dsw-alias-bg-base'].dark, 'rgba(46, 52, 64, 0.85)')
  assert.equal(WALLPAPER_CANVAS_ALPHA, 0.85)
  assert.equal(
    layer['--dsw-alias-bg-base'].light,
    'rgba(255, 255, 255, 0.85)',
    'the scheme the preset does not build on keeps the stock canvas',
  )
})

test('panel opacity alone still leaves the canvas where the user put it', () => {
  const tokens = tokensFor(PRESETS[0].palette, PRESETS[0].colorScheme)
  const settings = { ...DEFAULT_SETTINGS, enabled: true, panelOpacity: 0.9 }
  const layer = buildTweakLayer(settings, tweakSurfaces(tokens, 'dark'))
  assert.equal(layer['--dsw-alias-bg-base'].dark, 'rgba(46, 52, 64, 0.9)')
})

test('the toast keeps its own fill: it floats over everything', () => {
  const tokens = tokensFor(PRESETS[0].palette, PRESETS[0].colorScheme)
  const settings = { ...DEFAULT_SETTINGS, enabled: true, panelOpacity: 0.9 }
  const layer = buildTweakLayer(settings, tweakSurfaces(tokens, 'dark'))
  assert.equal(layer[SURFACE_TOKENS.toast], undefined)
})

test('an accent rebids the brand tokens in both palette modes', () => {
  const tokens = tokensFor(PRESETS[0].palette, PRESETS[0].colorScheme)
  const settings = { ...DEFAULT_SETTINGS, enabled: true, accent: '#ff0000' }
  const layer = buildTweakLayer(settings, tweakSurfaces(tokens, 'dark'))
  assert.equal(layer['--dsw-alias-brand-primary'].dark, '#ff0000')
  assert.equal(layer['--dsw-alias-brand-primary'].light, '#ff0000')
  assert.equal(layer['--dsw-alias-button-primary-hover'].light, '#e00000')
  assert.equal(layer['--dsw-alias-button-primary-hover'].dark, '#ff1f1f')
})

test('a disabled section drops its accent even if one is stored', () => {
  const tokens = tokensFor(PRESETS[0].palette, PRESETS[0].colorScheme)
  const settings = { ...DEFAULT_SETTINGS, enabled: false, accent: '#ff0000', panelOpacity: 0.9 }
  assert.deepEqual(buildTweakLayer(settings, tweakSurfaces(tokens, 'dark')), {})
})

test('the other palette mode falls back to the stock directory', () => {
  const tokens = tokensFor(PRESETS[0].palette, PRESETS[0].colorScheme)
  const surfaces = tweakSurfaces(tokens, 'dark')
  assert.equal(surfaces.dark[SURFACE_TOKENS.base], '#2e3440')
  assert.equal(surfaces.light[SURFACE_TOKENS.base], '#ffffff')
})

test('a fingerprint ignores insertion order but not content', () => {
  const one = { a: { light: 'x', dark: 'y' }, b: { light: 'p', dark: 'q' } }
  const two = { b: { light: 'p', dark: 'q' }, a: { light: 'x', dark: 'y' } }
  const three = { a: { light: 'x', dark: 'z' }, b: { light: 'p', dark: 'q' } }
  assert.equal(fingerprint(one), fingerprint(two))
  assert.notEqual(fingerprint(one), fingerprint(three))
  assert.notEqual(fingerprint({}), fingerprint(one))
})

test('the override layer is claimed by a stable source name', () => {
  assert.equal(TWEAK_SOURCE, 'dsh-style-hub:tweaks')
})
