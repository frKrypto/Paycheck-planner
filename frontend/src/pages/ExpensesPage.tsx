import { useState, useEffect, useCallback } from 'react';
import {
  fetchExpenses,
  createExpense,
  deleteExpense,
  type Expense,
} from '../api/expenses';
import { useThemeStyles } from '../hooks/useThemeStyles';

// ── Helpers ───────────────────────────────────────────────────────────
const formatCurrency = (amount: number): string => '$' + amount.toFixed(2);
const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const categories = [
  'rent',
  'utilities',
  'groceries',
  'transportation',
  'debt',
  'subscriptions',
  'other',
] as const;

const categoryColors: Record<string, string> = {
  rent: '#2d8a5e',
  utilities: '#3a9d6a',
  groceries: '#e6a817',
  transportation: '#4a90d9',
  debt: '#e0555a',
  subscriptions: '#8e6ab7',
  other: '#6b7280',
};

const getCatColor = (cat: string): string => categoryColors[cat] ?? categoryColors.other;

// ── ExpensesPage ──────────────────────────────────────────────────────
export default function ExpensesPage() {
  const colors = useThemeStyles();

  function Spinner({ size = 28 }: { size?: number }) {
    return (
      <div
        style={{
          width: size,
          height: size,
          border: `3px solid ${colors.border}`,
          borderTopColor: colors.primary,
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
          margin: '0 auto',
        }}
      />
    );
  }

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState('groceries');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params: { start?: string; end?: string; category?: string } = {};
      if (filterCategory) params.category = filterCategory;
      if (filterStart) params.start = filterStart;
      if (filterEnd) params.end = filterEnd;
      const data = await fetchExpenses(params);
      setExpenses(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStart, filterEnd]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amt = parseFloat(amount);
    if (!date) {
      setFormError('Date is required.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      setFormError('Amount must be greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      await createExpense({
        category,
        amount: amt,
        date,
        description: description || undefined,
      });
      setAmount('');
      setDate('');
      setDescription('');
      await loadExpenses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add expense.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteExpense(id);
      await loadExpenses();
    } catch {
      // silently fail
    }
  };

  const today = new Date().toISOString().split('T')[0];

  // ── Styles ────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    fontSize: '0.9rem',
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    background: colors.inputBg,
    color: colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.3rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: colors.subtle,
  };

  const btnPrimary: React.CSSProperties = {
    background: colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0.6rem 1.25rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const btnDanger: React.CSSProperties = {
    background: 'transparent',
    color: colors.red,
    border: `1px solid ${colors.red}`,
    borderRadius: 6,
    padding: '0.3rem 0.65rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
  };

  const styles: Record<string, React.CSSProperties> = {
    card: {
      background: colors.cardBg,
      borderRadius: 12,
      padding: '1.5rem',
      marginBottom: '1.5rem',
      boxShadow: `0 1px 4px ${colors.primaryLight}`,
    },
    sectionTitle: {
      margin: '0 0 1rem',
      fontSize: '1.1rem',
      fontWeight: 700,
      color: colors.text,
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: '1rem',
    },
    error: {
      margin: '0 0 0.75rem',
      fontSize: '0.85rem',
      color: colors.red,
      fontWeight: 500,
    },
    filterRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '0.75rem',
      marginBottom: '1rem',
    },
    filterControls: {
      display: 'flex',
      gap: '0.5rem',
      flexWrap: 'wrap',
    },
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    },
    listItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '0.5rem',
      padding: '0.85rem 0',
      borderBottom: `1px solid ${colors.border}`,
    },
    listLeft: {
      display: 'flex',
      flexDirection: 'column',
    },
    listDate: {
      margin: 0,
      fontSize: '0.9rem',
      fontWeight: 600,
      color: colors.text,
    },
    badge: {
      display: 'inline-block',
      padding: '0.15rem 0.5rem',
      borderRadius: 20,
      fontSize: '0.7rem',
      fontWeight: 600,
      marginLeft: '0.5rem',
      verticalAlign: 'middle',
    },
    listDesc: {
      margin: '0.15rem 0 0',
      fontSize: '0.8rem',
      color: colors.subtle,
    },
    listRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    },
    listAmount: {
      margin: 0,
      fontSize: '1rem',
      fontWeight: 700,
      color: colors.text,
    },
    empty: {
      padding: '2rem 1.5rem',
      textAlign: 'center',
    },
    emptyText: {
      margin: 0,
      fontSize: '0.9rem',
      color: colors.subtle,
    },
  };

  return (
    <div>
      {/* ── Expense Entry Form ────────────────────────────────────── */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Add Expense</h2>
        {formError && <p style={styles.error}>{formError}</p>}
        <form onSubmit={handleSubmit} style={styles.formGrid}>
          <div>
            <label style={labelStyle} htmlFor="exp-category">Category</label>
            <select
              id="exp-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={inputStyle}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="exp-amount">Amount ($)</label>
            <input
              id="exp-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="exp-date">Date</label>
            <input
              id="exp-date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="exp-desc">Description (optional)</label>
            <input
              id="exp-desc"
              type="text"
              placeholder="e.g. Weekly groceries"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" style={btnPrimary} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.filterRow}>
          <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Expense History</h2>
          <div style={styles.filterControls}>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ ...inputStyle, width: 'auto', minWidth: 130 }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
              style={{ ...inputStyle, width: 'auto' }}
              placeholder="Start"
            />
            <input
              type="date"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
              style={{ ...inputStyle, width: 'auto' }}
              placeholder="End"
            />
          </div>
        </div>
        {loading ? (
          <div style={{ padding: '2rem 0', textAlign: 'center' }}>
            <Spinner />
          </div>
        ) : expenses.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyText}>No expenses recorded yet</p>
          </div>
        ) : (
          <div style={styles.list}>
            {expenses.map((exp) => (
              <div key={exp.id} style={styles.listItem}>
                <div style={styles.listLeft}>
                  <p style={styles.listDate}>
                    {formatDate(exp.date)}{' '}
                    <span
                      style={{
                        ...styles.badge,
                        background: getCatColor(exp.category) + '1A',
                        color: getCatColor(exp.category),
                      }}
                    >
                      {exp.category}
                    </span>
                  </p>
                  {exp.description && (
                    <p style={styles.listDesc}>{exp.description}</p>
                  )}
                </div>
                <div style={styles.listRight}>
                  <p style={styles.listAmount}>{formatCurrency(exp.amount)}</p>
                  <button
                    style={btnDanger}
                    onClick={() => handleDelete(exp.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
