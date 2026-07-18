import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchAlerts, type BillAlert } from '../api/alerts';
import { fetchSafeToSpend, type SafeToSpendResponse } from '../api/safeToSpend';
import { useThemeStyles } from '../hooks/useThemeStyles';

const formatCurrency = (amount: number): string => {
  return '$' + amount.toFixed(2);
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const safeToSpendColor = (amount: number, colors: { green: string; amber: string; red: string }): string => {
  if (amount >= 20) return colors.green;
  if (amount >= 5) return colors.amber;
  return colors.red;
};

export default function EmergencyPage() {
  const colors = useThemeStyles();

  const [alerts, setAlerts] = useState<BillAlert[]>([]);
  const [safeToSpendData, setSafeToSpendData] = useState<SafeToSpendResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [alertsData, stsData] = await Promise.all([
          fetchAlerts(),
          fetchSafeToSpend(0).catch(() => null),
        ]);
        setAlerts(alertsData.alerts);
        setSafeToSpendData(stsData);
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const imminentBills = useMemo(() => {
    return alerts
      .filter((a) => a.type === 'IMMINENT_BILL' && a.bill)
      .map((a) => a.bill!);
  }, [alerts]);

  const totalDueNow = useMemo(() => {
    return imminentBills.reduce((sum, b) => sum + b.amount, 0);
  }, [imminentBills]);

  const safeToSpendAmount = safeToSpendData?.safeToSpend ?? 0;

  const actionPrompt = useMemo(() => {
    if (safeToSpendData === null) return null;
    if (safeToSpendAmount <= 0) {
      return 'Contact these bill providers about payment extensions';
    }
    if (safeToSpendAmount < 5) {
      return 'Consider skipping or reducing non-essential spending';
    }
    return null;
  }, [safeToSpendData, safeToSpendAmount]);

  // ── Styles ──────────────────────────────────────────────────
  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: '100vh',
      background: colors.errorBg,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.85rem 1.5rem',
      background: colors.cardBg,
      borderBottom: `3px solid ${colors.red}`,
      flexWrap: 'wrap' as const,
      gap: '0.75rem',
    },
    headerTitle: {
      margin: 0,
      fontSize: '1.3rem',
      fontWeight: 800,
      color: colors.red,
    },
    backLink: {
      fontSize: '0.85rem',
      fontWeight: 600,
      color: colors.primary,
      textDecoration: 'none',
      padding: '0.35rem 0.75rem',
      borderRadius: 6,
      border: `1.5px solid ${colors.border}`,
      background: colors.cardBg,
    },
    main: {
      padding: '1.5rem',
    },
    container: {
      maxWidth: 640,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '1.25rem',
    },
    spinnerContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '0.75rem',
    },
    spinner: {
      width: 40,
      height: 40,
      border: `4px solid ${colors.border}`,
      borderTop: `4px solid ${colors.red}`,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    },
    loadingText: {
      margin: 0,
      fontSize: '0.9rem',
      color: colors.subtle,
    },
    totalCard: {
      background: colors.errorBg,
      borderRadius: 14,
      padding: '2rem 1.5rem',
      border: `3px solid ${colors.red}`,
      textAlign: 'center' as const,
    },
    totalLabel: {
      margin: 0,
      fontSize: '0.95rem',
      fontWeight: 600,
      color: colors.errorText,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    totalAmount: {
      margin: '0.25rem 0 0',
      fontSize: '3rem',
      fontWeight: 800,
      color: colors.errorText,
      lineHeight: 1.1,
    },
    section: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0.75rem',
    },
    sectionTitle: {
      margin: 0,
      fontSize: '1.1rem',
      fontWeight: 700,
      color: colors.text,
    },
    billList: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0.5rem',
    },
    billCard: {
      background: colors.cardBg,
      borderRadius: 10,
      padding: '1rem 1.25rem',
      boxShadow: `0 1px 4px ${colors.primaryLight}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap' as const,
      gap: '0.5rem',
    },
    billLeft: {
      display: 'flex',
      flexDirection: 'column' as const,
    },
    billName: {
      margin: 0,
      fontSize: '0.95rem',
      fontWeight: 600,
      color: colors.text,
    },
    billDate: {
      margin: '0.15rem 0 0',
      fontSize: '0.8rem',
      color: colors.subtle,
    },
    billRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    },
    billAmount: {
      margin: 0,
      fontSize: '1rem',
      fontWeight: 700,
      color: colors.text,
    },
    emptyCard: {
      background: colors.cardBg,
      borderRadius: 12,
      padding: '2rem 1.5rem',
      boxShadow: `0 1px 4px ${colors.primaryLight}`,
      textAlign: 'center' as const,
    },
    emptyText: {
      margin: 0,
      fontSize: '0.9rem',
      color: colors.subtle,
    },
    actionCard: {
      background: colors.blueLight,
      borderRadius: 10,
      padding: '1rem 1.25rem',
      border: `2px solid ${colors.blue}`,
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    },
    actionIcon: {
      fontSize: '1.4rem',
      lineHeight: 1,
      flexShrink: 0,
    },
    actionText: {
      margin: 0,
      fontSize: '0.9rem',
      fontWeight: 600,
      color: colors.blue,
    },
    stsMiniCard: {
      background: colors.cardBg,
      borderRadius: 12,
      padding: '1rem 1.25rem',
      boxShadow: `0 1px 4px ${colors.primaryLight}`,
      textAlign: 'center' as const,
    },
    stsMiniLabel: {
      margin: 0,
      fontSize: '0.8rem',
      fontWeight: 600,
      color: colors.subtle,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.03em',
    },
    stsMiniAmount: {
      margin: '0.15rem 0 0',
      fontSize: '1.6rem',
      fontWeight: 800,
    },
    stsMiniPerDay: {
      fontSize: '0.8rem',
      fontWeight: 500,
      color: colors.subtle,
      marginLeft: '0.2rem',
    },
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.spinnerContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading emergency data...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>🚨 Emergency Mode</h1>
        <Link to="/" style={styles.backLink}>
          ← Back to Dashboard
        </Link>
      </header>

      <main style={styles.main}>
        <div style={styles.container}>
          <div style={styles.totalCard}>
            <p style={styles.totalLabel}>You owe in the next 3 days</p>
            <p style={styles.totalAmount}>
              {formatCurrency(totalDueNow)}
            </p>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>
              Bills Due in the Next 3 Days
            </h2>
            {imminentBills.length === 0 ? (
              <div style={styles.emptyCard}>
                <p style={styles.emptyText}>
                  No bills due in the next 3 days.
                </p>
              </div>
            ) : (
              <div style={styles.billList}>
                {imminentBills.map((bill) => (
                  <div key={bill.id} style={styles.billCard}>
                    <div style={styles.billLeft}>
                      <p style={styles.billName}>{bill.name}</p>
                      <p style={styles.billDate}>
                        Due {formatDate(bill.projected_due_date)}
                      </p>
                    </div>
                    <div style={styles.billRight}>
                      <p style={styles.billAmount}>
                        {formatCurrency(bill.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {actionPrompt && (
            <div style={styles.actionCard}>
              <span style={styles.actionIcon}>💡</span>
              <p style={styles.actionText}>{actionPrompt}</p>
            </div>
          )}

          {safeToSpendData !== null && (
            <div style={styles.stsMiniCard}>
              <p style={styles.stsMiniLabel}>Daily Safe-to-Spend</p>
              <p
                style={{
                  ...styles.stsMiniAmount,
                  color: safeToSpendColor(safeToSpendAmount, colors),
                }}
              >
                {formatCurrency(safeToSpendAmount)}
                <span style={styles.stsMiniPerDay}>/day</span>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
