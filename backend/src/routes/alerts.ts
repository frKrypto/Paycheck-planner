import { Router, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateAlerts } from '../services/alerts';

const router = Router();

// All alert routes require authentication
router.use(authMiddleware);

// GET /api/alerts — Return user's bill alerts
router.get('/', (req: AuthRequest, res: Response): void => {
  const db = getDb();

  // Get user's pay schedule
  const user = db
    .prepare('SELECT pay_schedule FROM users WHERE id = ?')
    .get(req.userId!) as { pay_schedule: string } | undefined;

  const paySchedule = user?.pay_schedule || 'biweekly';

  // Get all bills for the user
  const bills = db
    .prepare('SELECT * FROM bills WHERE user_id = ?')
    .all(req.userId!) as Array<{
    id: number;
    user_id: number;
    name: string;
    amount: number;
    due_date: string;
    frequency: string;
    category: string;
    created_at: string;
    last_reviewed_at: string | null;
  }>;

  // Get bill history for the user's bills
  const billHistory = db
    .prepare(
      `SELECT bh.bill_id, bh.amount, bh.recorded_at
       FROM bill_history bh
       INNER JOIN bills b ON b.id = bh.bill_id
       WHERE b.user_id = ?
       ORDER BY bh.recorded_at ASC`
    )
    .all(req.userId!) as Array<{
    bill_id: number;
    amount: number;
    recorded_at: string;
  }>;

  // Compute weighted weekly income from shifts
  const weightedWeeklyIncome = computeWeightedWeeklyIncome(
    db,
    req.userId!
  );

  const alerts = generateAlerts({
    bills,
    weightedWeeklyIncome,
    paySchedule,
    billHistory,
  });

  // Optional severity filter
  const severityFilter = req.query.severity as string | undefined;
  const filtered =
    severityFilter && ['warning', 'critical'].includes(severityFilter)
      ? alerts.filter(
          (a) => a.severity === severityFilter
        )
      : alerts;

  res.json({ alerts: filtered, count: filtered.length });
});

export default router;

// ─── Weighted Weekly Income Helper ─────────────────────────────────

function computeWeightedWeeklyIncome(
  db: ReturnType<typeof getDb>,
  userId: number
): number {
  const now = new Date();

  const allShiftsWithDates = db
    .prepare(
      `SELECT date, hours_worked, hourly_rate, tips
       FROM shifts
       WHERE user_id = ?
       ORDER BY date DESC`
    )
    .all(userId) as {
    date: string;
    hours_worked: number;
    hourly_rate: number;
    tips: number;
  }[];

  if (allShiftsWithDates.length === 0) return 0;

  const todayMs = now.getTime();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const weeklyEarnings: {
    weekIndex: number;
    earnings: number;
  }[] = [];

  for (const shift of allShiftsWithDates) {
    const shiftDate = new Date(shift.date + 'T00:00:00Z');
    const daysAgo = Math.floor(
      (todayMs - shiftDate.getTime()) / MS_PER_DAY
    );
    if (daysAgo < 0) continue; // future shifts — skip
    const weekIndex = Math.floor(daysAgo / 7);
    const earnings =
      shift.hours_worked * shift.hourly_rate + shift.tips;

    let bucket = weeklyEarnings.find(
      (w) => w.weekIndex === weekIndex
    );
    if (!bucket) {
      bucket = { weekIndex, earnings: 0 };
      weeklyEarnings.push(bucket);
    }
    bucket.earnings += earnings;
  }

  weeklyEarnings.sort((a, b) => a.weekIndex - b.weekIndex);

  const maxDaysCovered =
    weeklyEarnings.length > 0
      ? (Math.max(...weeklyEarnings.map((w) => w.weekIndex)) + 1) * 7
      : 0;

  if (maxDaysCovered < 14) {
    const totalWeighted = weeklyEarnings.reduce(
      (sum, w) => sum + w.earnings,
      0
    );
    return weeklyEarnings.length > 0
      ? Math.round(
          (totalWeighted / weeklyEarnings.length) * 100
        ) / 100
      : 0;
  }

  // Apply weights: weekIndex 0-1 (days 0-13) = 3x, weekIndex 2-3 = 1x, weekIndex 4+ = 0.5x
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
