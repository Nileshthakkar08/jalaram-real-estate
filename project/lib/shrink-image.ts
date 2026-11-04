/**
 * Shrinks a photo in the browser before upload. Phones produce 12–50 megapixel photos; the server
 * only keeps 2000px anyway, so sending them full size wastes mobile data and server memory.
 * Drawing to a canvas also drops EXIF (including GPS); the server strips it again regardless.
 */

/** Must match PropertyImageService::MAX_EDGE. */
export const MAX_EDGE = 2000;

/** Target size for a photo, or null when it is already small enough. */
export function shrinkSize(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } | null {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return null;
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Returns a smaller JPEG/WebP copy, or the original file when shrinking is not possible or not needed. */
export async function shrinkImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bitmap: ImageBitmap;
  try {
    // Applies the camera's EXIF rotation, so the pixels come out upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  try {
    const target = shrinkSize(bitmap.width, bitmap.height);
    if (!target) return file;

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    // PNG photos become JPEG: far smaller, and listing photos have no transparency.
    const type = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + (type === 'image/webp' ? '.webp' : '.jpg');
    return new File([blob], name, { type, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
