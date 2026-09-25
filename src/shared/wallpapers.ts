/**
 * The wallpaper library's wire contract, shared by both halves.
 *
 * The Host implements it in `routes.ts`/`storage.ts` and the browser consumes
 * it in `client/api.ts`; naming it once is what keeps a route rename or a new
 * catalogue field from drifting between the two.
 */

/** Path prefix every wallpaper request shares. */
export const ROUTE_PATH = '/api/style-hub/wallpapers'

/** Ids the API accepts in a path segment: a bare 128-bit hex string. */
export const ID_PATTERN = /^[0-9a-f]{32}$/

/** Maximum accepted upload, in bytes. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/** One stored wallpaper as the API reports it. */
export interface WallpaperInfo {
  /** 32 lowercase hex chars; also the file stem. */
  id: string
  /** Original file name, display only. */
  name: string
  /** Byte size on disk. */
  size: number
  /** Stored extension (`jpg` | `png` | `webp`). */
  ext: string
  /** Sniffed image content type. */
  mime: string
  /** Epoch milliseconds of the upload. */
  addedAt: number
}

/** `GET /wallpapers` response. */
export interface ListResponse {
  wallpapers: WallpaperInfo[]
}

/** `POST /wallpapers` response. */
export interface UploadResponse {
  wallpaper: WallpaperInfo
}

/** `DELETE /wallpapers/:id` response. */
export interface DeleteResponse {
  removed: string
}
