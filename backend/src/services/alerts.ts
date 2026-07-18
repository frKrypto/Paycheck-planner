import { computeNextPaycheck, computeProjectedDueDate } from './dateUtils';

export interface BillAlert {
  type: 'IMMINENT_BILL' | 'LOW_SAFE_TO_SPEND' | 'BILL_DUE_BEFORE_PAYCHECK';
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
}

export interface GenerateAlertsInput {
  bills: Array<{
    id: number;
    name: string;
    amount: number;
    due_date: string;
    frequency: string;
    category: string;
  }>;
  weightedWeeklyIncome: number;
  paySchedule: string;
  today?: Date;
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
