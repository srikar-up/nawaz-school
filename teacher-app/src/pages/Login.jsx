import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';

const DEMO = { email: 'teacher@nawazschool.edu', password: 'teacher123' };

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function Login() {
  const { session, login, loginWithGoogle } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(DEMO.email);
  const [password, setPassword] = useState(DEMO.password);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Sign in · Nawaz School Teacher';
  }, []);

  if (session) return <Navigate to="/" replace />;

  const go = () => {
    const target = location.state?.from || '/';
    navigate(target, { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      go();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = async () => {
    setError('');
    setBusy(true);
    try {
      await loginWithGoogle();
      go();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  };

  const demoLogin = async () => {
    setEmail(DEMO.email);
    setPassword(DEMO.password);
    setError('');
    setBusy(true);
    try {
      await login(DEMO.email, DEMO.password);
      go();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-orb login-orb-one" aria-hidden="true" />
      <div className="login-orb login-orb-two" aria-hidden="true" />
      <div className="login-orb login-orb-three" aria-hidden="true" />

      <div className="login-content">
        <div className="login-brand">
          <span className="login-logo">
            <img
              src={`${import.meta.env.BASE_URL}school-logo.jpg`}
              alt="Nawaz School crest"
            />
          </span>
          <div>
            <strong>Nawaz School</strong>
            <small>Teacher Mobile Workspace</small>
          </div>
        </div>

        <div className="login-hero">
          <span className="login-kicker">
            <Sparkles size={14} />
            A calmer school day
          </span>
          <h1>
            Your classroom,
            <br />
            in your pocket.
          </h1>
          <p>
            Attendance, schedules, marks and notices — built for the few minutes
            between classes.
          </p>
          <div className="login-features">
            <span>
              <CalendarCheck2 size={15} /> One-tap roll-call
            </span>
            <span>
              <CheckCircle2 size={15} /> Works with the admin console
            </span>
          </div>
        </div>

        <form className="login-card" onSubmit={submit}>
          <div className="login-card-head">
            <h2>Welcome back</h2>
            <p>Sign in with your school account.</p>
          </div>

          <label className="field">
            <span>School email</span>
            <div className="input-with-icon">
              <Mail size={17} />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@nawazschool.edu"
                required
              />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="input-with-icon">
              <LockKeyhole size={17} />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? <span className="btn-spinner" /> : null}
            {busy ? 'Signing in…' : 'Sign in'}
            {!busy ? <ArrowRight size={18} /> : null}
          </button>

          <button
            type="button"
            className="btn btn-block btn-lg google-btn"
            onClick={googleLogin}
            disabled={busy}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="login-divider">
            <span>or try the prototype</span>
          </div>

          <button
            type="button"
            className="demo-account"
            onClick={demoLogin}
            disabled={busy}
          >
            <span className="avatar" style={{ background: '#0D9488', width: 38, height: 38, fontSize: 12 }}>
              SN
            </span>
            <span>
              <strong>Continue as Prof. Sarah Nawaz</strong>
              <small>Science &amp; Mathematics · 10-A incharge</small>
            </span>
            <ArrowRight size={17} />
          </button>

          <p className="login-hint">
            Demo password <code>teacher123</code> · Runs on the local school cache until
            Firebase is connected.
          </p>
        </form>

        <p className="login-footer">Nawaz School System · Learn. Grow. Lead.</p>
      </div>
    </div>
  );
}
