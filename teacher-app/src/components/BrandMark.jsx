export default function BrandMark({ compact = false, subtitle = 'Teacher workspace', large = false }) {
  return (
    <div className={`brand ${large ? 'brand-large' : ''}`}>
      <span className="brand-mark" aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}school-logo.jpg`}
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
