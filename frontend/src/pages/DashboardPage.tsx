import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchSafeToSpend, type SafeToSpendResponse, type IncomeVolatility } from '../api/safeToSpend';
import { fetchIncomeStats, fetchShifts, type IncomeStats, type Shift } from '../api/income';
import { fetchExpenses, type Expense } from '../api/expenses';
import { fetchUpcomingBills, type UpcomingBill } from '../api/bills';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ── Colors ────────────────────────────────────────────────────────────
const colors = {
  bg: '#f0f9f4',
  cardBg: '#ffffff',
  primary: '#2d8a5e',
  primaryLight: '#e8f5ee',
  text: '#1a2e23',
  subtle: '#5c7a68',
  border: '#d1e7dc',
  amber: '#e6a817',
  red: '#c0392b',
  green: '#2d8a5e',
  blue: '#2563eb',
  blueLight: '#eef2ff',
  amberLight: '#fffbeb',
};

// ── Helpers ───────────────────────────────────────────────────────────
const safeToSpendColor = (amount: number): string => {
  if (amount >= 20) return colors.green;
  if (amount >= 5) return colors.amber;
  return colors.red;
};

const bufferConfig: Record<number, { label: string; color: string; bg: string }> = {
  0.90: { label: '10% buffer', color: colors.green, bg: '#e8f5ee' },
  0.85: { label: '15% buffer', color: colors.blue, bg: colors.blueLight },
  0.75: { label: '25% buffer', color: colors.amber, bg: colors.amberLight },
};

const volatilityConfig: Record<IncomeVolatility, { label: string; color: string }> = {
  stable: { label: 'Stable', color: colors.green },
  moderate: { label: 'Moderate', color: colors.blue },
  volatile: { label: 'Volatile', color: colors.amber },
};

const categoryColors: Record<string, string> = {
  housing: '#2d8a5e',
  utilities: '#3a9d6a',
  food: '#e6a817',
  transportation: '#4a90d9',
  insurance: '#8e6ab7',
  healthcare: '#e0555a',
  entertainment: '#d97706',
  other: '#6b7280',
};

const getCategoryColor = (category: string): string => {
  return categoryColors[category.toLowerCase()] || categoryColors.other;
};

const formatCurrency = (amount: number): string => {
  return '$' + amount.toFixed(2);
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** Normalize the warnings from both `warnings` (array) and `warning` (string) fields. */
function getWarnings(
  details: SafeToSpendResponse['details'] | undefined
): string[] {
  if (!details) return [];
  if (details.warnings && details.warnings.length > 0) return details.warnings;
  if (details.warning) return [details.warning];
  return [];
}

// ── Sub-components ────────────────────────────────────────────────────

function Spinner({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: '3px solid #e0e0e0',
        borderTopColor: colors.primary,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        margin: '0 auto',
      }}
    />
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: React.ReactNode;
  icon: string;
}) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statIcon}>{icon}</span>
      <div>
        <p style={styles.statTitle}>{title}</p>
        <p style={styles.statValue}>{value}</p>
        {subtitle && <p style={styles.statSubtitle}>{subtitle}</p>}
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const bg = getCategoryColor(category);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: '0.72rem',
        fontWeight: 600,
        color: '#fff',
        backgroundColor: bg,
        textTransform: 'capitalize',
      }}
    >
      {category}
    </span>
  );
}

/** Small info tooltip rendered as a styled ? icon with title attribute. */
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

// ── Monthly aggregate helpers (client-side) ──────────────────────────

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

function getMonthKey(date: Date, offset: number): string {
  const d = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function computeMonthlyAggregates(
  shifts: Shift[],
  expenses: Expense[],
  monthsBack = 4
): MonthlyData[] {
  const now = new Date();
  const months: { entry: MonthlyData; key: string }[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = getMonthKey(now, -i);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months.push({ entry: { month: label, income: 0, expenses: 0 }, key });
  }

  for (const shift of shifts) {
    const m = shift.date.substring(0, 7);
    const found = months.find((e) => e.key === m);
    if (found) {
      found.entry.income += shift.hours_worked * shift.hourly_rate + shift.tips;
    }
  }

  for (const expense of expenses) {
    const m = expense.date.substring(0, 7);
    const found = months.find((e) => e.key === m);
    if (found) {
      found.entry.expenses += expense.amount;
    }
  }

  return months.map((m) => m.entry);
}

// ── Main Dashboard ────────────────────────────────────────────────────

export default function DashboardPage() {

  // State
  const [balanceInput, setBalanceInput] = useState('');
  const [queriedBalance, setQueriedBalance] = useState<number | null>(null);
  const [safeToSpendData, setSafeToSpendData] = useState<SafeToSpendResponse | null>(null);
  const [safeToSpendLoading, setSafeToSpendLoading] = useState(false);
  const [safeToSpendError, setSafeToSpendError] = useState<string | null>(null);

  const [incomeStats, setIncomeStats] = useState<IncomeStats | null>(null);
  const [upcomingBills, setUpcomingBills] = useState<UpcomingBill[]>([]);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  // Fetch safe-to-spend when balance is submitted
  const loadSafeToSpend = useCallback(async (balance: number) => {
    setSafeToSpendLoading(true);
    setSafeToSpendError(null);
    try {
      const data = await fetchSafeToSpend(balance);
      setSafeToSpendData(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load safe-to-spend data';
      setSafeToSpendError(msg);
    } finally {
      setSafeToSpendLoading(false);
    }
  }, []);

  const handleBalanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(balanceInput);
    if (!isNaN(parsed) && parsed >= 0) {
      setQueriedBalance(parsed);
      loadSafeToSpend(parsed);
    }
  };

  // Fetch ancillary data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [stats, bills, allShifts, allExpenses] = await Promise.all([
          fetchIncomeStats(),
          fetchUpcomingBills(),
          fetchShifts(),
          fetchExpenses(),
        ]);
        setIncomeStats(stats);
        setUpcomingBills(bills);
        setShifts(allShifts);
        setExpenses(allExpenses);
      } catch {
        // Silently handle — individual sections show empty states
      } finally {
        setChartLoading(false);
      }
    };
    loadData();
  }, []);

  // Compute chart data
  const chartData = useMemo(
    () => computeMonthlyAggregates(shifts, expenses, 4),
    [shifts, expenses]
  );

  // ── Derived data ────────────────────────────────────────────────────
  const details = safeToSpendData?.details;
  const allWarnings = getWarnings(details);
  // Separate "old" warnings from trend warnings
  const hasNoIncomeHistory = allWarnings.includes('no_income_history');
  const hasIncomeBelowBills = allWarnings.includes('income_below_bills');
  const trendingDown = allWarnings.includes('income_trending_down');
  const trendingUp = allWarnings.includes('income_trending_up');

  const safeToSpendAmount = safeToSpendData?.safeToSpend ?? 0;
  const safeAmountColor = safeToSpendColor(safeToSpendAmount);

  // Buffer badge config
  const bufferRate = details?.bufferRate ?? 0.85;
  const bufferInfo = bufferConfig[bufferRate] ?? bufferConfig[0.85];

  // Volatility indicator (only when there's actual income data — not no_income_history)
  const volatility = details?.incomeVolatility;
  const showVolatility = volatility && !hasNoIncomeHistory && details?.weightedAvgIncome !== undefined && details.weightedAvgIncome > 0;

  // Stats row: use safe-to-spend expectedPaycheckAmount when available
  const expectedPaycheck = safeToSpendData?.expectedPaycheckAmount;
  const nextPaycheckDate = safeToSpendData?.nextPaycheckDate;

  return (
        <div style={styles.container}>
          {/* ── Balance Input ────────────────────────────────────── */}
          <form onSubmit={handleBalanceSubmit} style={styles.balanceForm}>
            <label style={styles.balanceLabel} htmlFor="balance">
              Current Balance
            </label>
            <div style={styles.balanceRow}>
              <span style={styles.dollarSign}>$</span>
              <input
                id="balance"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                style={styles.balanceInput}
              />
              <button type="submit" style={styles.calculateBtn}>
                Calculate
              </button>
            </div>
          </form>

          {/* ── Safe-to-Spend Card ──────────────────────────────── */}
          <div style={styles.safeToSpendCard}>
            {safeToSpendLoading ? (
              <div style={styles.cardCenter}>
                <Spinner size={40} />
                <p style={styles.loadingText}>Calculating...</p>
              </div>
            ) : safeToSpendError ? (
              <div style={styles.cardCenter}>
                <p style={styles.errorText}>{safeToSpendError}</p>
                <button
                  style={styles.retryBtn}
                  onClick={() =>
                    queriedBalance != null && loadSafeToSpend(queriedBalance)
                  }
                >
                  Retry
                </button>
              </div>
            ) : safeToSpendData === null ? (
              <div style={styles.cardCenter}>
                <p style={styles.placeholderText}>
                  Enter your current balance above to calculate your daily
                  safe-to-spend amount.
                </p>
              </div>
            ) : hasNoIncomeHistory ? (
              <div style={styles.cardCenter}>
                <span style={styles.warningIcon}>📋</span>
                <p style={styles.warningTitle}>No Income History</p>
                <p style={styles.warningText}>
                  Add your first shift to calculate your safe-to-spend.
                </p>
              </div>
            ) : hasIncomeBelowBills ? (
              <>
                <p style={styles.safeToSpendLabel}>Safe to Spend</p>
                <div style={styles.safeToSpendRow}>
                  <p
                    style={{
                      ...styles.safeToSpendAmount,
                      color: colors.red,
                    }}
                  >
                    {formatCurrency(safeToSpendAmount)}
                    <span style={styles.perDay}>/day</span>
                  </p>
                  <span
                    title="Based on your income stability"
                    style={{
                      ...styles.bufferBadge,
                      color: bufferInfo.color,
                      background: bufferInfo.bg,
                    }}
                  >
                    {bufferInfo.label}
                  </span>
                </div>
                <div style={styles.warningBadge}>
                  ⚠️ Your upcoming bills exceed your balance. Consider reducing
                  expenses.
                </div>
              </>
            ) : (
              <>
                <p style={styles.safeToSpendLabel}>Safe to Spend</p>
                <div style={styles.safeToSpendRow}>
                  <p
                    style={{
                      ...styles.safeToSpendAmount,
                      color: safeAmountColor,
                    }}
                  >
                    {formatCurrency(safeToSpendAmount)}
                    <span style={styles.perDay}>/day</span>
                  </p>
                  <span
                    title="Based on your income stability"
                    style={{
                      ...styles.bufferBadge,
                      color: bufferInfo.color,
                      background: bufferInfo.bg,
                    }}
                  >
                    {bufferInfo.label}
                    <InfoTooltip text="Based on your income stability" />
                  </span>
                </div>
                <p style={styles.safeToSpendSubtitle}>
                  You can safely spend this much per day until your next
                  paycheck
                </p>
              </>
            )}
          </div>

          {/* ── Trend Warnings ──────────────────────────────────────── */}
          {trendingDown && (
            <div style={styles.trendDownBanner}>
              ⚠️ Your recent income is significantly lower than usual. Be extra cautious.
            </div>
          )}
          {trendingUp && (
            <div style={styles.trendUpNote}>
              Your income is trending up — great job!
            </div>
          )}

          {/* ── Income Volatility Indicator ──────────────────────────── */}
          {showVolatility && (
            <div style={styles.volatilityRow}>
              <span style={styles.volatilityLabel}>Income:</span>
              <span
                style={{
                  ...styles.volatilityValue,
                  color: volatilityConfig[volatility!].color,
                }}
              >
                {volatilityConfig[volatility!].label}
              </span>
            </div>
          )}

          {/* ── Quick Stats Row ─────────────────────────────────── */}
          {incomeStats && (
            <div style={styles.statsRow}>
              <StatCard
                icon="💰"
                title="Next Paycheck"
                value={
                  expectedPaycheck !== undefined && expectedPaycheck > 0
                    ? formatCurrency(expectedPaycheck)
                    : '—'
                }
                subtitle={
                  <>
                    {nextPaycheckDate
                      ? formatDate(nextPaycheckDate)
                      : undefined}
                    {expectedPaycheck !== undefined && expectedPaycheck > 0 && (
                      <span style={styles.weightedLabel}>weighted</span>
                    )}
                  </>
                }
              />
              <StatCard
                icon="📅"
                title="Upcoming Bills"
                value={
                  upcomingBills.length > 0
                    ? upcomingBills.length + ' bill' + (upcomingBills.length !== 1 ? 's' : '')
                    : 'None'
                }
                subtitle={
                  upcomingBills.length > 0
                    ? formatCurrency(
                        upcomingBills.reduce((sum, b) => sum + b.amount, 0)
                      )
                    : undefined
                }
              />
              <StatCard
                icon="📊"
                title="Monthly Income"
                value={formatCurrency(incomeStats.total_this_month)}
                subtitle={incomeStats.shift_count + ' shift' + (incomeStats.shift_count !== 1 ? 's' : '') + ' logged'}
              />
            </div>
          )}

          {/* ── Upcoming Bills List ─────────────────────────────── */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Upcoming Bills</h2>
            {upcomingBills.length === 0 ? (
              <div style={styles.emptyCard}>
                <p style={styles.emptyText}>
                  No bills due before your next paycheck.
                </p>
              </div>
            ) : (
              <div style={styles.billList}>
                {upcomingBills.map((bill) => (
                  <div key={bill.id} style={styles.billItem}>
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
                      <CategoryBadge category={bill.category} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Income vs Expenses Chart ─────────────────────────── */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Income vs Expenses</h2>
            <div style={styles.chartCard}>
              {chartLoading ? (
                <div style={styles.cardCenter}>
                  <Spinner />
                </div>
              ) : chartData.every((d) => d.income === 0 && d.expenses === 0) ? (
                <div style={styles.cardCenter}>
                  <p style={styles.emptyText}>
                    No data yet. Add shifts and expenses to see your trends.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5c7a68' }} />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#5c7a68' }}
                      tickFormatter={(v: number) => '$' + v}
                    />
                    <Tooltip
                      formatter={(value: unknown) => ['$' + Number(value).toFixed(2), undefined] as [string, undefined]}
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #d1e7dc',
                        fontSize: 13,
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="income"
                      name="Income"
                      fill={colors.primary}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="expenses"
                      name="Expenses"
                      fill="#e6a817"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: colors.bg,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.85rem 1.5rem',
    background: colors.cardBg,
    borderBottom: '1px solid ' + colors.border,
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  headerTitle: {
    margin: 0,
    fontSize: '1.3rem',
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
    padding: '0.4rem 0.9rem',
    borderRadius: 6,
    border: '1.5px solid ' + colors.border,
    background: '#fff',
    color: colors.text,
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },

  main: {
    padding: '1.5rem',
  },
  container: {
    maxWidth: 820,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },

  // Balance form
  balanceForm: {
    background: colors.cardBg,
    borderRadius: 12,
    padding: '1.25rem 1.5rem',
    boxShadow: '0 1px 4px rgba(45, 138, 94, 0.06)',
  },
  balanceLabel: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: colors.subtle,
    marginBottom: '0.5rem',
  },
  balanceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  dollarSign: {
    fontSize: '1.2rem',
    fontWeight: 600,
    color: colors.subtle,
  },
  balanceInput: {
    flex: 1,
    padding: '0.55rem 0.75rem',
    borderRadius: 8,
    border: '1.5px solid ' + colors.border,
    fontSize: '1rem',
    color: colors.text,
    outline: 'none',
    background: '#fff',
    maxWidth: 220,
  },
  calculateBtn: {
    padding: '0.55rem 1.25rem',
    borderRadius: 8,
    border: 'none',
    background: colors.primary,
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },

  // Safe-to-spend card
  safeToSpendCard: {
    background: colors.cardBg,
    borderRadius: 14,
    padding: '2rem 1.5rem',
    boxShadow: '0 2px 12px rgba(45, 138, 94, 0.1)',
    border: '2px solid ' + colors.primaryLight,
    textAlign: 'center',
    minHeight: 140,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  cardCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  safeToSpendLabel: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: colors.subtle,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  safeToSpendRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    margin: '0.25rem 0 0',
  },
  safeToSpendAmount: {
    margin: 0,
    fontSize: '2.75rem',
    fontWeight: 800,
    lineHeight: 1.1,
  },
  perDay: {
    fontSize: '1rem',
    fontWeight: 500,
    color: colors.subtle,
    marginLeft: '0.25rem',
  },
  bufferBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.15rem',
    padding: '0.2rem 0.6rem',
    borderRadius: 20,
    fontSize: '0.72rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  safeToSpendSubtitle: {
    margin: '0.4rem 0 0',
    fontSize: '0.88rem',
    color: colors.subtle,
    maxWidth: 320,
    alignSelf: 'center',
  },
  loadingText: {
    margin: 0,
    fontSize: '0.9rem',
    color: colors.subtle,
  },
  errorText: {
    margin: 0,
    fontSize: '0.9rem',
    color: colors.red,
  },
  retryBtn: {
    padding: '0.4rem 1rem',
    borderRadius: 6,
    border: '1.5px solid ' + colors.border,
    background: '#fff',
    color: colors.text,
    fontSize: '0.85rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  placeholderText: {
    margin: 0,
    fontSize: '0.9rem',
    color: colors.subtle,
    maxWidth: 300,
  },
  warningIcon: {
    fontSize: '2rem',
  },
  warningTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 700,
    color: colors.text,
  },
  warningText: {
    margin: '0.25rem 0 0',
    fontSize: '0.9rem',
    color: colors.subtle,
  },
  warningBadge: {
    marginTop: '0.75rem',
    padding: '0.6rem 1rem',
    borderRadius: 8,
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '0.85rem',
    fontWeight: 500,
    maxWidth: 400,
    alignSelf: 'center',
  },

  // Trend warnings
  trendDownBanner: {
    padding: '0.75rem 1rem',
    borderRadius: 10,
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '0.88rem',
    fontWeight: 500,
    textAlign: 'center' as const,
  },
  trendUpNote: {
    padding: '0.5rem 1rem',
    borderRadius: 10,
    background: colors.primaryLight,
    color: colors.primary,
    fontSize: '0.85rem',
    fontWeight: 500,
    textAlign: 'center' as const,
  },

  // Income volatility indicator
  volatilityRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.4rem 0',
  },
  volatilityLabel: {
    fontSize: '0.82rem',
    fontWeight: 500,
    color: colors.subtle,
  },
  volatilityValue: {
    fontSize: '0.82rem',
    fontWeight: 700,
  },

  // Weighted label for Next Paycheck
  weightedLabel: {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: 500,
    color: colors.subtle,
    fontStyle: 'italic',
    marginTop: '0.15rem',
  },

  // Stats row
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  },
  statCard: {
    background: colors.cardBg,
    borderRadius: 12,
    padding: '1.25rem',
    boxShadow: '0 1px 4px rgba(45, 138, 94, 0.06)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  statIcon: {
    fontSize: '1.5rem',
    lineHeight: 1,
  },
  statTitle: {
    margin: 0,
    fontSize: '0.8rem',
    fontWeight: 600,
    color: colors.subtle,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  statValue: {
    margin: '0.2rem 0 0',
    fontSize: '1.25rem',
    fontWeight: 700,
    color: colors.text,
  },
  statSubtitle: {
    margin: '0.15rem 0 0',
    fontSize: '0.78rem',
    color: colors.subtle,
  },

  // Sections
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 700,
    color: colors.text,
  },

  // Bills list
  emptyCard: {
    background: colors.cardBg,
    borderRadius: 12,
    padding: '2rem 1.5rem',
    boxShadow: '0 1px 4px rgba(45, 138, 94, 0.06)',
    textAlign: 'center',
  },
  emptyText: {
    margin: 0,
    fontSize: '0.9rem',
    color: colors.subtle,
  },
  billList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  billItem: {
    background: colors.cardBg,
    borderRadius: 10,
    padding: '1rem 1.25rem',
    boxShadow: '0 1px 4px rgba(45, 138, 94, 0.06)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  billLeft: {
    display: 'flex',
    flexDirection: 'column',
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

  // Chart
  chartCard: {
    background: colors.cardBg,
    borderRadius: 12,
    padding: '1.5rem 1rem',
    boxShadow: '0 1px 4px rgba(45, 138, 94, 0.06)',
    minHeight: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
