import { useState, useEffect, useCallback } from 'react';
import {
  fetchShifts,
  fetchIncomeStats,
  createShift,
  deleteShift,
  type Shift,
  type IncomeStats,
} from '../api/income';
import { useThemeStyles } from '../hooks/useThemeStyles';

// ── Helpers ───────────────────────────────────────────────────────────
const formatCurrency = (amount: number): string => '$' + amount.toFixed(2);
const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ── IncomePage ────────────────────────────────────────────────────────
export default function IncomePage() {
  const colors = useThemeStyles();

  // Sub-components
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

  function InfoTooltip({ text }: { text: string }) {
    return (
      <span
        title={text}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: colors.border,
          color: colors.subtle,
          fontSize: '0.65rem',
          fontWeight: 700,
          cursor: 'help',
          marginLeft: 4,
          lineHeight: 1,
        }}
      >
        ?
      </span>
    );
  }

  // Stats
  const [stats, setStats] = useState<IncomeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Shifts
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);

  // Form
  const [date, setDate] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [tips, setTips] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [s, sh] = await Promise.all([fetchIncomeStats(), fetchShifts()]);
      setStats(s);
      setShifts(sh);
    } catch {
      // silently fail — lists show empty
    } finally {
      setStatsLoading(false);
      setShiftsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const hours = parseFloat(hoursWorked);
    const rate = parseFloat(hourlyRate);

    if (!date) {
      setFormError('Date is required.');
      return;
    }
    if (isNaN(hours) || hours <= 0) {
      setFormError('Hours worked must be greater than 0.');
      return;
    }
    if (isNaN(rate) || rate <= 0) {
      setFormError('Hourly rate must be greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      await createShift({
        date,
        hours_worked: hours,
        hourly_rate: rate,
        tips: tips ? parseFloat(tips) : undefined,
        overtime_hours: overtimeHours ? parseFloat(overtimeHours) : undefined,
      });
      setDate('');
      setHoursWorked('');
      setHourlyRate('');
      setTips('');
      setOvertimeHours('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to log shift.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteShift(id);
      await loadData();
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
    statsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '1rem',
      marginBottom: '1.5rem',
    },
    statCard: {
      background: colors.cardBg,
      borderRadius: 10,
      padding: '1rem 1.25rem',
      boxShadow: `0 1px 4px ${colors.primaryLight}`,
    },
    statLabel: {
      margin: 0,
      fontSize: '0.78rem',
      fontWeight: 600,
      color: colors.subtle,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    },
    statValuePrimary: {
      margin: '0.3rem 0 0',
      fontSize: '1.35rem',
      fontWeight: 700,
      color: colors.text,
    },
    statSub: {
      margin: '0.15rem 0 0',
      fontSize: '0.78rem',
      color: colors.subtle,
    },
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
      padding: '0.85rem 1rem',
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
    listDetail: {
      margin: '0.15rem 0 0',
      fontSize: '0.78rem',
      color: colors.subtle,
    },
    listRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    },
    listTotal: {
      margin: 0,
      fontSize: '1rem',
      fontWeight: 700,
      color: colors.primary,
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
      {/* ── Income Stats ──────────────────────────────────────────── */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>
            Weighted 4-Week Average
            <InfoTooltip text="Recent shifts count more toward this estimate" />
          </p>
          <p style={styles.statValuePrimary}>
            {statsLoading ? (
              <Spinner size={20} />
            ) : (
              formatCurrency(stats?.weighted_4wk_avg ?? 0)
            )}
          </p>
          {!statsLoading && (
            <p style={styles.statSub}>
              Simple avg: {formatCurrency(stats?.rolling_4wk_avg ?? 0)}
            </p>
          )}
        </div>

        <div style={styles.statCard}>
          <p style={styles.statLabel}>This Month</p>
          <p style={styles.statValuePrimary}>
            {statsLoading ? (
              <Spinner size={20} />
            ) : (
              formatCurrency(stats?.total_this_month ?? 0)
            )}
          </p>
          {!statsLoading && stats && (
            <p style={styles.statSub}>{stats.shift_count} shift{stats.shift_count !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* ── Shift Logging Form ────────────────────────────────────── */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Log a Shift</h2>
        {formError && <p style={styles.error}>{formError}</p>}
        <form onSubmit={handleSubmit} style={styles.formGrid}>
          <div>
            <label style={labelStyle} htmlFor="shift-date">Date</label>
            <input
              id="shift-date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="shift-hours">Hours Worked</label>
            <input
              id="shift-hours"
              type="number"
              step="0.25"
              min="0"
              placeholder="e.g. 8"
              value={hoursWorked}
              onChange={(e) => setHoursWorked(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="shift-rate">Hourly Rate ($)</label>
            <input
              id="shift-rate"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 18.50"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="shift-tips">Tips ($, optional)</label>
            <input
              id="shift-tips"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="shift-ot">Overtime Hours (optional)</label>
            <input
              id="shift-ot"
              type="number"
              step="0.25"
              min="0"
              placeholder="0"
              value={overtimeHours}
              onChange={(e) => setOvertimeHours(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" style={btnPrimary} disabled={submitting}>
              {submitting ? 'Logging...' : 'Log Shift'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Shift History ─────────────────────────────────────────── */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>Shift History</h2>
        {shiftsLoading ? (
          <div style={{ padding: '2rem 0', textAlign: 'center' }}>
            <Spinner />
          </div>
        ) : shifts.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyText}>No shifts logged yet</p>
          </div>
        ) : (
          <div style={styles.list}>
            {shifts.map((shift) => {
              const total = shift.hours_worked * shift.hourly_rate + (shift.tips ?? 0);
              return (
                <div key={shift.id} style={styles.listItem}>
                  <div style={styles.listLeft}>
                    <p style={styles.listDate}>{formatDate(shift.date)}</p>
                    <p style={styles.listDetail}>
                      {shift.hours_worked}h × {formatCurrency(shift.hourly_rate)}/hr
                      {shift.overtime_hours > 0 && ` + ${shift.overtime_hours}h OT`}
                      {shift.tips > 0 && ` + ${formatCurrency(shift.tips)} tips`}
                    </p>
                  </div>
                  <div style={styles.listRight}>
                    <p style={styles.listTotal}>{formatCurrency(total)}</p>
                    <button
                      style={btnDanger}
                      onClick={() => handleDelete(shift.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
