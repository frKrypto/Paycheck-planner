import { computeNextPaycheck, computeProjectedDueDate } from './dateUtils';

export interface BillAlert {
  type: 'IMMINENT_BILL' | 'LOW_SAFE_TO_SPEND' | 'BILL_DUE_BEFORE_PAYCHECK' | 'BILL_INCREASE' | 'SUBSCRIPTION_REVIEW';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  bill?: {
    id: number;
    name: string;
    amount: number;
    due_date: string;
    projected_due_date: string;
  };
  percentIncrease?: number;
  subscriptionCount?: number;
  totalMonthly?: number;
}

export interface GenerateAlertsInput {
  bills: Array<{
    id: number;
    name: string;
    amount: number;
    due_date: string;
    frequency: string;
    category: string;
    last_reviewed_at?: string | null;
  }>;
  weightedWeeklyIncome: number;
  paySchedule: string;
  today?: Date;
  billHistory?: Array<{ bill_id: number; amount: number; recorded_at: string }>;
}

export function generateAlerts(input: GenerateAlertsInput): BillAlert[] {
  const today = input.today || new Date();
  const todayStr = toDateStr(today);

  const threeDaysFromNow = addDays(today, 3);
  const threeDaysStr = toDateStr(threeDaysFromNow);

  const sevenDaysFromNow = addDays(today, 7);
  const sevenDaysStr = toDateStr(sevenDaysFromNow);

  const nextPaycheck = computeNextPaycheck(input.paySchedule, today);
  const nextPaycheckStr = toDateStr(nextPaycheck);

  const alerts: BillAlert[] = [];

  // Compute projected due dates for all bills
  const billsWithProjected = input.bills.map((bill) => ({
    ...bill,
    projected_due_date: computeProjectedDueDate(
      parseInt(bill.due_date, 10),
      today
    ),
  }));

  // ── IMMINENT_BILL ──────────────────────────────────────────────
  const imminentBills = billsWithProjected.filter(
    (b) =>
      b.projected_due_date >= todayStr &&
      b.projected_due_date <= threeDaysStr
  );

  for (const bill of imminentBills) {
    const incomeThreshold = input.weightedWeeklyIncome * 0.5;
    const isCritical =
      input.weightedWeeklyIncome > 0 && bill.amount > incomeThreshold;

    alerts.push({
      type: 'IMMINENT_BILL',
      severity: isCritical ? 'critical' : 'warning',
      title: isCritical
        ? `Critical: ${bill.name} due soon`
        : `Bill due: ${bill.name}`,
      message: isCritical
        ? `${bill.name} ($${bill.amount.toFixed(2)}) is due on ${bill.projected_due_date} — this is a large expense relative to your income.`
        : `${bill.name} ($${bill.amount.toFixed(2)}) is due on ${bill.projected_due_date}.`,
      bill: {
        id: bill.id,
        name: bill.name,
        amount: bill.amount,
        due_date: bill.due_date,
        projected_due_date: bill.projected_due_date,
      },
    });
  }

  // ── LOW_SAFE_TO_SPEND ─────────────────────────────────────────
  if (input.weightedWeeklyIncome > 0) {
    const billsInWeek = billsWithProjected.filter(
      (b) =>
        b.projected_due_date >= todayStr &&
        b.projected_due_date <= sevenDaysStr
    );
    const weekBillsTotal = billsInWeek.reduce(
      (sum, b) => sum + b.amount,
      0
    );

    if (weekBillsTotal > input.weightedWeeklyIncome) {
      alerts.push({
        type: 'LOW_SAFE_TO_SPEND',
        severity: 'critical',
        title: 'Bills exceed expected income',
        message: 'Your upcoming bills exceed your expected income',
      });
    } else if (weekBillsTotal > input.weightedWeeklyIncome * 0.8) {
      alerts.push({
        type: 'LOW_SAFE_TO_SPEND',
        severity: 'warning',
        title: 'Bills eating most of your income',
        message: 'Your upcoming bills are eating most of your income',
      });
    }
  }

  // ── BILL_DUE_BEFORE_PAYCHECK ──────────────────────────────────
  const billsBeforePaycheck = billsWithProjected.filter(
    (b) =>
      b.projected_due_date >= todayStr &&
      b.projected_due_date < nextPaycheckStr
  );

  for (const bill of billsBeforePaycheck) {
    alerts.push({
      type: 'BILL_DUE_BEFORE_PAYCHECK',
      severity: 'critical',
      title: `Bill due before paycheck: ${bill.name}`,
      message: `${bill.name} ($${bill.amount.toFixed(2)}) is due on ${bill.projected_due_date}, before your next paycheck on ${nextPaycheckStr}.`,
      bill: {
        id: bill.id,
        name: bill.name,
        amount: bill.amount,
        due_date: bill.due_date,
        projected_due_date: bill.projected_due_date,
      },
    });
  }

  // ── BILL_INCREASE ─────────────────────────────────────────────
  if (input.billHistory && input.billHistory.length > 0) {
    for (const bill of input.bills) {
      // Find the most recent previous amount for this bill
      const historyForBill = input.billHistory
        .filter((h) => h.bill_id === bill.id)
        .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));

      const previous = historyForBill[0];
      if (previous && previous.amount > 0 && bill.amount > previous.amount * 1.1) {
        const percentIncrease = Math.round(
          ((bill.amount - previous.amount) / previous.amount) * 100
        );
        alerts.push({
          type: 'BILL_INCREASE',
          severity: 'warning',
          title: 'Bill increase detected',
          message: `${bill.name} increased from $${previous.amount.toFixed(2)} to $${bill.amount.toFixed(2)}`,
          bill: {
            id: bill.id,
            name: bill.name,
            amount: bill.amount,
            due_date: bill.due_date,
            projected_due_date: billsWithProjected.find(
              (b) => b.id === bill.id
            )!.projected_due_date,
          },
          percentIncrease,
        });
      }
    }
  }

  // ── SUBSCRIPTION_REVIEW ───────────────────────────────────────
  const subscriptions = input.bills.filter(
    (b) => b.category === 'subscriptions'
  );

  if (subscriptions.length > 0) {
    const thirtyDaysAgo = addDays(today, -30);
    const thirtyDaysAgoStr = toDateStr(thirtyDaysAgo);

    const needsReview = subscriptions.filter(
      (s) =>
        !s.last_reviewed_at || s.last_reviewed_at < thirtyDaysAgoStr
    );

    if (needsReview.length > 0) {
      const totalMonthly = subscriptions.reduce(
        (sum, b) => sum + b.amount,
        0
      );

      alerts.push({
        type: 'SUBSCRIPTION_REVIEW',
        severity: 'warning',
        title: 'Review your subscriptions',
        message: `${subscriptions.length} subscriptions totaling $${totalMonthly.toFixed(2)}/mo haven't been reviewed`,
        subscriptionCount: subscriptions.length,
        totalMonthly,
      });
    }
  }

  return alerts;
}

// ── Helpers ──────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}
