/**
 * Storage tests: what the Host accepts, what it names, and what survives a
 * round trip through the catalogue.
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { ID_PATTERN, ImageStore, MAX_UPLOAD_BYTES, safeName, sniffImage } from '../src/storage.ts'

/** A minimal file that sniffs as PNG. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

/** A minimal file that sniffs as JPEG. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])

/** A minimal file that sniffs as WebP. */
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(1)])

/** Declared image type is not evidence: this is plain text. */
const TEXT = Buffer.from('<script>alert(1)</script>')

let root
let store

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-style-hub-'))
  store = new ImageStore(root)
})

after(async () => {
  await rm(root, { recursive: true, force: true })
})

test('magic bytes decide the type, not the file name', () => {
  assert.deepEqual(sniffImage(PNG), { mime: 'image/png', ext: 'png' })
  assert.deepEqual(sniffImage(JPEG), { mime: 'image/jpeg', ext: 'jpg' })
  assert.deepEqual(sniffImage(WEBP), { mime: 'image/webp', ext: 'webp' })
  assert.equal(sniffImage(TEXT), undefined)
})

test('a text file renamed to .png never reaches the catalogue', async () => {
  const result = await store.upload(TEXT, 'wallpaper.png')
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.deepEqual(await store.list(), [])
})

test('an empty upload is refused before it is typed', async () => {
  const result = await store.upload(Buffer.alloc(0), 'nothing')
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
})

test('an upload over the ceiling is refused with 413', async () => {
  const result = await store.upload(Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0xff), 'huge')
  assert.equal(result.ok, false)
  assert.equal(result.status, 413)
})

test('an image round-trips through bytes, catalogue, and removal', async () => {
  const uploaded = await store.upload(PNG, 'my picture.png')
  assert.equal(uploaded.ok, true)
  assert.equal(uploaded.info.mime, 'image/png')
  assert.equal(uploaded.info.name, 'my picture.png')
  assert.match(uploaded.info.id, ID_PATTERN)

  const listed = await store.list()
  assert.equal(listed.length, 1)
  assert.deepEqual(await store.get(uploaded.info.id), uploaded.info)
  assert.deepEqual(await store.read(uploaded.info), PNG)

  assert.equal(await store.remove(uploaded.info.id), true)
  assert.equal(await store.get(uploaded.info.id), undefined)
  assert.equal(await store.remove(uploaded.info.id), false)
  assert.deepEqual(await store.list(), [])
})

test('the catalogue survives a second store over the same directory', async () => {
  const uploaded = await store.upload(JPEG, 'persisted')
  assert.equal(uploaded.ok, true)
  const reopened = new ImageStore(root)
  const listed = await reopened.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0].id, uploaded.info.id)
  await reopened.remove(uploaded.info.id)
})

test('display names are trimmed of anything a header could misread', () => {
  assert.equal(safeName('<b>"x"</b>', 'id'), 'bx_b')
  assert.equal(safeName('   ', 'id'), 'wallpaper-id')
  assert.equal(safeName(undefined, 'id'), 'wallpaper-id')
  assert.equal(safeName('a/b\\c', 'id'), 'a_b_c')
  assert.equal(safeName('x'.repeat(500), 'id').length, 120)
})

test('wallpaper ids are hex only, so no path escapes one', () => {
  assert.ok(ID_PATTERN.test('abc123abc123abc123abc123abc123ab'))
  assert.ok(!ID_PATTERN.test('abc123'), 'ids are a full 128-bit address')
  assert.ok(!ID_PATTERN.test('../abc123abc123abc123abc123abc12'))
  assert.ok(!ID_PATTERN.test('../abc'))
  assert.ok(!ID_PATTERN.test('abc/def'))
  assert.ok(!ID_PATTERN.test(''))
})
