import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await signup(email.trim(), password, name.trim());
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const msg =
        axiosErr?.response?.data?.error || 'Signup failed. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.appName}>PayCheck Planner</h1>
        <p style={styles.subtitle}>Create your account</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <label style={styles.label}>Name</label>
          <input
            type="text"
            style={styles.input}
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />

          <label style={styles.label}>Email</label>
          <input
            type="email"
            style={styles.input}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <label style={styles.label}>Password</label>
          <input
            type="password"
            style={styles.input}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          <button type="submit" style={styles.button} disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

// ── styles ──
const colors = {
  bg: '#f0f9f4',
  cardBg: '#ffffff',
  primary: '#2d8a5e',
  primaryHover: '#23704b',
  text: '#1a2e23',
  subtle: '#5c7a68',
  errorBg: '#fef2f2',
  errorText: '#b91c1c',
  inputBorder: '#c8ddd2',
  inputFocus: '#2d8a5e',
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: colors.bg,
    padding: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    background: colors.cardBg,
    borderRadius: 16,
    padding: '2.5rem 2rem',
    boxShadow: '0 4px 24px rgba(45, 138, 94, 0.10)',
  },
  appName: {
    margin: 0,
    fontSize: '1.75rem',
    fontWeight: 700,
    color: colors.primary,
    textAlign: 'center',
  },
  subtitle: {
    margin: '0.5rem 0 1.5rem',
    textAlign: 'center',
    color: colors.subtle,
    fontSize: '0.95rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: colors.text,
  },
  input: {
    padding: '0.7rem 0.85rem',
    borderRadius: 8,
    border: `1.5px solid ${colors.inputBorder}`,
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    color: colors.text,
    background: '#fafdfb',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.8rem',
    borderRadius: 8,
    border: 'none',
    background: colors.primary,
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  error: {
    background: colors.errorBg,
    color: colors.errorText,
    padding: '0.65rem 0.85rem',
    borderRadius: 8,
    fontSize: '0.85rem',
    textAlign: 'center',
  },
  footer: {
    marginTop: '1.25rem',
    textAlign: 'center',
    fontSize: '0.9rem',
    color: colors.subtle,
  },
  link: {
    color: colors.primary,
    fontWeight: 600,
    textDecoration: 'none',
  },
};
