const MAX_DIMENSION = 512;
const WEBP_QUALITY = 0.8;
const ACCEPTED = /^image\/(png|jpe?g|webp)$/i;

export function isAcceptedImage(file) {
  return Boolean(file && ACCEPTED.test(file.type));
}

/**
 * Converts an image to WebP, capped at 512x512 and quality 0.8.
 *
 * Runs entirely in the browser - the original file never leaves the device
 * unless the upload is confirmed. If canvas or WebP encoding is unavailable,
 * the original file is returned untouched so the flow still works.
 */
export async function toWebp(file, { maxDimension = MAX_DIMENSION, quality = WEBP_QUALITY } = {}) {
  if (!isAcceptedImage(file)) {
    throw new Error('Choose a PNG, JPG or WebP image.');
  }

  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp') throw new Error('WebP encoding is unavailable.');

    const name = file.name.replace(/\.[^.]+$/, '') || 'avatar';
    return new File([blob], `${name}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } catch {
    // Safe fallback: upload the original file rather than failing the flow.
    return file;
  }
}

function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }

  // Older Safari: decode through an <img> element.
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    image.src = url;
  });
}

/**
 * Builds a sized, auto-format delivery URL from the stored photo metadata.
 * The public id is stable, so changing sizes never re-uploads anything.
 */
export function avatarUrl(photo, { size = 128 } = {}) {
  if (!photo?.url) return null;
  return photo.url.replace(
    '/upload/',
    `/upload/f_auto,q_auto,w_${size},h_${size},c_fill,g_face/`
  );
}
