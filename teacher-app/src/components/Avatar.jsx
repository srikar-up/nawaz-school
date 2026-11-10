import { initials } from '../lib/format';

const COLORS = ['#4338CA', '#0D9488', '#1D4ED8', '#B45309', '#7C3AED', '#BE185D', '#15803D'];

function colorFor(name = '') {
  let total = 0;
  for (let i = 0; i < name.length; i += 1) total += name.charCodeAt(i);
  return COLORS[total % COLORS.length];
}

export default function Avatar({ name = '', size = 40, color, className = '', image }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className={`avatar ${className}`}
        style={{ width: size, height: size }}
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
        fontSize: Math.max(11, size * 0.32),
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
