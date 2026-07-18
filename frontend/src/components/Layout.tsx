import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode, CSSProperties } from 'react';

const colors = {
  bg: '#f0f9f4',
  headerBg: '#ffffff',
  primary: '#2d8a5e',
  primaryLight: '#e8f5ee',
  text: '#1a2e23',
  subtle: '#5c7a68',
  border: '#d1e7dc',
};

const styles: Record<string, CSSProperties> = {
  header: {
    background: colors.headerBg,
    borderBottom: `1px solid ${colors.border}`,
    padding: '0.75rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
    boxShadow: '0 1px 4px rgba(45, 138, 94, 0.06)',
  },
  headerTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: colors.primary,
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  userName: {
    fontSize: '0.9rem',
    fontWeight: 500,
    color: colors.text,
  },
  logoutBtn: {
    background: 'transparent',
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
    color: colors.subtle,
  },
  nav: {
    background: colors.headerBg,
    borderBottom: `1px solid ${colors.border}`,
    display: 'flex',
    gap: 0,
    padding: '0 1.5rem',
    overflowX: 'auto',
  },
  navLink: {
    display: 'inline-block',
    padding: '0.65rem 1.1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: colors.subtle,
    textDecoration: 'none',
    borderBottom: '3px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
  },
  navLinkActive: {
    color: colors.primary,
    borderBottomColor: colors.primary,
    fontWeight: 600,
  },
  page: {
    minHeight: '100vh',
    background: colors.bg,
  },
  main: {
    padding: '1.5rem',
    maxWidth: 960,
    margin: '0 auto',
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkStyle = (isActive: boolean): CSSProperties => ({
    ...styles.navLink,
    ...(isActive ? styles.navLinkActive : {}),
  });

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>PayCheck Planner</h1>
        <div style={styles.userArea}>
          <span style={styles.userName}>{user?.name}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>
      <nav style={styles.nav}>
        <NavLink to="/" end style={({ isActive }) => linkStyle(isActive)}>
          Dashboard
        </NavLink>
        <NavLink to="/income" style={({ isActive }) => linkStyle(isActive)}>
          Income
        </NavLink>
        <NavLink to="/expenses" style={({ isActive }) => linkStyle(isActive)}>
          Expenses
        </NavLink>
        <NavLink to="/bills" style={({ isActive }) => linkStyle(isActive)}>
          Bills
        </NavLink>
      </nav>
      <main style={styles.main}>{children}</main>
    </div>
  );
}
