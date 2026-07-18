import { useState, useEffect, useCallback } from 'react';
import {
  fetchBills,
  createBill,
  updateBill,
  deleteBill,
  type Bill,
} from '../api/bills';
import { useThemeStyles } from '../hooks/useThemeStyles';

// ── Helpers ───────────────────────────────────────────────────────────
const formatCurrency = (amount: number): string => '$' + amount.toFixed(2);

const getOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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

const frequencies = ['monthly', 'weekly', 'biweekly', 'semi-monthly'] as const;

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

const freqLabel: Record<string, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  'semi-monthly': 'Semi-monthly',
};

// ── BillsPage ─────────────────────────────────────────────────────────
export default function BillsPage() {
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

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('1');
  const [frequency, setFrequency] = useState('monthly');
  const [category, setCategory] = useState('rent');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('1');
  const [editFrequency, setEditFrequency] = useState('monthly');
  const [editCategory, setEditCategory] = useState('rent');

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBills();
      data.sort((a, b) => {
        const da = parseInt(a.due_date, 10) || 0;
        const db = parseInt(b.due_date, 10) || 0;
        return da - db;
      });
      setBills(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amt = parseFloat(amount);
    const dd = parseInt(dueDate, 10);

    if (!name.trim()) {
      setFormError('Name is required.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      setFormError('Amount must be greater than 0.');
      return;
    }
    if (isNaN(dd) || dd < 1 || dd > 31) {
      setFormError('Due date must be 1–31.');
      return;
    }

    setSubmitting(true);
    try {
      await createBill({
        name: name.trim(),
        amount: amt,
        due_date: dd,
        frequency,
        category,
      });
      setName('');
      setAmount('');
      setDueDate('1');
      await loadBills();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add bill.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteBill(id);
      await loadBills();
    } catch {
      // silently fail
    }
  };

  const startEdit = (bill: Bill) => {
    setEditingId(bill.id);
    setEditName(bill.name);
    setEditAmount(String(bill.amount));
    setEditDueDate(String(bill.due_date));
    setEditFrequency(bill.frequency);
    setEditCategory(bill.category);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id: number) => {
    const amt = parseFloat(editAmount);
    const dd = parseInt(editDueDate, 10);

    if (!editName.trim()) return;
    if (isNaN(amt) || amt <= 0) return;
    if (isNaN(dd) || dd < 1 || dd > 31) return;

    try {
      await updateBill(id, {
        name: editName.trim(),
        amount: amt,
        due_date: dd,
        frequency: editFrequency,
        category: editCategory,
      });
      setEditingId(null);
      await loadBills();
    } catch {
      // silently fail
    }
  };

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

  const btnSecondary: React.CSSProperties = {
    background: 'transparent',
    color: colors.primary,
    border: `1px solid ${colors.primary}`,
    borderRadius: 6,
    padding: '0.3rem 0.65rem',
    fontSize: '0.75rem',
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

  const smallInputStyle: React.CSSProperties = {
    ...inputStyle,
    padding: '0.35rem 0.5rem',
    fontSize: '0.82rem',
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
    listName: {
      margin: 0,
      fontSize: '0.95rem',
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
    listMeta: {
      margin: '0.15rem 0 0',
      fontSize: '0.8rem',
      color: colors.subtle,
    },
    listRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    editRow: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      padding: '0.75rem 0',
      borderBottom: `1px solid ${colors.border}`,
    },
    editFields: {
      display: 'flex',
      gap: '0.5rem',
      flexWrap: 'wrap',
    },
    editActions: {
      display: 'flex',
      gap: '0.5rem',
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
      {/* ── Bill Entry Form ───────────────────────────────────────── */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Add Bill</h2>
        {formError && <p style={styles.error}>{formError}</p>}
        <form onSubmit={handleSubmit} style={styles.formGrid}>
          <div>
            <label style={labelStyle} htmlFor="bill-name">Name</label>
            <input
              id="bill-name"
              type="text"
              placeholder="e.g. Rent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="bill-amount">Amount ($)</label>
            <input
              id="bill-amount"
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
            <label style={labelStyle} htmlFor="bill-due">Due Date (day)</label>
            <input
              id="bill-due"
              type="number"
              min="1"
              max="31"
              placeholder="15"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="bill-freq">Frequency</label>
            <select
              id="bill-freq"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              style={inputStyle}
            >
              {frequencies.map((f) => (
                <option key={f} value={f}>
                  {freqLabel[f] ?? f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="bill-cat">Category</label>
            <select
              id="bill-cat"
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
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" style={btnPrimary} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Bill'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Bill List ─────────────────────────────────────────────── */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Recurring Bills</h2>
        {loading ? (
          <div style={{ padding: '2rem 0', textAlign: 'center' }}>
            <Spinner />
          </div>
        ) : bills.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyText}>No bills added yet</p>
          </div>
        ) : (
          <div style={styles.list}>
            {bills.map((bill) =>
              editingId === bill.id ? (
                /* ── Edit Row ──────────────────────────────────── */
                <div key={bill.id} style={styles.editRow}>
                  <div style={styles.editFields}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={smallInputStyle}
                      placeholder="Name"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      style={{ ...smallInputStyle, width: 100 }}
                      placeholder="Amount"
                    />
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      style={{ ...smallInputStyle, width: 70 }}
                      placeholder="Day"
                    />
                    <select
                      value={editFrequency}
                      onChange={(e) => setEditFrequency(e.target.value)}
                      style={smallInputStyle}
                    >
                      {frequencies.map((f) => (
                        <option key={f} value={f}>
                          {freqLabel[f] ?? f}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      style={smallInputStyle}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.editActions}>
                    <button
                      style={btnPrimary}
                      onClick={() => handleUpdate(bill.id)}
                    >
                      Save
                    </button>
                    <button style={btnSecondary} onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Display Row ────────────────────────────────── */
                <div key={bill.id} style={styles.listItem}>
                  <div style={styles.listLeft}>
                    <p style={styles.listName}>
                      {bill.name}{' '}
                      <span
                        style={{
                          ...styles.badge,
                          background: getCatColor(bill.category) + '1A',
                          color: getCatColor(bill.category),
                        }}
                      >
                        {bill.category}
                      </span>
                    </p>
                    <p style={styles.listMeta}>
                      {formatCurrency(bill.amount)} &middot; Due{' '}
                      {getOrdinal(parseInt(bill.due_date, 10) || 0)}{' '}
                      &middot; {freqLabel[bill.frequency] ?? bill.frequency}
                    </p>
                  </div>
                  <div style={styles.listRight}>
                    <button
                      style={btnSecondary}
                      onClick={() => startEdit(bill)}
                    >
                      Edit
                    </button>
                    <button
                      style={btnDanger}
                      onClick={() => handleDelete(bill.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
