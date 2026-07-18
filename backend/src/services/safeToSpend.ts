/**
 * Safe-to-Spend Calculator
 *
 * Pure function that computes a safe daily spending amount based on
 * current balance, upcoming bills, and expected income.
 */

export type IncomeVolatility = 'stable' | 'moderate' | 'volatile';

export interface SafeToSpendDetails {
  daysUntilPaycheck: number;
  totalBillsDue: number;
  availableAfterBills: number;
  dailyAmount: number;
  bufferRate: number;
  billsConsidered: number;
  warnings: string[];
  /** @deprecated use warnings array; kept for backward compatibility */
  warning: string | null;
  incomeVolatility: IncomeVolatility;
  weightedAvgIncome: number;
}

export interface CalculateSafeToSpendParams {
  currentBalance: number;
  upcomingBills: Array<{ amount: number; projected_due_date: string }>;
  nextPaycheckDate: string;
  expectedPaycheckAmount: number;
  /** Array of weekly earnings for the last 8 weeks (most recent first). Used for volatility calculation. */
  incomeHistory?: number[];
}

/**
 * Calculate the coefficient of variation (CV = stdDev / mean).
 * Returns 0 if mean is 0 (no variation detectable).
 */
function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Map coefficient of variation to a buffer rate.
 * - CV < 0.2 (stable income) → bufferRate = 0.90 (10% buffer)
 * - CV 0.2–0.5 (moderate) → bufferRate = 0.85 (15% buffer)
 * - CV > 0.5 (volatile) → bufferRate = 0.75 (25% buffer)
 */
function cvToBufferRate(cv: number): { bufferRate: number; incomeVolatility: IncomeVolatility } {
  if (cv < 0.2) {
    return { bufferRate: 0.90, incomeVolatility: 'stable' };
  }
  if (cv <= 0.5) {
    return { bufferRate: 0.85, incomeVolatility: 'moderate' };
  }
  return { bufferRate: 0.75, incomeVolatility: 'volatile' };
}

export function calculateSafeToSpend(
  params: CalculateSafeToSpendParams
): { safeToSpend: number; details: SafeToSpendDetails } {
  const {
    currentBalance,
    upcomingBills,
    nextPaycheckDate,
    expectedPaycheckAmount,
    incomeHistory,
  } = params;

  // ── Volatility-aware buffer rate ──────────────────────────────────
  let bufferRate = 0.85;
  let incomeVolatility: IncomeVolatility = 'moderate';

  if (incomeHistory && incomeHistory.length >= 2) {
    const cv = coefficientOfVariation(incomeHistory);
    const result = cvToBufferRate(cv);
    bufferRate = result.bufferRate;
    incomeVolatility = result.incomeVolatility;
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 1. Compute days until next paycheck
  const nextPaycheck = new Date(nextPaycheckDate);
  const diffMs = nextPaycheck.getTime() - today.getTime();
  let daysUntilPaycheck = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  // Fallback: if paycheck is today or in the past, use 7 days
  if (daysUntilPaycheck <= 0) {
    daysUntilPaycheck = 7;
  }

  // 2. Filter and sum bills due before next paycheck
  const billsInWindow = upcomingBills.filter(
    (bill) => bill.projected_due_date >= todayStr && bill.projected_due_date <= nextPaycheckDate
  );
  const totalBillsDue = billsInWindow.reduce((sum, bill) => sum + bill.amount, 0);

  // 3. Available after bills
  const availableAfterBills = currentBalance - totalBillsDue;

  // 4 & 5. Determine warning and safe-to-spend
  let safeToSpend: number;
  const warnings: string[] = [];

  if (availableAfterBills < 0) {
    safeToSpend = 0;
    warnings.push('income_below_bills');
  } else {
    // 5. Daily amount = availableAfterBills / daysUntilPaycheck
    const dailyAmount = availableAfterBills / daysUntilPaycheck;

    // 6. Apply buffer
    safeToSpend = Math.round(dailyAmount * bufferRate * 100) / 100;

    // Never negative
    if (safeToSpend < 0) {
      safeToSpend = 0;
    }
  }

  const dailyAmountBeforeBuffer = availableAfterBills >= 0
    ? Math.round((availableAfterBills / daysUntilPaycheck) * 100) / 100
    : 0;

  const details: SafeToSpendDetails = {
    daysUntilPaycheck,
    totalBillsDue: Math.round(totalBillsDue * 100) / 100,
    availableAfterBills: Math.round(availableAfterBills * 100) / 100,
    dailyAmount: dailyAmountBeforeBuffer,
    bufferRate,
    billsConsidered: billsInWindow.length,
    warnings,
    warning: warnings.length > 0 ? warnings[0] : null,
    incomeVolatility,
    weightedAvgIncome: expectedPaycheckAmount,
  };

  return { safeToSpend, details };
}
