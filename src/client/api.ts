/**
 * Browser side of the wallpaper library.
 *
 * Four calls, one per route. `fetch` sends `Origin` on its own and stays on
 * the same origin, which is exactly the discipline the Host checks, so no
 * header is set by hand. Every refusal arrives as a `{ error }` body and is
 * re-thrown with the Host's own wording — the message a user sees is the one
 * the server decided on, not a guess made here.
 */
import {
  ROUTE_PATH,
  type DeleteResponse,
  type ListResponse,
  type UploadResponse,
  type WallpaperInfo,
} from '../shared/wallpapers.ts'

/** URL of one stored wallpaper's bytes. */
export function wallpaperSrc(id: string): string {
  return `${ROUTE_PATH}/${id}`
}

/**
 * Turn a non-2xx answer into an error carrying the Host's message.
 * @param response - the failed response.
 * @returns an error naming the status and the Host's reason.
 */
async function failed(response: Response): Promise<never> {
  let detail = ''
  try {
    const body = (await response.json()) as { error?: string }
    detail = body.error ?? ''
  } catch {
    detail = ''
  }
  throw new Error(detail || `${response.status} ${response.statusText}`)
}

/** Read the whole catalogue. */
export async function listWallpapers(): Promise<WallpaperInfo[]> {
  const response = await fetch(ROUTE_PATH, { method: 'GET' })
  if (!response.ok) await failed(response)
  const body = (await response.json()) as ListResponse
  return body.wallpapers
}

/**
 * Store one image.
 * @param file - the picked image.
 * @returns the stored record.
 */
export async function uploadWallpaper(file: File): Promise<WallpaperInfo> {
  const query = new URLSearchParams({ name: file.name })
  const response = await fetch(`${ROUTE_PATH}?${query.toString()}`, {
    method: 'POST',
    body: file,
  })
  if (!response.ok) await failed(response)
  const body = (await response.json()) as UploadResponse
  return body.wallpaper
}

/**
 * Delete one image.
 * @param id - the wallpaper to remove.
 */
export async function deleteWallpaper(id: string): Promise<void> {
  const response = await fetch(wallpaperSrc(id), { method: 'DELETE' })
  if (!response.ok) await failed(response)
  await response.json().catch(() => undefined) as DeleteResponse | undefined
}
