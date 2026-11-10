import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import SearchOverlay from './SearchOverlay';

export default function AdminShell() {
  const { offline, refresh, refreshing, lastSyncedAt } = useAppData();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname]);

  return (
    <div className="admin-app">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="admin-main">
        <Topbar onMenu={() => setSidebarOpen(true)} onSearch={() => setSearchOpen(true)} />
        {offline ? (
          <div className="admin-offline">
            <WifiOff size={15} />
            <span>
              Offline preview — showing the last data synced from the school cache.
              {lastSyncedAt ? ` Last update ${lastSyncedAt.toLocaleTimeString()}.` : ''}
            </span>
            <button type="button" onClick={() => refresh()} disabled={refreshing}>
              <RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Retry
            </button>
          </div>
        ) : null}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
