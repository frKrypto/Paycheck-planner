import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={styles.spinnerContainer}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const styles: Record<string, React.CSSProperties> = {
  spinnerContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#f0f9f4',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid #d1e7dc',
    borderTop: '4px solid #2d8a5e',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
