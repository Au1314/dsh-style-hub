/**
 * The wallpaper-engine glass wash: detection, and the write that clears it.
 *
 * The contract under test is the boundary the README used to only document —
 * a dark neighbour tint under an active light style is reported, everything
 * else (dark styles, clear glass, pastel tints, no document at all) is not —
 * and the fix writes one field through a read-merge-write, because that route
 * replaces the config file wholesale.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  glassWashes,
  glassWashesLightStyle,
  luminance,
  observeGlass,
  readGlassState,
  switchToWhiteGlass,
  WHITE_GLASS,
} from '../src/client/glass.ts'

/** The tint their deep-navy default carries, and the alpha it lands at. */
const NAVY = '#0d1524'
const DEFAULT_ALPHA = 0.206

/** A document-shaped state with the wash fully on. */
const WASHING = { windowGlass: true, tint: NAVY, alpha: DEFAULT_ALPHA }

test('luminance measures white at the top and black at the bottom', () => {
  assert.equal(luminance('#ffffff'), 1)
  assert.equal(luminance('#000000'), 0)
  assert.equal(luminance('#fff'), 1)
  assert.equal(luminance('not-a-colour'), -1)
})

test('their deep navy at the default alpha washes a light surface', () => {
  assert.equal(glassWashes(NAVY, DEFAULT_ALPHA), true)
  assert.equal(glassWashes('#000000', 0.25), true)
})

test('white, pastel, and clear glass do not wash', () => {
  assert.equal(glassWashes('#ffffff', 0.5), false)
  assert.equal(glassWashes('#DD8FAC', DEFAULT_ALPHA), false)
  // Their most transparent setting leaves almost any tint invisible.
  assert.equal(glassWashes(NAVY, 0.03), false)
})

test('an unparseable tint or alpha falls back without claiming a wash', () => {
  assert.equal(glassWashes('var(--fallback)', 0.5), false)
  assert.equal(glassWashes(NAVY, Number.NaN), true)
  assert.equal(glassWashes(NAVY, -1), false)
})

test('the wash is reported only with a light style, their master switch, and a tint', () => {
  assert.equal(glassWashesLightStyle(WASHING, true), true)
  assert.equal(glassWashesLightStyle(WASHING, false), false)
  assert.equal(glassWashesLightStyle({ ...WASHING, windowGlass: false }, true), false)
  assert.equal(glassWashesLightStyle({ windowGlass: true, tint: '', alpha: 0.5 }, true), false)
  assert.equal(glassWashesLightStyle(undefined, true), false)
})

test('without a document there is nothing to watch and nothing to read', () => {
  assert.equal(readGlassState(), undefined)
  assert.equal(observeGlass(() => {}), undefined)
})

test('the fix refuses a neighbour that has never saved settings', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ settings: null }), { status: 200 })
  try {
    await assert.rejects(() => switchToWhiteGlass(), /no saved settings/)
  } finally {
    globalThis.fetch = original
  }
})

test('the fix merges one field over the whole saved config', async () => {
  const original = globalThis.fetch
  const saved = { id: 'a'.repeat(32), glassColor: NAVY, glassAlpha: 40, blur: 24 }
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    calls.push([String(url), init.method ?? 'GET', init.body])
    if ((init.method ?? 'GET') === 'GET') {
      return new Response(JSON.stringify({ settings: saved }), { status: 200 })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  try {
    await switchToWhiteGlass()
  } finally {
    globalThis.fetch = original
  }
  assert.equal(calls.length, 2)
  assert.equal(calls[0][0], '/wallpaper-engine/settings')
  assert.equal(calls[1][1], 'PUT')
  const written = JSON.parse(calls[1][2])
  assert.equal(written.glassColor, WHITE_GLASS)
  // Everything else the neighbour owns survives the write untouched.
  assert.equal(written.id, saved.id)
  assert.equal(written.glassAlpha, 40)
  assert.equal(written.blur, 24)
})

test('the fix surfaces a failed read', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response('nope', { status: 503, statusText: 'Unavailable' })
  try {
    await assert.rejects(() => switchToWhiteGlass(), /503/)
  } finally {
    globalThis.fetch = original
  }
})
