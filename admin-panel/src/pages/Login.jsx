import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Avatar from '../components/Avatar';

const DEMO_ACCOUNTS = [
  {
    label: 'Principal · SuperAdmin',
    name: 'Dr. Tariq Nawaz',
    email: 'admin@nawazschool.edu',
    password: 'admin123',
    color: '#4338CA',
  },
  {
    label: 'Operations · SubAdmin',
    name: 'Mr. Usman Ali',
    email: 'subadmin@nawazschool.edu',
    password: 'subadmin123',
    color: '#0D9488',
  },
];

export default function Login() {
  const { session, login } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState(DEMO_ACCOUNTS[0].password);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Admin sign in · Nawaz School';
  }, []);

  if (session) return <Navigate to="/overview" replace />;

  const go = () => navigate(location.state?.from || '/overview', { replace: true });

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

  const quickLogin = async (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
    setBusy(true);
    try {
      await login(account.email, account.password);
      go();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-login">
      <section className="admin-login-brand">
        <div className="admin-login-orb one" aria-hidden="true" />
        <div className="admin-login-orb two" aria-hidden="true" />
        <div className="admin-login-brand-inner">
          <div className="admin-login-logo">
            <span>
              <img
                src={`${import.meta.env.BASE_URL}school-logo.png`}
                alt="Nawaz School crest"
              />
            </span>
            <div>
              <strong>Nawaz School</strong>
              <small>Admin command center</small>
            </div>
          </div>

          <div className="admin-login-hero">
            <span className="admin-login-kicker">
              <Sparkles size={14} /> One clear view of the school
            </span>
            <h1>
              Calm oversight.
              <br />
              Better school days.
            </h1>
            <p>
              Students, staff, attendance, exams and announcements — connected live to the teacher
              workspace.
            </p>
          </div>

          <div className="admin-login-features">
            <div>
              <span>
                <Users size={18} />
              </span>
              <strong>Students &amp; staff</strong>
              <small>One directory, clear access levels</small>
            </div>
            <div>
              <span>
                <CalendarCheck2 size={18} />
              </span>
              <strong>Attendance oversight</strong>
              <small>See every class register as it arrives</small>
            </div>
            <div>
              <span>
                <BarChart3 size={18} />
              </span>
              <strong>Reports that explain</strong>
              <small>Live numbers without the noise</small>
            </div>
          </div>

          <div className="admin-login-preview">
            <div className="preview-card">
              <span className="preview-icon">
                <CheckCircle2 size={17} />
              </span>
              <div>
                <strong>Live shared data</strong>
                <span>Teacher submissions appear here instantly.</span>
              </div>
            </div>
            <div className="preview-stat">
              <span>Today</span>
              <strong>3 / 4</strong>
              <small>registers submitted</small>
            </div>
          </div>

          <p className="admin-login-quote">
            “I can understand and manage my school without struggling with technology.”
          </p>
        </div>
      </section>

      <section className="admin-login-form-side">
        <div className="admin-login-form-wrap">
          <div className="admin-login-head">
            <span className="admin-login-shield">
              <ShieldCheck size={18} />
            </span>
            <span>Secure admin access</span>
          </div>
          <h2>Welcome back</h2>
          <p className="admin-login-sub">Sign in with your school administrator account.</p>

          <form className="admin-login-form" onSubmit={submit}>
            <label className="admin-field">
              <span>Email address</span>
              <div className="admin-input">
                <Mail size={17} />
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </label>
            <label className="admin-field">
              <span>Password</span>
              <div className="admin-input">
                <LockKeyhole size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="admin-input-action"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {error ? (
              <p className="admin-form-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="admin-login-meta">
              <label className="admin-check">
                <input type="checkbox" defaultChecked />
                <span>Keep me signed in</span>
              </label>
              <button
                type="button"
                className="admin-link-button"
                onClick={() =>
                  setError('Contact the school IT office to reset an administrator password.')
                }
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" className="admin-btn admin-btn-primary admin-btn-block admin-btn-lg" disabled={busy}>
              {busy ? <span className="admin-spinner" /> : null}
              {busy ? 'Signing in…' : 'Sign in to admin console'}
              {!busy ? <ArrowRight size={17} /> : null}
            </button>
          </form>

          <div className="admin-login-divider">
            <span>Demo accounts</span>
          </div>

          <div className="admin-demo-list">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="admin-demo-account"
                onClick={() => quickLogin(account)}
                disabled={busy}
              >
                <Avatar name={account.name} size={38} color={account.color} />
                <span>
                  <strong>{account.name}</strong>
                  <small>{account.label}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>

          <p className="admin-login-note">
            Prototype credentials are shown for the local demo. After Firebase is connected, sign-in
            will use Firebase Authentication and role claims.
          </p>

          <a
            className="admin-teacher-link"
            href={import.meta.env.VITE_TEACHER_URL || (import.meta.env.PROD ? '/teacher/' : 'http://localhost:5173/')}
          >
            Open the teacher mobile workspace <ArrowRight size={15} />
          </a>
        </div>
      </section>
    </div>
  );
}
