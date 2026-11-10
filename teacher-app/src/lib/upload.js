import { api } from './api';
import { toWebp } from './image';

/**
 * Secure profile-photo upload.
 *
 * 1. Compress + convert to WebP locally (512px, q0.8).
 * 2. Ask the API for a signature bound to this exact record.
 * 3. Upload straight to Cloudinary with those signed parameters.
 * 4. Persist the returned metadata through the API.
 *
 * The browser never sees the Cloudinary API secret, and the signature is only
 * issued after the server has checked the caller's role.
 */
export async function uploadProfilePhoto(file, { kind, id, onProgress } = {}) {
  const prepared = await toWebp(file);
  const signed = await api.signCloudinary(kind, id);

  const form = new FormData();
  form.append('file', prepared);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('public_id', signed.publicId);
  form.append('overwrite', String(signed.overwrite));
  form.append('invalidate', String(signed.invalidate));
  form.append('signature', signed.signature);

  const uploaded = await postForm(signed.uploadUrl, form, onProgress);

  return api.setPhoto(kind, id, {
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
  });
}

function postForm(url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

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
        /* keep the status-based error below */
      }

      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
        resolve(body);
      } else {
        reject(new Error(body?.error?.message || `Upload failed (${xhr.status}).`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed: network error.'));
    xhr.send(form);
  });
}
