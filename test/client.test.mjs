/**
 * Browser-half composition test.
 *
 * The bundle is materialized exactly the way the composition's module loader
 * materializes it — `window.__ModuleLoader__.load({ id, factory })` — and then
 * driven against a stand-in for the cordis context. What is asserted is the
 * plugin's own registration and reconciliation behaviour: which styles it
 * claims, which preference it hands back when the feature is switched off, and
 * which DOM it owns. Nothing here re-implements the plugin.
 */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { DEFAULT_SETTINGS } from '../src/shared/settings.ts'

const BUNDLE = resolve(process.cwd(), 'lib', 'client.js')

/** The plugin's own values, asserted rather than assumed. */
const NS = 'style-hub'
const LOCALE = 'settings.style-hub'

/** A tiny document: enough surface for the stylesheet and the wallpaper plane. */
function fakeDocument() {
  const elements = []
  const document = {
    head: { append: element => void elements.push(element) },
    body: { append: element => void elements.push(element) },
    createElement(tag) {
      return {
        tagName: tag,
        id: '',
        textContent: '',
        removed: false,
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = value
        },
        remove() {
          this.removed = true
        },
      }
    },
    getElementById(id) {
      return elements.find(element => !element.removed && element.id === id) ?? null
    },
    querySelector(selector) {
      const attribute = /\[([\w-]+)\]/.exec(selector)?.[1]
      if (!attribute) return null
      return elements.find(element => !element.removed && attribute in element.attributes) ?? null
    },
  }
  return document
}

/** A wallpaper service that remembers what was uploaded this session. */
function fakeServer() {
  const wallpapers = []
  const json = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  return async (_url, init = {}) => {
    const method = init.method ?? 'GET'
    if (method === 'POST') {
      const wallpaper = {
        id: 'a'.repeat(32),
        name: 'picture.png',
        size: 4,
        ext: 'png',
        mime: 'image/png',
        addedAt: 0,
      }
      wallpapers.push(wallpaper)
      return json(201, { wallpaper })
    }
    if (method === 'DELETE') {
      const id = String(_url).split('/').pop()
      for (let at = wallpapers.length - 1; at >= 0; at -= 1) {
        if (wallpapers[at].id === id) wallpapers.splice(at, 1)
      }
      return json(200, { removed: id })
    }
    return json(200, { wallpapers: wallpapers.map(entry => ({ ...entry })) })
  }
}

/** Load the bundle once, the way the loader would. */
let loaderSpec
globalThis.window = { __ModuleLoader__: { load: spec => void (loaderSpec = spec) } }
globalThis.document = fakeDocument()
globalThis.fetch = fakeServer()
await import(pathToFileURL(BUNDLE).href)

/** Modules the composition supplies to the factory. */
const provided = {
  react: {
    useRef: initial => ({ current: initial }),
    useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
  },
  'react/jsx-runtime': { jsx: () => null, jsxs: () => null, Fragment: Symbol('Fragment') },
}

/**
 * Build a stand-in context and run the plugin body against it.
 * @param status - the settings scope's sync status at boot.
 * @param section - the section, once the scope reports one.
 * @returns the loaded module, the context state, and the injected face.
 */
function boot(status = 'loading', section = {}) {
  // Each case gets its own document and its own library: a stylesheet, a
  // wallpaper plane, or an uploaded picture left behind by the previous case
  // would otherwise be read as this one's own doing.
  globalThis.document = fakeDocument()
  globalThis.fetch = fakeServer()

  const listeners = new Set()
  const themeListeners = new Set()
  const scopeListeners = new Set()

  const state = {
    status,
    section: { ...DEFAULT_SETTINGS, ...section },
    preference: 'system',
    registered: [],
    overrides: new Map(),
    locales: [],
    slots: [],
    injected: [],
    effects: [],
    cleaned: [],
  }

  const active = () => {
    const resolved = state.preference === 'system' ? 'light' : state.preference
    return (
      state.registered.find(definition => definition.id === resolved) ?? state.registered[0] ?? { id: 'light', colorScheme: 'light', tokens: {} }
    )
  }

  const snapshot = () => ({
    preference: state.preference,
    fontSize: 14,
    active: active(),
    themes: state.registered.map(definition => ({ ...definition })),
    revision: 0,
  })

  const emitTheme = () => {
    for (const listener of [...themeListeners]) listener(snapshot())
  }

  const notifyScope = () => {
    for (const listener of [...scopeListeners]) listener()
  }

  const scope = {
    getSnapshot: () => ({
      status: state.status,
      value: state.status === 'ready' ? state.section : undefined,
      base: undefined,
      user: undefined,
      revision: 0,
      writable: true,
      mode: 'host',
    }),
    subscribe(listener) {
      scopeListeners.add(listener)
      return () => scopeListeners.delete(listener)
    },
    set(field, value) {
      state.section = { ...state.section, [field]: value }
      notifyScope()
      return Promise.resolve()
    },
    unset(field) {
      delete state.section[field]
      notifyScope()
      return Promise.resolve()
    },
    mutate() {
      return Promise.resolve()
    },
  }

  const ctx = {
    settingsScope: { bind: () => scope },
    theme: {
      getTheme: snapshot,
      register(definition) {
        state.registered.push(definition)
        return () => {
          const at = state.registered.findIndex(entry => entry.id === definition.id)
          if (at >= 0) state.registered.splice(at, 1)
        }
      },
      setTheme(id) {
        if (id !== 'system' && !state.registered.some(definition => definition.id === id)) {
          throw new Error(`theme "${id}" is not registered`)
        }
        if (state.preference === id) return
        state.preference = id
        emitTheme()
      },
      overrideTokens(source, tokens) {
        state.overrides.set(source, tokens)
        emitTheme()
        return () => {
          if (state.overrides.get(source) === tokens) state.overrides.delete(source)
        }
      },
    },
    locale: {
      register(ns, dicts) {
        state.locales.push({ ns, dicts })
        return () => {}
      },
    },
    slots: {
      inject(key, callback) {
        const release = callback()
        state.injected.push({ key, release })
        return release
      },
      register(options, component) {
        state.slots.push({ options, component })
        return () => {}
      },
    },
    effect(execute) {
      const release = execute()
      if (typeof release === 'function') state.effects.push(release)
      return release
    },
    on(name, listener) {
      if (name === 'theme/change') themeListeners.add(listener)
      listeners.add(listener)
      return () => {
        themeListeners.delete(listener)
        listeners.delete(listener)
      }
    },
  }

  assert.ok(loaderSpec, 'the bundle should have reached the module loader')
  assert.equal(typeof provided['react/jsx-runtime'].jsx, 'function')
  const module = loaderSpec.factory(name => {
    if (!(name in provided)) throw new Error(`the composition must provide ${name}`)
    return provided[name]
  })

  module.apply(ctx)

  const entry = state.slots[0]
  const face = entry.options.inject()

  /** Put the scope into `ready` with one section and settle the async reads. */
  const settle = async sectionOverride => {
    state.status = 'ready'
    if (sectionOverride) state.section = { ...state.section, ...sectionOverride }
    notifyScope()
    await new Promise(resolve => setImmediate(resolve))
  }

  return { module, ctx, state, face, settle }
}

/** Wait for the wallpaper library read kicked off at boot to settle. */
async function flush() {
  await new Promise(resolve => setImmediate(resolve))
}

test('the body declares every service it reaches for', () => {
  const { module } = boot()
  for (const name of ['slots', 'locale', 'remote', 'settingsScope', 'theme']) {
    assert.ok(module.inject.includes(name), `missing ${name}`)
  }
})

test('every bundled style is registered under the plugin namespace', () => {
  const { state, module } = boot()
  assert.equal(state.registered.length, 8)
  const ids = state.registered.map(definition => definition.id)
  assert.deepEqual(ids, [
    'sh:nord',
    'sh:dracula',
    'sh:mocha',
    'sh:tokyo-night',
    'sh:gruvbox-dark',
    'sh:solarized-light',
    'sh:github-light',
    'sh:latte',
  ])
  for (const definition of state.registered) {
    assert.ok(definition.id.startsWith('sh:'))
    assert.ok(
      typeof definition.tokens['--dsw-alias-bg-base'] === 'string',
      `${definition.id} should carry a full token directory`,
    )
    assert.ok(['light', 'dark'].includes(definition.colorScheme))
  }
  assert.equal(typeof module.apply, 'function')
})

test('the dictionaries are registered under the namespace the card declares', () => {
  const { state } = boot()
  assert.equal(state.locales.length, 1)
  assert.equal(state.locales[0].ns, LOCALE)
  assert.equal(state.locales[0].dicts.zh['card.title'], '风格中心')
  assert.equal(state.locales[0].dicts.en['card.title'], 'Style Hub')
  assert.deepEqual(
    Object.keys(state.locales[0].dicts.zh).sort(),
    Object.keys(state.locales[0].dicts.en).sort(),
    'both shipped locales carry the same key set',
  )
})

test('the card claims the settings namespace the Host registers', () => {
  const { state } = boot()
  assert.equal(state.injected.length, 1)
  assert.equal(state.injected[0].key, 'settings.plugin.item')
  const { options, component } = state.slots[0]
  assert.equal(options.name, 'settings.plugin.item')
  assert.equal(options.key, NS)
  assert.equal(options.locale, LOCALE)
  assert.equal(typeof component, 'function')
})

test('nothing is applied until the Host answers with a section', async () => {
  const { state, settle, face } = boot()
  await flush()
  assert.equal(state.preference, 'system', 'the preference stays untouched while loading')
  assert.equal(document.querySelector('[data-ds-style-hub-wallpaper]'), null)
  assert.equal(face.snapshot().status, 'loading')
  await settle()
  assert.equal(face.snapshot().status, 'ready')
  assert.equal(state.preference, 'system', 'an untouched section selects nothing')
})

test('enabling a style selects it, and switching back off restores the stock preference', async () => {
  const { state, settle, face } = boot()
  await settle()

  face.patch({ enabled: true, themeId: 'sh:nord' })
  await flush()
  assert.equal(state.preference, 'sh:nord')

  face.patch({ enabled: false })
  await flush()
  assert.equal(state.preference, 'system')
})

test('the stock option selects nothing at all', async () => {
  const { state, settle, face } = boot()
  await settle({ themeId: 'sh:nord' })
  face.patch({ enabled: true, themeId: 'sh:nord' })
  await flush()
  assert.equal(state.preference, 'sh:nord')

  face.patch({ themeId: 'stock' })
  await flush()
  assert.equal(state.preference, 'system', 'hands the preference back rather than pinning one')
})

test('a style id nothing registered refuses to be selected', async () => {
  const { state, settle, face } = boot()
  await settle({ enabled: true, themeId: 'sh:does-not-exist' })
  await flush()
  assert.equal(state.preference, 'system')
  assert.ok(state.registered.some(definition => definition.id === 'sh:nord'))
})

test('a bare preset id in the section still selects the registered style', async () => {
  const { state, settle } = boot()
  await settle({ enabled: true, themeId: 'nord' })
  await flush()
  assert.equal(state.preference, 'sh:nord', 'the section may hold either form of the id')
})

test('the wallpaper plane appears with the section and leaves with it', async () => {
  const { settle, face } = boot()
  await settle({ enabled: true, wallpaperId: 'b'.repeat(32), wallpaperBlur: 8 })
  await flush()
  const plane = document.querySelector('[data-ds-style-hub-wallpaper]')
  assert.ok(plane, 'the namespaced plane should exist')
  const style = document.getElementById('dsh-style-hub-wallpaper')
  assert.ok(style, 'the live rule should be installed')
  assert.ok(style.textContent.includes('filter:blur(8px)'), 'the rule carries the current parameters')
  assert.ok(
    style.textContent.includes('url("/api/style-hub/wallpapers/'),
    'the reference is an <image>, which a bare string is not',
  )
  assert.ok(style.textContent.includes('/b'.padEnd(33, 'b').slice(0, 32)), 'the rule points at the stored bytes')

  face.patch({ wallpaperId: '' })
  await flush()
  assert.equal(document.getElementById('dsh-style-hub-wallpaper'), null, 'rule removed')
  assert.equal(document.querySelector('[data-ds-style-hub-wallpaper]'), null, 'plane removed')
})

test('panel opacity drives the override layer and releasing it takes it away', async () => {
  const { state, settle, face } = boot()
  await settle()
  assert.equal(state.overrides.size, 0)

  face.patch({ enabled: true, panelOpacity: 0.9 })
  await flush()
  assert.equal(state.overrides.get('dsh-style-hub:tweaks')['--dsw-alias-bg-base'].light, 'rgba(255, 255, 255, 0.9)')

  face.patch({ panelOpacity: 1 })
  await flush()
  assert.equal(state.overrides.size, 0, 'a layer that contributes nothing should not exist')

  face.patch({ enabled: false })
  await flush()
  assert.equal(state.overrides.size, 0)
})

test('an uploaded wallpaper is stored, listed, and put to use', async () => {
  const { state, settle, face } = boot()
  await settle()
  await face.upload(new File([new Uint8Array([1, 2, 3, 4])], 'picture.png', { type: 'image/png' }))
  assert.equal(state.section.wallpaperId, 'a'.repeat(32))
  assert.equal(state.section.enabled, true, 'uploading is a request to see the picture')
  assert.equal(face.snapshot().wallpapers.length, 1)
  assert.equal(face.snapshot().error, undefined)
})

test('an over-large image is refused without crossing the wire', async () => {
  const { face, settle } = boot()
  await settle()
  await face.upload(new File([new Uint8Array(0)], 'huge.png', { type: 'image/png' }).slice(0, 0))
  // An empty file is a valid (tiny) upload; the size guard is what is under
  // test, so drive it with an object that reports the size directly.
  const oversized = { name: 'huge.png', size: 16 * 1024 * 1024, type: 'image/png' }
  await face.upload(oversized)
  assert.equal(face.snapshot().error, '@wallpaper.tooLarge')
})

test('deleting a wallpaper clears the selection that pointed at it', async () => {
  const { face, settle, state } = boot()
  await settle()
  await face.upload(new File([new Uint8Array([1])], 'picture.png', { type: 'image/png' }))
  assert.equal(state.section.wallpaperId, 'a'.repeat(32))

  await face.removeWallpaper('a'.repeat(32))
  assert.equal(state.section.wallpaperId, '')
  assert.equal(face.snapshot().wallpapers.length, 0)
})

test('teardown releases the override layer and the wallpaper it painted', async () => {
  const { state, settle, face } = boot()
  await settle({ enabled: true, wallpaperId: 'c'.repeat(32), panelOpacity: 0.9 })
  await flush()
  assert.equal(state.overrides.size, 1)
  assert.ok(document.querySelector('[data-ds-style-hub-wallpaper]'))

  for (const release of [...state.effects].reverse()) release()
  assert.equal(state.overrides.size, 0, 'the layer must not outlive the plugin')
  assert.equal(document.querySelector('[data-ds-style-hub-wallpaper]'), null)
  assert.equal(document.getElementById('dsh-style-hub-card'), null, 'the stylesheet is ours to remove')
  assert.equal(face.snapshot().status, 'ready')
})
