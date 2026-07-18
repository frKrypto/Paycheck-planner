/**
 * Safe-to-Spend Calculator
 *
 * Pure function that computes a safe daily spending amount based on
 * current balance, upcoming bills, and expected income.
 */

export interface SafeToSpendDetails {
  daysUntilPaycheck: number;
  totalBillsDue: number;
  availableAfterBills: number;
  dailyAmount: number;
  bufferRate: number;
  billsConsidered: number;
  warning: string | null;
}

export interface CalculateSafeToSpendParams {
  currentBalance: number;
  upcomingBills: Array<{ amount: number; projected_due_date: string }>;
  nextPaycheckDate: string;
  expectedPaycheckAmount: number;
  /** Buffer multiplier, defaults to 0.85 (keep 15% buffer) */
  bufferRate?: number;
}

export function calculateSafeToSpend(
  params: CalculateSafeToSpendParams
): { safeToSpend: number; details: SafeToSpendDetails } {
  const {
    currentBalance,
    upcomingBills,
    nextPaycheckDate,
    expectedPaycheckAmount,
    bufferRate = 0.85,
  } = params;

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
  let warning: string | null = null;

  if (expectedPaycheckAmount === 0 && upcomingBills.length === 0) {
    // No income history and no bills — could go either way.
    // Treat as no_income_history since we have no baseline.
    // Actually, let's check: if there truly are no shifts at all...
    // We'll handle the "no_income_history" case in the route layer.
    // Here we just compute what we can.
  }

  if (availableAfterBills < 0) {
    safeToSpend = 0;
    warning = 'income_below_bills';
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
    warning,
  };

  return { safeToSpend, details };
}
