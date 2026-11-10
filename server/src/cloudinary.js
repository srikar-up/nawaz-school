import crypto from 'node:crypto';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const API_KEY = process.env.CLOUDINARY_API_KEY || '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

export const PHOTO_FOLDERS = Object.freeze({
  staff: 'school/staff',
  students: 'school/students',
});

export function isCloudinaryConfigured() {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET);
}

/**
 * Cloudinary signature: SHA-1 over the alphabetically sorted parameters,
 * excluding file/api_key/signature/cloud_name, followed by the API secret.
 */
function signParams(params) {
  const toSign = Object.keys(params)
    .filter((key) => !['file', 'api_key', 'signature', 'cloud_name'].includes(key))
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHash('sha1').update(toSign + API_SECRET).digest('hex');
}

/**
 * Builds signed upload parameters for one specific asset.
 *
 * `public_id` is signed, so the browser cannot upload to any path other than
 * the one the server chose for this exact record.
 */
export function buildSignedUpload({ kind, id }) {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured on the server.');
  }

  const folder = PHOTO_FOLDERS[kind];
  if (!folder) throw new Error(`Unsupported photo kind: ${kind}`);

  const publicId = `${folder}/${id}`;
  const unsigned = {
    timestamp: Math.floor(Date.now() / 1000),
    public_id: publicId,
    overwrite: 'true',
    invalidate: 'true',
  };

  return {
    cloudName: CLOUD_NAME,
    apiKey: API_KEY,
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    timestamp: unsigned.timestamp,
    publicId,
    overwrite: unsigned.overwrite,
    invalidate: unsigned.invalidate,
    signature: signParams(unsigned),
  };
}

/** Removes an asset from Cloudinary. Missing assets are not an error. */
export async function destroyAsset(publicId) {
  if (!isCloudinaryConfigured() || !publicId) return { result: 'skipped' };

  const credentials = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ public_id: publicId, invalidate: true }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary destroy failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return response.json();
}

/** Only our own cloud URLs are accepted back from the browser. */
export function isOwnCloudinaryUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' && parsed.pathname.startsWith(`/${CLOUD_NAME}/`);
  } catch {
    return false;
  }
}
