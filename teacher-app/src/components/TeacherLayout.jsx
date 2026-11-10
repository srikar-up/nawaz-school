import { useLocation, Outlet } from 'react-router-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import BottomNav from './BottomNav';
import { relativeTime } from '../lib/format';

export default function TeacherLayout() {
  const { pathname } = useLocation();
  const { offline, refresh, refreshing, lastSyncedAt, data } = useAppData();
  const hideNav = pathname.startsWith('/tasks/exams/');

  return (
    <div className="t-shell">
      {offline ? (
        <div className="offline-banner" role="status">
          <WifiOff size={15} />
          <span>
            Offline preview
            {lastSyncedAt ? ` · last synced ${relativeTime(lastSyncedAt.toISOString())}` : ''}
          </span>
          <button type="button" onClick={() => refresh()} disabled={refreshing}>
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            Retry
          </button>
        </div>
      ) : null}
      <main className={`t-main ${hideNav ? 't-main-no-nav' : ''}`}>
        <Outlet />
      </main>
      {!hideNav ? <BottomNav /> : null}
      <span className="sr-only" aria-live="polite">
        {data ? `${data.classes?.length || 0} classes loaded` : ''}
      </span>
    </div>
  );
}
