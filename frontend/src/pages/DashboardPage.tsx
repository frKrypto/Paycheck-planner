import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>PayCheck Planner</h1>
        <div style={styles.userArea}>
          <span style={styles.userName}>{user?.name}</span>
          <button style={styles.logoutBtn} onClick={logout}>
            Sign Out
          </button>
        </div>
      </header>
      <main style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.comingSoon}>Dashboard coming soon</h2>
          <p style={styles.subtitle}>
            Your financial overview will appear here.
          </p>
        </div>
      </main>
    </div>
  );
}

const colors = {
  bg: '#f0f9f4',
  cardBg: '#ffffff',
  primary: '#2d8a5e',
  text: '#1a2e23',
  subtle: '#5c7a68',
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: colors.bg,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    background: colors.cardBg,
    borderBottom: '1px solid #d1e7dc',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  title: {
    margin: 0,
    fontSize: '1.35rem',
    fontWeight: 700,
    color: colors.primary,
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  userName: {
    fontSize: '0.9rem',
    color: colors.text,
    fontWeight: 500,
  },
  logoutBtn: {
    padding: '0.45rem 1rem',
    borderRadius: 6,
    border: '1.5px solid #d1e7dc',
    background: '#fff',
    color: colors.text,
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  main: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '4rem 1rem',
  },
  card: {
    textAlign: 'center',
    background: colors.cardBg,
    borderRadius: 12,
    padding: '3rem 2rem',
    maxWidth: 480,
    width: '100%',
    boxShadow: '0 2px 12px rgba(45, 138, 94, 0.08)',
  },
  comingSoon: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: colors.primary,
    margin: 0,
  },
  subtitle: {
    fontSize: '0.95rem',
    color: colors.subtle,
    margin: '0.5rem 0 0',
  },
};
