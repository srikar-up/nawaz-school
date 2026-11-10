export default function AppLoading({ label = 'Loading your workspace' }) {
  return (
    <div className="app-loading">
      <div className="app-loading-brand">
        <img
          src={`${import.meta.env.BASE_URL}school-logo.jpg`}
          alt="Nawaz School crest"
          className="app-loading-logo"
        />
        <div className="app-loading-name">
          <strong>Nawaz School</strong>
          <small>Teacher workspace</small>
        </div>
      </div>
      <div className="loading-bars" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p>{label}</p>
    </div>
  );
}
