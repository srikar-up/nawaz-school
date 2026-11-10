const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Cloudinary browser uploads.
 *
 * Only the cloud name and an UNSIGNED upload preset belong here. The API key
 * and secret are server credentials - never put them in VITE_* variables,
 * because Vite inlines those straight into the shipped JavaScript bundle.
 */
export const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

/** Build a delivery URL with on-the-fly transforms. */
export function cloudinaryUrl(publicId, { width, height, crop = 'fill', gravity = 'auto' } = {}) {
  if (!CLOUD_NAME) throw new Error('[cloudinary] VITE_CLOUDINARY_CLOUD_NAME is missing.');
  const t = ['f_auto', 'q_auto'];
  if (width) t.push(`w_${width}`);
  if (height) t.push(`h_${height}`);
  if (width || height) t.push(`c_${crop}`, `g_${gravity}`);
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${t.join(',')}/${publicId}`;
}

/**
 * Upload a file through an unsigned preset.
 * @param {File} file
 * @param {{ folder?: string, onProgress?: (percent: number) => void }} options
 * @returns {Promise<{ publicId: string, secureUrl: string, width: number, height: number, bytes: number, format: string }>}
 */
export function uploadToCloudinary(file, { folder, onProgress } = {}) {
  if (!isCloudinaryConfigured) {
    return Promise.reject(
      new Error(
        '[cloudinary] Missing VITE_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_UPLOAD_PRESET. ' +
          'Create an unsigned upload preset in the Cloudinary console and copy .env.example to .env.local.'
      )
    );
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);
  if (folder) form.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
    }

    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText || '{}');
      } catch {
        /* fall through to the status check */
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          publicId: body.public_id,
          secureUrl: body.secure_url,
          width: body.width,
          height: body.height,
          bytes: body.bytes,
          format: body.format,
        });
      } else {
        reject(new Error(body?.error?.message || `Cloudinary upload failed (HTTP ${xhr.status}).`));
      }
    };

    xhr.onerror = () => reject(new Error('Cloudinary upload failed: network error.'));
    xhr.send(form);
  });
}
