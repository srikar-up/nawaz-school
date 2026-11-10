import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import AppLoading from '../components/AppLoading';

export default function RequireAuth() {
  const { session, data, loading } = useAppData();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (loading && !data) {
    return <AppLoading />;
  }
  return <Outlet />;
}

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}
