import { Router, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { computeNextPaycheck, computeProjectedDueDate } from '../services/dateUtils';
import { calculateSafeToSpend } from '../services/safeToSpend';

const router = Router();

// All safe-to-spend routes require authentication
router.use(authMiddleware);

/**
 * Compute a weighted 4-week average from an array of shifts with dates.
 * Same logic as the income stats endpoint.
 */
function computeWeighted4wkAvg(
  shifts: { date: string; hours_worked: number; hourly_rate: number; tips: number }[],
  now: Date
): number {
  if (shifts.length === 0) return 0;

  const todayMs = now.getTime();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const weeklyEarnings: { weekIndex: number; earnings: number }[] = [];

  for (const shift of shifts) {
    const shiftDate = new Date(shift.date + 'T00:00:00Z');
    const daysAgo = Math.floor((todayMs - shiftDate.getTime()) / MS_PER_DAY);
    if (daysAgo < 0) continue;
    const weekIndex = Math.floor(daysAgo / 7);
    const earnings = (shift.hours_worked * shift.hourly_rate) + shift.tips;

    let bucket = weeklyEarnings.find(w => w.weekIndex === weekIndex);
    if (!bucket) {
      bucket = { weekIndex, earnings: 0 };
      weeklyEarnings.push(bucket);
    }
    bucket.earnings += earnings;
  }

  weeklyEarnings.sort((a, b) => a.weekIndex - b.weekIndex);

  const maxDaysCovered = weeklyEarnings.length > 0
    ? (Math.max(...weeklyEarnings.map(w => w.weekIndex)) + 1) * 7
    : 0;

  if (maxDaysCovered < 14) {
    const totalWeighted = weeklyEarnings.reduce((sum, w) => sum + w.earnings, 0);
    return weeklyEarnings.length > 0
      ? Math.round((totalWeighted / weeklyEarnings.length) * 100) / 100
      : 0;
  }

  let weightedSum = 0;
  let weightSum = 0;

  for (const bucket of weeklyEarnings) {
    let weight: number;
    if (bucket.weekIndex <= 1) {
      weight = 3;
    } else if (bucket.weekIndex <= 3) {
      weight = 1;
    } else {
      weight = 0.5;
    }
    weightedSum += bucket.earnings * weight;
    weightSum += weight;
  }

  return weightSum > 0
    ? Math.round((weightedSum / weightSum) * 100) / 100
    : 0;
}

/**
 * Build weekly earnings buckets for the last 8 weeks from shifts.
 * Returns an array of weekly totals (most recent week first).
 */
function buildWeeklyIncomeHistory(
  shifts: { date: string; hours_worked: number; hourly_rate: number; tips: number }[],
  now: Date
): number[] {
  const todayMs = now.getTime();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const weeklyBuckets: Map<number, number> = new Map();

  for (const shift of shifts) {
    const shiftDate = new Date(shift.date + 'T00:00:00Z');
    const daysAgo = Math.floor((todayMs - shiftDate.getTime()) / MS_PER_DAY);
    if (daysAgo < 0 || daysAgo > 56) continue; // only last 8 weeks
    const weekIndex = Math.floor(daysAgo / 7);
    const earnings = (shift.hours_worked * shift.hourly_rate) + shift.tips;
    weeklyBuckets.set(weekIndex, (weeklyBuckets.get(weekIndex) || 0) + earnings);
  }

  // Return as array sorted by weekIndex ascending (week 0 = most recent)
  const result: number[] = [];
  for (let i = 0; i <= 7; i++) {
    result.push(weeklyBuckets.get(i) || 0);
  }
  return result;
}

/**
 * GET /api/safe-to-spend
 *
 * Computes a safe daily spending amount based on:
 * - Current account balance (required query param: ?balance=)
 * - Upcoming bills due before next paycheck
 * - Weighted 4-week average income
 *
 * Query params:
 *   balance (required) — current account balance as a number
 *
 * Response:
 *   { safeToSpend, details, upcomingBills, expectedPaycheckAmount, nextPaycheckDate }
 */
router.get('/', (req: AuthRequest, res: Response): void => {
  const db = getDb();

  // ── Validate balance query param ──────────────────────────────────
  const balanceRaw = req.query.balance as string | undefined;
  if (balanceRaw === undefined || balanceRaw === '') {
    res.status(400).json({ error: 'Missing required query parameter: balance' });
    return;
  }

  const balance = parseFloat(balanceRaw);
  if (isNaN(balance) || balance < 0) {
    res.status(400).json({ error: 'balance must be a non-negative number' });
    return;
  }

  // ── Get user's pay schedule ────────────────────────────────────────
  const user = db.prepare(
    'SELECT pay_schedule FROM users WHERE id = ?'
  ).get(req.userId!) as { pay_schedule: string } | undefined;

  const paySchedule = user?.pay_schedule || 'biweekly';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // ── Compute next paycheck date ─────────────────────────────────────
  const nextPaycheck = computeNextPaycheck(paySchedule, today);
  const nextPaycheckStr = nextPaycheck.toISOString().split('T')[0];

  // ── Get upcoming bills (projected due dates, filtered to window) ──
  const bills = db.prepare(
    'SELECT * FROM bills WHERE user_id = ?'
  ).all(req.userId!) as Array<{
    id: number;
    user_id: number;
    name: string;
    amount: number;
    due_date: string;
    frequency: string;
    category: string;
    created_at: string;
  }>;

  const upcomingBills = bills
    .map((bill) => {
      const dueDay = parseInt(bill.due_date, 10);
      const projectedDueDate = computeProjectedDueDate(dueDay, today);

      return {
        id: bill.id,
        name: bill.name,
        amount: bill.amount,
        category: bill.category,
        frequency: bill.frequency,
        due_date: bill.due_date,
        projected_due_date: projectedDueDate,
      };
    })
    .filter((bill) => {
      return bill.projected_due_date >= todayStr && bill.projected_due_date <= nextPaycheckStr;
    })
    .sort((a, b) => a.projected_due_date.localeCompare(b.projected_due_date));

  // ── Fetch all shifts with dates (last 8 weeks for trend + income history) ──
  const fiftySixDaysAgo = new Date(today);
  fiftySixDaysAgo.setDate(fiftySixDaysAgo.getDate() - 56);
  const historyStart = fiftySixDaysAgo.toISOString().split('T')[0];

  const allShifts = db.prepare(
    `SELECT date, hours_worked, hourly_rate, tips
     FROM shifts
     WHERE user_id = ? AND date >= ?
     ORDER BY date DESC`
  ).all(req.userId!, historyStart) as { date: string; hours_worked: number; hourly_rate: number; tips: number }[];

  // ── Compute expected paycheck (weighted 4-week average) ────────────
  const expectedPaycheckAmount = computeWeighted4wkAvg(allShifts, today);

  // ── Build income history for volatility ────────────────────────────
  const incomeHistory = buildWeeklyIncomeHistory(allShifts, today);

  // ── Edge case: no income history ──────────────────────────────────
  if (allShifts.length === 0) {
    res.json({
      safeToSpend: 0,
      details: {
        daysUntilPaycheck: Math.max(
          1,
          Math.ceil((nextPaycheck.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        ) || 7,
        totalBillsDue: Math.round(
          upcomingBills.reduce((sum, b) => sum + b.amount, 0) * 100
        ) / 100,
        availableAfterBills: Math.round(
          (balance - upcomingBills.reduce((sum, b) => sum + b.amount, 0)) * 100
        ) / 100,
        dailyAmount: 0,
        bufferRate: 0.85,
        billsConsidered: upcomingBills.length,
        warnings: ['no_income_history'],
        warning: 'no_income_history',
        incomeVolatility: 'moderate',
        weightedAvgIncome: 0,
      },
      upcomingBills,
      expectedPaycheckAmount: 0,
      nextPaycheckDate: nextPaycheckStr,
    });
    return;
  }

  // ── Income trend detection ────────────────────────────────────────
  const trendWarnings: string[] = [];

  // Calculate recent 2-week average (days 0-13) vs full 4-week average (days 0-27)
  const msPerDay = 1000 * 60 * 60 * 24;
  const todayMs = today.getTime();

  let recent2wkTotal = 0;
  let full4wkTotal = 0;

  for (const shift of allShifts) {
    const shiftDate = new Date(shift.date + 'T00:00:00Z');
    const daysAgo = Math.floor((todayMs - shiftDate.getTime()) / msPerDay);
    if (daysAgo < 0 || daysAgo > 27) continue;

    const earnings = (shift.hours_worked * shift.hourly_rate) + shift.tips;

    // Full 4-week: days 0-27
    full4wkTotal += earnings;

    // Recent 2-week: days 0-13
    if (daysAgo <= 13) {
      recent2wkTotal += earnings;
    }
  }

  const recent2wkAvg = recent2wkTotal / 2;
  const full4wkAvg = full4wkTotal / 4;

  if (full4wkAvg > 0) {
    const ratio = recent2wkAvg / full4wkAvg;
    if (ratio <= 0.8) {
      trendWarnings.push('income_trending_down');
    } else if (ratio >= 1.2) {
      trendWarnings.push('income_trending_up');
    }
  }

  // ── Call the calculator ────────────────────────────────────────────
  const result = calculateSafeToSpend({
    currentBalance: balance,
    upcomingBills,
    nextPaycheckDate: nextPaycheckStr,
    expectedPaycheckAmount,
    incomeHistory,
  });

  // ── Merge trend warnings with calculator warnings ──────────────────
  const allWarnings = [...result.details.warnings, ...trendWarnings];

  // Deduplicate
  const uniqueWarnings = [...new Set(allWarnings)];

  res.json({
    safeToSpend: result.safeToSpend,
    details: {
      ...result.details,
      warnings: uniqueWarnings,
      warning: uniqueWarnings.length > 0 ? uniqueWarnings[0] : null,
    },
    upcomingBills,
    expectedPaycheckAmount,
    nextPaycheckDate: nextPaycheckStr,
  });
});

export default router;
