import { useEffect, useState } from 'react';
import { initials } from '../lib/format';
import { avatarUrl } from '../lib/image';

const COLORS = ['#4338CA', '#0D9488', '#1D4ED8', '#B45309', '#7C3AED', '#BE185D', '#15803D'];

function colorFor(name = '') {
  let total = 0;
  for (let i = 0; i < name.length; i += 1) total += name.charCodeAt(i);
  return COLORS[total % COLORS.length];
}

/**
 * Person avatar.
 *
 * Pass `photo` (the stored { url, publicId } metadata) and the component picks
 * a sized Cloudinary URL. If the image cannot load, it falls back to initials
 * instead of showing a broken image.
 */
export default function Avatar({ name = '', size = 36, color, className = '', image, photo }) {
  const src = image || avatarUrl(photo, { size: Math.max(64, Math.round(size * 2)) });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        className={`avatar ${className}`}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        background: color || colorFor(name),
        fontSize: Math.max(10, size * 0.33),
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
