import BrandMark from './BrandMark';

export default function AppLoading({ label = 'Connecting to the school data service…' }) {
  return (
    <div className="admin-loading">
      <BrandMark subtitle="Admin console" />
      <div className="admin-loading-bar" aria-hidden="true">
        <span />
      </div>
      <p>{label}</p>
    </div>
  );
}
