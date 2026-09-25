/**
 * Route tests: one prefix route, dispatching on its own sub-path, refusing
 * anything that would let another page write into this one's library.
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { after, before, test } from 'node:test'
import { createRoute, sameOrigin, subPath } from '../src/routes.ts'
import { ROUTE_PATH, MAX_UPLOAD_BYTES } from '../src/shared/wallpapers.ts'
import { ImageStore } from '../src/storage.ts'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const HOST = '127.0.0.1:26000'
/** A well-formed id for a wallpaper that does not exist. */
const MISSING = 'abcdef0123456789abcdef0123456789'

let root
let store
let route

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-style-hub-route-'))
  store = new ImageStore(root)
  route = createRoute(store)
})

after(async () => {
  await rm(root, { recursive: true, force: true })
})

/** A request the handler can read a body from. */
function request({ method = 'GET', url = ROUTE_PATH, headers = {}, body = Buffer.alloc(0) } = {}) {
  const req = Readable.from([body])
  req.method = method
  req.url = url
  req.headers = { host: HOST, ...headers }
  return req
}

/** A response that records what it was asked to send. */
function response() {
  const res = {
    status: undefined,
    headers: undefined,
    body: undefined,
    ended: false,
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
      return this
    },
    end(chunk) {
      if (chunk !== undefined) this.body = chunk
      this.ended = true
      return this
    },
  }
  return res
}

async function call(options) {
  const res = response()
  await route.handler(request(options), res)
  return res
}

function json(res) {
  return JSON.parse(res.body.toString('utf8'))
}

test('the route is one prefix registration with the canonical path', () => {
  assert.equal(route.kind, 'prefix')
  assert.equal(route.path, ROUTE_PATH)
  assert.ok(!route.path.endsWith('/'), 'the carrier rejects a trailing slash')
})

test('the sub-path split keeps the library itself distinguishable from an id', () => {
  assert.equal(subPath(ROUTE_PATH), '')
  assert.equal(subPath(`${ROUTE_PATH}?x=1`), '')
  assert.equal(subPath(`${ROUTE_PATH}/deadbeef`), 'deadbeef')
  assert.equal(subPath('/elsewhere'), 'elsewhere')
})

test('a same-host origin is accepted and a foreign one is not', () => {
  assert.equal(sameOrigin(request({ headers: { origin: `http://${HOST}` } }), true), true)
  assert.equal(sameOrigin(request({ headers: { origin: 'http://evil.test' } }), true), false)
  assert.equal(sameOrigin(request({ headers: { origin: 'null' } }), true), false)
  assert.equal(sameOrigin(request({ headers: { referer: `http://${HOST}/x` } }), true), true)
})

test('a non-browser client may read but not write', () => {
  assert.equal(sameOrigin(request(), false), true)
  assert.equal(sameOrigin(request(), true), false)
})

test('the catalogue answers without an origin at all', async () => {
  const res = await call({ method: 'GET' })
  assert.equal(res.status, 200)
  assert.deepEqual(json(res), { wallpapers: [] })
})

test('an upload from another origin is refused before its body is read', async () => {
  const res = await call({ method: 'POST', headers: { origin: 'http://evil.test' }, body: PNG })
  assert.equal(res.status, 403)
  assert.equal((await store.list()).length, 0)
})

test('an upload with no origin at all is refused', async () => {
  const res = await call({ method: 'POST', body: PNG })
  assert.equal(res.status, 403)
})

test('a valid upload answers 201 and is then servable and deletable', async () => {
  const headers = { origin: `http://${HOST}` }
  const uploaded = await call({ method: 'POST', headers, url: `${ROUTE_PATH}?name=picture.png`, body: PNG })
  assert.equal(uploaded.status, 201)
  const { wallpaper } = json(uploaded)
  assert.equal(wallpaper.mime, 'image/png')

  const served = await call({ method: 'GET', url: `${ROUTE_PATH}/${wallpaper.id}` })
  assert.equal(served.status, 200)
  assert.equal(served.headers['content-type'], 'image/png')
  assert.deepEqual(served.body, PNG)

  const removed = await call({ method: 'DELETE', headers, url: `${ROUTE_PATH}/${wallpaper.id}` })
  assert.equal(removed.status, 200)
  assert.equal((await store.list()).length, 0)
})

test('an unknown id and an unusable id answer differently', async () => {
  assert.equal((await call({ method: 'GET', url: `${ROUTE_PATH}/${MISSING}` })).status, 404)
  assert.equal((await call({ method: 'GET', url: `${ROUTE_PATH}/%2e%2e%2f` })).status, 400)
  assert.equal((await call({ method: 'GET', url: `${ROUTE_PATH}/../../etc/passwd` })).status, 400)
})

test('a method the branch does not own is answered with its allow list', async () => {
  const listed = await call({ method: 'DELETE' })
  assert.equal(listed.status, 405)
  assert.equal(listed.headers.allow, 'GET, POST')

  const served = await call({ method: 'POST', url: `${ROUTE_PATH}/${MISSING}` })
  assert.equal(served.status, 405)
  assert.equal(served.headers.allow, 'GET, DELETE')
})

test('an upload over the ceiling is refused with 413', async () => {
  const headers = { origin: `http://${HOST}` }
  const res = await call({
    method: 'POST',
    headers,
    url: `${ROUTE_PATH}?name=huge.png`,
    body: Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0xff),
  })
  assert.equal(res.status, 413)
  assert.equal((await store.list()).length, 0)
})
