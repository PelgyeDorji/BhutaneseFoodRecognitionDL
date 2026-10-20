export const MAX_UPLOAD_MB = 5
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIDE = 1600

export const ACCEPT_ATTR = ACCEPTED.join(',')

export class PhotoProblem extends Error {}

/**
 * Check a chosen photo and shrink it to at most 1600px on its longest side, so
 * a 12-megapixel phone photo uploads in a moment and stays under the size cap.
 * The server checks everything again; this is for speed and a clear message.
 */
export async function preparePhoto(file: Blob): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) {
    throw new PhotoProblem('Choose a JPEG, PNG or WebP photo. (iPhone HEIC photos: share them as JPEG first.)')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoProblem("That photo couldn't be opened. Try another one.")
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= MAX_UPLOAD_MB * 1024 * 1024) {
    bitmap.close()
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) throw new PhotoProblem("That photo couldn't be prepared. Try another one.")
  return blob
}
