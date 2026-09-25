/**
 * The plugin's same-origin HTTP surface over `ctx.webServer`.
 *
 * One prefix route under `/api/style-hub/wallpapers` owns the whole library —
 * list, upload, serve one image, delete one — and dispatches on the sub-path
 * itself, because the carrier's contract names a route by a pathname with no
 * trailing slash. Every branch answers for itself (status, content type,
 * cache policy); the carrier adds only gzip.
 *
 * Origin discipline: the Web composition binds loopback, but a page on the
 * same machine can still address `127.0.0.1` from another origin, so a
 * state-changing request carries `Origin` and it must match the Host header.
 * A request declaring neither `Origin` nor `Referer` is a non-browser client
 * and is refused only when it would mutate.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { URLSearchParams } from 'node:url'
import { ROUTE_PATH } from './shared/wallpapers.ts'
import { ID_PATTERN, MAX_UPLOAD_BYTES, type ImageStore, type UploadResult } from './storage.ts'

export { ROUTE_PATH } from './shared/wallpapers.ts'

/** One named route registration for `ctx.webServer.register`. */
export interface RouteSpec {
  kind: 'prefix'
  /** Absolute pathname, no trailing slash (the carrier's rule). */
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
}

/** JSON response helper. */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  })
  res.end(text)
}

/** Error response helper. */
function sendError(res: ServerResponse, status: number, error: string): void {
  sendJson(res, status, { error })
}

/**
 * Whether the request provably comes from our own origin.
 * @param req - the inbound request.
 * @param mutating - whether the branch changes state.
 * @returns false only when a browser-declared origin is foreign, or a
 * mutating request declares no origin at all.
 */
export function sameOrigin(req: IncomingMessage, mutating: boolean): boolean {
  const host = req.headers.host
  const origin = req.headers.origin
  if (origin !== undefined) {
    if (origin === 'null') return false
    try {
      return host !== undefined && new URL(origin).host === host
    } catch {
      return false
    }
  }
  const referer = req.headers.referer
  if (referer !== undefined) {
    try {
      return host !== undefined && new URL(referer).host === host
    } catch {
      return false
    }
  }
  return !mutating
}

/**
 * Collect a request body under a byte ceiling. The cap is enforced while
 * reading, so an oversized upload is refused without buffering past it.
 * @param req - the inbound request.
 * @returns the bytes, or a refusal the route turns into a status.
 */
export async function readBody(req: IncomingMessage): Promise<Buffer | { error: string; status: 413 }> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    size += part.length
    if (size > MAX_UPLOAD_BYTES) {
      req.destroy()
      return { status: 413, error: 'image exceeds 15 MB' }
    }
    chunks.push(part)
  }
  return Buffer.concat(chunks, size)
}

/**
 * Split the sub-path under {@link ROUTE_PATH}.
 * @param url - the request target, query included.
 * @returns '' for the library itself, otherwise the sub-path.
 */
export function subPath(url: string): string {
  const path = url.split('?', 1)[0] ?? ''
  const rest = path.startsWith(ROUTE_PATH) ? path.slice(ROUTE_PATH.length) : path
  return rest.startsWith('/') ? rest.slice(1) : rest
}

/** Send a storage refusal with its own status. */
function sendUploadRefusal(res: ServerResponse, result: Extract<UploadResult, { ok: false }>): void {
  sendError(res, result.status, result.error)
}

/** `GET /wallpapers` — the catalogue. */
async function listWallpapers(store: ImageStore, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!sameOrigin(req, false)) return sendError(res, 403, 'forbidden origin')
  sendJson(res, 200, { wallpapers: await store.list() })
}

/** `POST /wallpapers` — one image in. */
async function uploadWallpaper(store: ImageStore, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!sameOrigin(req, true)) return sendError(res, 403, 'forbidden origin')
  const body = await readBody(req)
  if (!Buffer.isBuffer(body)) return sendError(res, body.status, body.error)
  const query = new URLSearchParams((req.url ?? '').split('?')[1] ?? '')
  const result = await store.upload(body, query.get('name') ?? undefined)
  if (!result.ok) return sendUploadRefusal(res, result)
  sendJson(res, 201, { wallpaper: result.info })
}

/** `GET /wallpapers/:id` — the image bytes. */
async function serveWallpaper(store: ImageStore, id: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!sameOrigin(req, false)) return sendError(res, 403, 'forbidden origin')
  const info = await store.get(id)
  if (!info) return sendError(res, 404, 'not found')
  let bytes: Buffer
  try {
    bytes = await store.read(info)
  } catch {
    return sendError(res, 404, 'not found')
  }
  res.writeHead(200, {
    'content-type': info.mime,
    'content-length': bytes.length,
    // The URL embeds the id and those bytes never change under it, so the
    // browser may keep a wallpaper for a full day.
    'cache-control': 'public, max-age=86400, immutable',
  })
  res.end(bytes)
}

/** `DELETE /wallpapers/:id` — one image out. */
async function deleteWallpaper(store: ImageStore, id: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!sameOrigin(req, true)) return sendError(res, 403, 'forbidden origin')
  const removed = await store.remove(id)
  sendJson(res, removed ? 200 : 404, removed ? { removed: id } : { error: 'not found' })
}

/** Method not allowed on this branch. */
function methodNotAllowed(res: ServerResponse, allow: string): void {
  res.writeHead(405, { allow })
  res.end()
}

/**
 * Build the wallpaper route over one store.
 * @param store - the Host-side image library.
 * @returns the single route spec to register on `ctx.webServer`.
 */
export function createRoute(store: ImageStore): RouteSpec {
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const rest = subPath(req.url ?? '')
    if (rest === '') {
      if (req.method === 'GET') return listWallpapers(store, req, res)
      if (req.method === 'POST') return uploadWallpaper(store, req, res)
      return methodNotAllowed(res, 'GET, POST')
    }
    if (!ID_PATTERN.test(rest)) return sendError(res, 400, 'bad wallpaper id')
    if (req.method === 'GET') return serveWallpaper(store, rest, req, res)
    if (req.method === 'DELETE') return deleteWallpaper(store, rest, req, res)
    return methodNotAllowed(res, 'GET, DELETE')
  }
  return { kind: 'prefix', path: ROUTE_PATH, handler }
}
