/**
 * Boot-palette tests: the first frame the Host paints.
 *
 * The contract under test is that the injected row writes *exactly* what the
 * browser half will register a moment later — same derivation, same token
 * names, same palette attribute — because a boot layer that disagreed with the
 * presenter would be visible as a second flash rather than removing the first.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bootPalette, bootPaletteScript } from '../src/shared/boot-palette.ts'
import { findPreset, PRESETS } from '../src/shared/palettes.ts'
import { DEFAULT_SETTINGS, STOCK_THEME } from '../src/shared/settings.ts'
import { tokensFor } from '../src/shared/tokens.ts'

/** A stored id the storage layer would actually have issued. */
const WALLPAPER_ID = 'abc123abc123abc123abc123abc123ab'

/** The section as a card would leave it: feature on, Dracula selected. */
const DRACULA = { ...DEFAULT_SETTINGS, enabled: true, themeId: 'sh:dracula' }

/**
 * The document surface the row writes to: the presenter's own three writes.
 * @returns a stand-in with the property, attribute, and root colour-scheme sinks.
 */
function fakeDocument() {
  const properties = new Map()
  let attribute
  const body = {
    style: {
      setProperty(name, value) {
        properties.set(name, value)
      },
    },
    setAttribute(name, value) {
      attribute = [name, value]
    },
    removeAttribute(name) {
      if (attribute?.[0] === name) attribute = undefined
    },
  }
  const documentElement = { style: { colorScheme: '' } }
  return {
    body,
    documentElement,
    properties,
    get attribute() {
      return attribute
    },
  }
}

test('an untouched section paints no palette', () => {
  assert.equal(bootPaletteScript(DEFAULT_SETTINGS), '')
  assert.equal(bootPalette(DEFAULT_SETTINGS), undefined)
})

test('Stock selected hands the first frame back, even with the feature on', () => {
  const settings = { ...DRACULA, themeId: STOCK_THEME }
  assert.equal(bootPaletteScript(settings), '')
})

test('an id the catalogue does not carry paints nothing', () => {
  assert.equal(bootPaletteScript({ ...DRACULA, themeId: 'sh:does-not-exist' }), '')
})

test('the row is one document-safe script', () => {
  const text = bootPaletteScript(DRACULA)
  assert.ok(text.length > 1000, `expected a full directory, got ${text.length} chars`)
  assert.ok(!text.includes('<'), 'no markup terminator may survive into the payload')
  assert.ok(text.includes('data-ds-dark-theme'), 'names the palette attribute')
  assert.ok(text.includes('colorScheme'), 'settles the root colour scheme')
})

test('the derived palette is the one the browser half registers', () => {
  const boot = bootPalette(DRACULA)
  const preset = findPreset('sh:dracula')
  assert.ok(boot !== undefined && preset !== undefined)
  assert.equal(boot.scheme, preset.colorScheme)
  assert.deepEqual(boot.tokens, tokensFor(preset.palette, preset.colorScheme))
  assert.ok(Object.keys(boot.tokens).length > 80, 'a whole token directory, not a sample')
})

test('running the row paints the dark palette on the body', () => {
  const document = fakeDocument()
  new Function('document', bootPaletteScript(DRACULA))(document)
  assert.equal(document.properties.get('--dsw-alias-bg-base'), '#282a36')
  assert.equal(document.properties.get('--dsw-alias-label-primary'), '#f8f8f2')
  assert.deepEqual(document.attribute, ['data-ds-dark-theme', ''])
  assert.equal(document.documentElement.style.colorScheme, 'dark')
})

test('a light style drops the dark palette attribute it may have inherited', () => {
  const document = fakeDocument()
  document.body.setAttribute('data-ds-dark-theme', '')
  new Function('document', bootPaletteScript({ ...DRACULA, themeId: 'sh:github-light' }))(document)
  assert.equal(document.attribute, undefined)
  assert.equal(document.documentElement.style.colorScheme, 'light')
  assert.equal(document.properties.get('--dsw-alias-bg-base'), '#ffffff')
})

test('the accent tweak is already in force on the first frame', () => {
  const text = bootPaletteScript({ ...DRACULA, accent: '#ff0000' })
  assert.ok(text.includes('"--dsw-alias-brand-primary":"#ff0000"'), 'the brand follows the card')
  assert.ok(text.includes('"--dsw-alias-button-primary-fill":"#ff0000"'), 'so do the buttons')
})

test('panel translucency is already in force on the first frame', () => {
  const document = fakeDocument()
  new Function('document', bootPaletteScript({ ...DRACULA, panelOpacity: 0.9 }))(document)
  assert.equal(document.properties.get('--dsw-alias-bg-base'), 'rgba(40, 42, 54, 0.9)')
  // The toast floats over everything, so the slider leaves it solid.
  assert.match(document.properties.get('--dsw-alias-toast-bg'), /^#[0-9a-f]{6}$/i)
})

test('a wallpaper caps the canvas on the first frame so the picture shows through', () => {
  const document = fakeDocument()
  const settings = { ...DRACULA, panelOpacity: 0.9, wallpaperId: WALLPAPER_ID }
  new Function('document', bootPaletteScript(settings))(document)
  assert.equal(document.properties.get('--dsw-alias-bg-base'), 'rgba(40, 42, 54, 0.85)')
})

test('every bundled style can be painted on the first frame', () => {
  for (const preset of PRESETS) {
    const text = bootPaletteScript({ ...DRACULA, themeId: `sh:${preset.id}` })
    assert.ok(text.length > 1000, `${preset.id} produced no palette`)
    assert.ok(
      text.endsWith(`,${JSON.stringify(preset.colorScheme)},"data-ds-dark-theme")`),
      `${preset.id} scheme`,
    )
  }
})
