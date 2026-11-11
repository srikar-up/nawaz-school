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
import { applyServerChange, hasPatch } from '../lib/statePatch';
import Toast from '../components/Toast';

const AppDataContext = createContext(null);
const SESSION_KEY = 'nawaz.admin.session.v1';
const CACHE_KEY = 'nawaz.admin.state.v1';
const DYNAMIC_COLLECTIONS = [
  'students',
  'attendanceSessions',
  'testRecords',
  'staffAttendance',
];

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
  const dataRef = useRef(data);

  useEffect(() => {
    hasDataRef.current = Boolean(data);
    dataRef.current = data;
  }, [data]);

  const loadState = useCallback(async (id) => {
    const [config, dynamic] = await Promise.all([
      api.getBootstrap(),
      api.getState(id, { include: DYNAMIC_COLLECTIONS }),
    ]);
    return { ...config, ...dynamic, meta: dynamic.meta || config.meta };
  }, []);

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
        const state = await loadState(id);
        setData(state);
        hasDataRef.current = true;
        // Keep the signed-in user's own record (including photo) in step with the server.
        setSession((previous) => {
          if (!previous) return previous;
          const fresh = state.staff?.find((member) => member.id === previous.user.id);
          if (!fresh) return previous;
          const next = { ...previous, user: { ...previous.user, ...fresh } };
          try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(next));
          } catch {
            /* storage may be unavailable; the in-memory session still updates */
          }
          return next;
        });
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
    [logout, loadState]
  );

  const finishLogin = useCallback(async (result) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(result));
    setSession(result);
    staffIdRef.current = result.user.id;
    const state = await loadState(result.user.id);
    setData(state);
    hasDataRef.current = true;
    writeCache(state);
    setLastSyncedAt(new Date());
    setOffline(false);
    setLoading(false);
    return result;
  }, []);

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      try {
        return await finishLogin(await api.login(email, password));
      } catch (error) {
        setLoading(false);
        throw error;
      }
    },
    [finishLogin]
  );

  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      return await finishLogin(await api.loginWithGoogle());
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [finishLogin]);

  useEffect(() => {
    if (!staffId) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let changeTimer = null;
    let retryTimer = null;
    let revisionTimer = null;
    let controller = null;

    setLoading(!hasDataRef.current);
    refresh();

    const checkRevision = async () => {
      if (cancelled || !dataRef.current) return;
      try {
        const health = await api.health();
        const local = Number(dataRef.current.meta?.revision || 0);
        if (Number(health.revision) > local) refresh({ silent: true });
      } catch {
        /* The SSE stream reconnects on its own; a failed poll is harmless. */
      }
    };

    const onOnline = () => refresh({ silent: true });
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkRevision();
    };

    const scheduleRetry = () => {
      if (cancelled) return;
      setLive(false);
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(connect, 4000);
    };

    const connect = async () => {
      if (cancelled) return;
      controller = new AbortController();

      try {
        await api.streamEvents({
          signal: controller.signal,
          onOpen: () => {
            if (cancelled) return;
            setLive(true);
            setOffline(false);
          },
          onEvent: ({ event, data: raw }) => {
            if (cancelled || event !== 'change') return;
            let change = null;
            try {
              change = JSON.parse(raw);
            } catch {
              change = null;
            }

            if (hasPatch(change)) {
              setData((current) => {
                const next = applyServerChange(current, change);
                if (!next) return current;
                writeCache(next);
                return next;
              });
              setLastSyncedAt(new Date());
              setOffline(false);
              return;
            }

            window.clearTimeout(changeTimer);
            changeTimer = window.setTimeout(() => refresh({ silent: true }), 220);
          },
        });
        // The server closed the stream (restart or idle timeout): reconnect.
        scheduleRetry();
      } catch (error) {
        if (cancelled || error.name === 'AbortError') return;
        scheduleRetry();
      }
    };

    connect();
    revisionTimer = window.setInterval(checkRevision, 5 * 60 * 1000);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(changeTimer);
      window.clearTimeout(retryTimer);
      window.clearInterval(revisionTimer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      controller?.abort();
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
