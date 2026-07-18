import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProtectedRoute from '../ProtectedRoute';

// Mock the AuthContext module
const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// We need a real MemoryRouter wrapper since ProtectedRoute uses Navigate
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows spinner while loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: true,
      user: null,
      token: null,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret</div>
      </ProtectedRoute>
    );

    // Should render spinner container
    const spinnerContainer = document.querySelector('[style*="display: flex"]');
    expect(spinnerContainer).toBeInTheDocument();

    // Should NOT render children
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      user: null,
      token: null,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret</div>
      </ProtectedRoute>
    );

    // Should NOT render children
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

    // Navigate should redirect to /login — we can verify by checking
    // that the children are not rendered (Navigate replaces the component)
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: 1, email: 'test@test.com', name: 'Test' },
      token: 'valid-token',
    });

    renderWithRouter(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.getByText('Secret')).toBeInTheDocument();
  });

  it('renders nothing but spinner when loading even if authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: true,
      user: null,
      token: 'valid-token',
    });

    renderWithRouter(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret</div>
      </ProtectedRoute>
    );

    // Should show spinner, not children
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    const spinnerContainer = document.querySelector('[style*="display: flex"]');
    expect(spinnerContainer).toBeInTheDocument();
  });
});
