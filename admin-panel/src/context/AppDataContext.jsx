import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api } from '../lib/api';
import Toast from '../components/Toast';

const AppDataContext = createContext(null);
const SESSION_KEY = 'nawaz.admin.session.v1';
const CACHE_KEY = 'nawaz.admin.state.v1';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(state) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {
    /* Storage can be full or disabled; online use still works. */
  }
}

export function AppDataProvider({ children }) {
  const [session, setSession] = useState(() => readJson(SESSION_KEY));
  const [data, setData] = useState(() => readJson(CACHE_KEY));
  const [loading, setLoading] = useState(() => Boolean(readJson(SESSION_KEY) && !readJson(CACHE_KEY)));
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [live, setLive] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const hasDataRef = useRef(Boolean(data));
  const staffId = session?.user?.id || null;
  const staffIdRef = useRef(staffId);
  staffIdRef.current = staffId;

  useEffect(() => {
    hasDataRef.current = Boolean(data);
  }, [data]);

  const notify = useCallback((message, type = 'success') => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, type });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const dismissToast = useCallback(() => {
    window.clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const logout = useCallback(() => {
    api.logout?.().catch(() => {
      /* Firebase may already have signed out; local state is what matters. */
    });
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CACHE_KEY);
    setSession(null);
    setData(null);
    setOffline(false);
    setLive(false);
  }, []);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      const id = staffIdRef.current;
      if (!id) return null;
      if (!silent) setRefreshing(true);
      try {
        const state = await api.getState(id);
        setData(state);
        hasDataRef.current = true;
        writeCache(state);
        setOffline(false);
        setLastSyncedAt(new Date());
        return state;
      } catch (error) {
        if (error.status === 401) logout();
        else setOffline(true);
        return null;
      } finally {
        if (!silent) setRefreshing(false);
        setLoading(false);
      }
    },
    [logout]
  );

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const result = await api.login(email, password);
      localStorage.setItem(SESSION_KEY, JSON.stringify(result));
      setSession(result);
      staffIdRef.current = result.user.id;
      const state = await api.getState(result.user.id);
      setData(state);
      hasDataRef.current = true;
      writeCache(state);
      setLastSyncedAt(new Date());
      setOffline(false);
      setLoading(false);
      return result;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!staffId) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let changeTimer = null;
    let source = null;

    setLoading(!hasDataRef.current);
    refresh();

    const connect = async () => {
      try {
        source = new EventSource(await api.eventUrl(staffId));
        source.addEventListener('ready', () => {
          if (!cancelled) {
            setLive(true);
            setOffline(false);
          }
        });
        source.addEventListener('change', () => {
          if (cancelled) return;
          window.clearTimeout(changeTimer);
          changeTimer = window.setTimeout(() => refresh({ silent: true }), 220);
        });
        source.onopen = () => {
          if (!cancelled) setLive(true);
        };
        source.onerror = () => {
          if (!cancelled) setLive(false);
        };
      } catch {
        setLive(false);
      }
    };

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(changeTimer);
      source?.close();
      setLive(false);
    };
  }, [staffId, refresh]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const permissions = useMemo(
    () => ({
      admin: true,
      superAdmin: session?.user?.accessLevel === 'SuperAdmin',
      subAdmin: session?.user?.accessLevel === 'SubAdmin',
    }),
    [session]
  );

  const value = useMemo(
    () => ({
      session,
      user:
        data?.staff?.find((member) => member.id === staffId) ||
        session?.user ||
        null,
      data,
      loading,
      refreshing,
      offline,
      live,
      lastSyncedAt,
      permissions,
      login,
      logout,
      refresh,
      notify,
      toast,
      dismissToast,
    }),
    [
      session,
      data,
      staffId,
      loading,
      refreshing,
      offline,
      live,
      lastSyncedAt,
      permissions,
      login,
      logout,
      refresh,
      notify,
      toast,
      dismissToast,
    ]
  );

  return (
    <AppDataContext.Provider value={value}>
      {children}
      <Toast toast={toast} onClose={dismissToast} />
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}
