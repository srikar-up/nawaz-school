export default function BrandMark({ compact = false, subtitle = 'Admin console', light = false }) {
  return (
    <div className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-mark" aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}school-logo.png`}
          alt=""
          className="brand-logo"
        />
      </span>
      {!compact && (
        <span className="brand-text">
          <strong>Nawaz School</strong>
          <small>{subtitle}</small>
        </span>
      )}
    </div>
  );
}
