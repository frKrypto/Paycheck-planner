import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useThemeStyles } from '../hooks/useThemeStyles';
import { fetchAlerts } from '../api/alerts';
import { useState, useEffect } from 'react';
import type { ReactNode, CSSProperties } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const colors = useThemeStyles();
  const navigate = useNavigate();
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAlerts('critical')
      .then((data) => {
        if (!cancelled) setCriticalCount(data.count);
      })
      .catch(() => {
        // Silently handle
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkStyle = (isActive: boolean): CSSProperties => ({
    display: 'inline-block',
    padding: '0.65rem 1.1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: isActive ? colors.primary : colors.subtle,
    textDecoration: 'none',
    borderBottom: `3px solid ${isActive ? colors.primary : 'transparent'}`,
    transition: 'color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
    ...(isActive ? { fontWeight: 600 } : {}),
  });

  const headerStyle: CSSProperties = {
    background: colors.cardBg,
    borderBottom: `1px solid ${colors.border}`,
    padding: '0.75rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
    boxShadow: `0 1px 4px ${colors.primaryLight}`,
  };

  const headerTitleStyle: CSSProperties = {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: colors.primary,
  };

  const navStyle: CSSProperties = {
    background: colors.cardBg,
    borderBottom: `1px solid ${colors.border}`,
    display: 'flex',
    gap: 0,
    padding: '0 1.5rem',
    overflowX: 'auto',
  };

  const pageStyle: CSSProperties = {
    minHeight: '100vh',
    background: colors.bg,
  };

  const mainStyle: CSSProperties = {
    padding: '1.5rem',
    maxWidth: 960,
    margin: '0 auto',
  };

  const themeBtnStyle: CSSProperties = {
    background: 'transparent',
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: '0.3rem 0.55rem',
    fontSize: '1.05rem',
    cursor: 'pointer',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={headerTitleStyle}>PayCheck Planner</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            style={themeBtnStyle}
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {criticalCount > 0 && (
            <span style={{
              position: 'relative' as const,
              display: 'inline-flex',
              fontSize: '1.2rem',
              cursor: 'default',
            }} title={`${criticalCount} critical alert(s)`}>
              🔔
              <span style={{
                position: 'absolute' as const,
                top: -6,
                right: -8,
                background: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                width: 18,
                height: 18,
                fontSize: '0.65rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}>{criticalCount}</span>
            </span>
          )}
          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: colors.text }}>
            {user?.name}
          </span>
          <button
            style={{
              background: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: colors.subtle,
            }}
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </header>
      <nav style={navStyle}>
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
      <main style={mainStyle}>{children}</main>
    </div>
  );
}
