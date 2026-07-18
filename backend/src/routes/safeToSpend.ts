import { Router, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { computeNextPaycheck, computeProjectedDueDate } from '../services/dateUtils';
import { calculateSafeToSpend } from '../services/safeToSpend';

const router = Router();

// All safe-to-spend routes require authentication
router.use(authMiddleware);

/**
 * GET /api/safe-to-spend
 *
 * Computes a safe daily spending amount based on:
 * - Current account balance (required query param: ?balance=)
 * - Upcoming bills due before next paycheck
 * - Rolling 4-week average income
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

  // ── Compute expected paycheck (rolling 4-week average) ─────────────
  const twentyEightDaysAgo = new Date(today);
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
  const trailingDate = twentyEightDaysAgo.toISOString().split('T')[0];

  const recentShifts = db.prepare(
    `SELECT hours_worked, hourly_rate, tips
     FROM shifts
     WHERE user_id = ? AND date >= ?`
  ).all(req.userId!, trailingDate) as { hours_worked: number; hourly_rate: number; tips: number }[];

  const totalRecentEarnings = recentShifts.reduce(
    (sum, s) => sum + (s.hours_worked * s.hourly_rate) + s.tips,
    0
  );

  const expectedPaycheckAmount = recentShifts.length > 0
    ? Math.round((totalRecentEarnings / 4) * 100) / 100
    : 0;

  // ── Edge case: no income history ──────────────────────────────────
  if (recentShifts.length === 0) {
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
        warning: 'no_income_history',
      },
      upcomingBills,
      expectedPaycheckAmount: 0,
      nextPaycheckDate: nextPaycheckStr,
    });
    return;
  }

  // ── Call the calculator ────────────────────────────────────────────
  const result = calculateSafeToSpend({
    currentBalance: balance,
    upcomingBills,
    nextPaycheckDate: nextPaycheckStr,
    expectedPaycheckAmount,
  });

  res.json({
    safeToSpend: result.safeToSpend,
    details: result.details,
    upcomingBills,
    expectedPaycheckAmount,
    nextPaycheckDate: nextPaycheckStr,
  });
});

export default router;
