/**
 * Host-side wallpaper storage: raw image bytes on disk plus a JSON catalogue.
 *
 * Bytes live on the Host (not the browser) so an upload survives a cleared
 * browser profile, a different browser, and a DSH restart — the boundary the
 * plugin's README promises. The catalogue is rewritten atomically (temp file
 * then rename) and every mutation runs on one serial chain, so a concurrent
 * upload and delete can never interleave a half-written index.
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ID_PATTERN, MAX_UPLOAD_BYTES, type WallpaperInfo } from './shared/wallpapers.ts'

export { ID_PATTERN, MAX_UPLOAD_BYTES, type WallpaperInfo } from './shared/wallpapers.ts'

/** Catalogue file shape. */
interface Catalogue {
  wallpapers: WallpaperInfo[]
}

/** Result of {@link ImageStore.upload}. */
export type UploadResult =
  | { ok: true; info: WallpaperInfo }
  | { ok: false; status: 400 | 413; error: string }

/** Accepted image kinds, keyed by sniffed magic bytes. */
const SIGNATURES: ReadonlyArray<{ mime: string; ext: string; test: (b: Buffer) => boolean }> = [
  { mime: 'image/jpeg', ext: 'jpg', test: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    ext: 'png',
    test: b => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: b =>
      b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
  },
]

/**
 * Identify an image by its magic bytes — the declared content type is never
 * trusted, so a text file renamed to `.png` is refused before it touches disk.
 * @param bytes - the complete upload.
 * @returns the sniffed kind, or undefined when nothing matches.
 */
export function sniffImage(bytes: Buffer): { mime: string; ext: string } | undefined {
  const hit = SIGNATURES.find(signature => signature.test(bytes))
  return hit && { mime: hit.mime, ext: hit.ext }
}

/**
 * Load a file name for display, trimmed and stripped of anything a header or
 * markup context could misread.
 * @param raw - the client-supplied name, possibly absent.
 * @param id - used when the supplied name is unusable.
 * @returns a safe display name.
 */
export function safeName(raw: string | undefined, id: string): string {
  const cleaned = (raw ?? '')
    .replace(/[\u0000-\u001f<>"]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 120)
  return cleaned || `wallpaper-${id}`
}

/**
 * The on-disk wallpaper library rooted at `dir`.
 *
 * Every public method serializes on one internal chain, so callers may fire
 * uploads and deletes without ordering them themselves.
 */
export class ImageStore {
  private readonly root: string
  private readonly images: string
  private readonly index: string
  private catalogue: Catalogue = { wallpapers: [] }
  private loaded = false
  private chain: Promise<unknown> = Promise.resolve()

  /** @param dir - absolute plugin data directory. */
  constructor(dir: string) {
    this.root = dir
    this.images = join(dir, 'wallpapers')
    this.index = join(dir, 'index.json')
  }

  /** Absolute directory this store owns (created on first mutation). */
  get directory(): string {
    return this.root
  }

  /** Run `task` after every previously scheduled task, swallowing failures into the chain. */
  private schedule<T>(task: () => Promise<T>): Promise<T> {
    const next = this.chain.then(task, task)
    this.chain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  /** Read the catalogue once; a missing or corrupt file starts empty. */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return
    try {
      const raw = await readFile(this.index, 'utf8')
      const parsed = JSON.parse(raw) as Partial<Catalogue>
      this.catalogue = {
        wallpapers: Array.isArray(parsed.wallpapers)
          ? parsed.wallpapers.filter(entry => entry && ID_PATTERN.test(entry.id))
          : [],
      }
    } catch {
      this.catalogue = { wallpapers: [] }
    }
    this.loaded = true
  }

  /** Persist the catalogue atomically. */
  private async persist(): Promise<void> {
    await mkdir(this.root, { recursive: true })
    const tmp = `${this.index}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(this.catalogue, null, 2), 'utf8')
    await rename(tmp, this.index)
  }

  /** Current catalogue, detached. */
  async list(): Promise<WallpaperInfo[]> {
    return this.schedule(async () => {
      await this.ensureLoaded()
      return this.catalogue.wallpapers.map(entry => ({ ...entry }))
    })
  }

  /** Look up one stored wallpaper. */
  async get(id: string): Promise<WallpaperInfo | undefined> {
    return this.schedule(async () => {
      await this.ensureLoaded()
      const found = this.catalogue.wallpapers.find(entry => entry.id === id)
      return found && { ...found }
    })
  }

  /**
   * Store one image and catalogue it.
   * @param bytes - the complete upload, already size-capped by the route.
   * @param name - client-supplied display name.
   * @returns the stored record, or a refusal the route turns into a status.
   */
  async upload(bytes: Buffer, name: string | undefined): Promise<UploadResult> {
    return this.schedule(async () => {
      if (bytes.length === 0) return { ok: false, status: 400 as const, error: 'empty upload' }
      if (bytes.length > MAX_UPLOAD_BYTES) {
        return { ok: false, status: 413 as const, error: 'image exceeds 15 MB' }
      }
      const kind = sniffImage(bytes)
      if (!kind) return { ok: false, status: 400 as const, error: 'unsupported image type' }

      await this.ensureLoaded()
      const id = randomUUID().replaceAll('-', '')
      const info: WallpaperInfo = {
        id,
        name: safeName(name, id),
        size: bytes.length,
        ext: kind.ext,
        mime: kind.mime,
        addedAt: Date.now(),
      }
      await mkdir(this.images, { recursive: true })
      await writeFile(join(this.images, `${id}.${kind.ext}`), bytes)
      this.catalogue.wallpapers.unshift(info)
      await this.persist()
      return { ok: true, info: { ...info } }
    })
  }

  /**
   * Remove one wallpaper's bytes and catalogue entry.
   * @param id - the wallpaper id.
   * @returns whether anything was removed.
   */
  async remove(id: string): Promise<boolean> {
    return this.schedule(async () => {
      await this.ensureLoaded()
      const before = this.catalogue.wallpapers.length
      const doomed = this.catalogue.wallpapers.filter(entry => entry.id === id)
      this.catalogue.wallpapers = this.catalogue.wallpapers.filter(entry => entry.id !== id)
      if (this.catalogue.wallpapers.length === before) return false
      for (const entry of doomed) await rm(join(this.images, `${entry.id}.${entry.ext}`), { force: true })
      await this.persist()
      return true
    })
  }

  /**
   * Read one wallpaper's bytes.
   * @param info - the catalogue record (its extension decides the path).
   * @returns the file contents.
   */
  async read(info: WallpaperInfo): Promise<Buffer> {
    return this.schedule(() => readFile(join(this.images, `${info.id}.${info.ext}`)))
  }
}
