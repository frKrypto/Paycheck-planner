import { Router, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const incomeRouter = Router();

// All shift and income routes require authentication
router.use(authMiddleware);
incomeRouter.use(authMiddleware);

// ─── Validation helpers ───────────────────────────────────────────

function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return !isNaN(parsed);
}

function validateShiftBody(body: Record<string, unknown>): string | null {
  const { date, hours_worked, hourly_rate } = body;

  if (!date || !isValidISODate(date)) {
    return 'A valid ISO date is required';
  }

  if (typeof hours_worked !== 'number' || hours_worked <= 0) {
    return 'hours_worked must be a positive number';
  }

  if (typeof hourly_rate !== 'number' || hourly_rate <= 0) {
    return 'hourly_rate must be a positive number';
  }

  // Optional fields: tips (default 0), overtime_hours (default 0)
  if (body.tips !== undefined && (typeof body.tips !== 'number' || body.tips < 0)) {
    return 'tips must be a non-negative number';
  }

  if (body.overtime_hours !== undefined && (typeof body.overtime_hours !== 'number' || body.overtime_hours < 0)) {
    return 'overtime_hours must be a non-negative number';
  }

  return null;
}

// ─── Shift CRUD ───────────────────────────────────────────────────

// POST /api/shifts — Create a shift
router.post('/', (req: AuthRequest, res: Response): void => {
  const error = validateShiftBody(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const { date, hours_worked, hourly_rate } = req.body;
  const tips = typeof req.body.tips === 'number' ? req.body.tips : 0;
  const overtime_hours = typeof req.body.overtime_hours === 'number' ? req.body.overtime_hours : 0;

  const db = getDb();

  const result = db.prepare(
    `INSERT INTO shifts (user_id, date, hours_worked, hourly_rate, tips, overtime_hours)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(req.userId!, date, hours_worked, hourly_rate, tips, overtime_hours);

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json(shift);
});

// GET /api/shifts — List shifts for the authenticated user
router.get('/', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const { start, end } = req.query;

  let query = 'SELECT * FROM shifts WHERE user_id = ?';
  const params: unknown[] = [req.userId!];

  if (typeof start === 'string' && typeof end === 'string') {
    query += ' AND date >= ? AND date <= ?';
    params.push(start, end);
  } else if (typeof start === 'string') {
    query += ' AND date >= ?';
    params.push(start);
  } else if (typeof end === 'string') {
    query += ' AND date <= ?';
    params.push(end);
  }

  query += ' ORDER BY date DESC';

  const shifts = db.prepare(query).all(...params);

  res.json(shifts);
});

// GET /api/shifts/:id — Get a single shift
router.get('/:id', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid shift ID' });
    return;
  }

  const shift = db.prepare(
    'SELECT * FROM shifts WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!);

  if (!shift) {
    res.status(404).json({ error: 'Shift not found' });
    return;
  }

  res.json(shift);
});

// PUT /api/shifts/:id — Update a shift
router.put('/:id', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid shift ID' });
    return;
  }

  // Verify ownership
  const existing = db.prepare(
    'SELECT * FROM shifts WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!);

  if (!existing) {
    res.status(404).json({ error: 'Shift not found' });
    return;
  }

  const error = validateShiftBody(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const { date, hours_worked, hourly_rate } = req.body;
  const tips = typeof req.body.tips === 'number' ? req.body.tips : 0;
  const overtime_hours = typeof req.body.overtime_hours === 'number' ? req.body.overtime_hours : 0;

  db.prepare(
    `UPDATE shifts
     SET date = ?, hours_worked = ?, hourly_rate = ?, tips = ?, overtime_hours = ?
     WHERE id = ? AND user_id = ?`
  ).run(date, hours_worked, hourly_rate, tips, overtime_hours, id, req.userId!);

  const updated = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/shifts/:id — Delete a shift
router.delete('/:id', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid shift ID' });
    return;
  }

  const existing = db.prepare(
    'SELECT * FROM shifts WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!);

  if (!existing) {
    res.status(404).json({ error: 'Shift not found' });
    return;
  }

  db.prepare('DELETE FROM shifts WHERE id = ? AND user_id = ?').run(id, req.userId!);
  res.status(204).send();
});

// ─── Income Stats ──────────────────────────────────────────────────

// GET /api/income/stats — Return computed income statistics
incomeRouter.get('/stats', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const now = new Date();

  // Rolling 4-week average: trailing 28 days from today
  const twentyEightDaysAgo = new Date(now);
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

  const rolling_4wk_avg = recentShifts.length > 0
    ? Math.round((totalRecentEarnings / 4) * 100) / 100
    : 0;

  // ── Weighted 4-week average ──────────────────────────────────────
  // Fetch shifts with dates for bucketing into weighted groups.
  // We consider ALL shifts (no 28-day limit for the weighted calc).
  const allShiftsWithDates = db.prepare(
    `SELECT date, hours_worked, hourly_rate, tips
     FROM shifts
     WHERE user_id = ?
     ORDER BY date DESC`
  ).all(req.userId!) as { date: string; hours_worked: number; hourly_rate: number; tips: number }[];

  let weighted_4wk_avg = 0;

  if (allShiftsWithDates.length > 0) {
    const todayMs = now.getTime();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    // Bucket shifts into weeks (7-day buckets from today), oldest first.
    // week 0: days 0-6, week 1: days 7-13, week 2: days 14-20, etc.
    const weeklyEarnings: { weekIndex: number; earnings: number }[] = [];

    for (const shift of allShiftsWithDates) {
      const shiftDate = new Date(shift.date + 'T00:00:00Z');
      const daysAgo = Math.floor((todayMs - shiftDate.getTime()) / MS_PER_DAY);
      if (daysAgo < 0) continue; // future shifts — skip
      const weekIndex = Math.floor(daysAgo / 7);
      const earnings = (shift.hours_worked * shift.hourly_rate) + shift.tips;

      // Find or create week bucket
      let bucket = weeklyEarnings.find(w => w.weekIndex === weekIndex);
      if (!bucket) {
        bucket = { weekIndex, earnings: 0 };
        weeklyEarnings.push(bucket);
      }
      bucket.earnings += earnings;
    }

    // Sort by weekIndex ascending (oldest first)
    weeklyEarnings.sort((a, b) => a.weekIndex - b.weekIndex);

    // Determine the date range covered by our data
    const maxDaysCovered = weeklyEarnings.length > 0
      ? (Math.max(...weeklyEarnings.map(w => w.weekIndex)) + 1) * 7
      : 0;

    // If fewer than 14 days of data, use equal weight
    if (maxDaysCovered < 14) {
      const totalWeighted = weeklyEarnings.reduce((sum, w) => sum + w.earnings, 0);
      weighted_4wk_avg = weeklyEarnings.length > 0
        ? Math.round((totalWeighted / weeklyEarnings.length) * 100) / 100
        : 0;
    } else {
      // Apply weights: weekIndex 0-1 (days 0-13) = 3x, weekIndex 2-3 (days 14-27) = 1x, weekIndex 4+ (days 28+) = 0.5x
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

      weighted_4wk_avg = weightSum > 0
        ? Math.round((weightedSum / weightSum) * 100) / 100
        : 0;
    }
  }

  // Total this month: current calendar month
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${year}-${month}-01`;
  const monthEnd = `${year}-${month}-31`; // SQLite date comparison handles this fine

  const monthShifts = db.prepare(
    `SELECT hours_worked, hourly_rate, tips
     FROM shifts
     WHERE user_id = ? AND date >= ? AND date <= ?`
  ).all(req.userId!, monthStart, monthEnd) as { hours_worked: number; hourly_rate: number; tips: number }[];

  const total_this_month = monthShifts.reduce(
    (sum, s) => sum + (s.hours_worked * s.hourly_rate) + s.tips,
    0
  );

  // Total shift count
  const shiftCountRow = db.prepare(
    'SELECT COUNT(*) as count FROM shifts WHERE user_id = ?'
  ).get(req.userId!) as { count: number };

  const shift_count = shiftCountRow.count;

  // Get user's pay schedule
  const user = db.prepare(
    'SELECT pay_schedule FROM users WHERE id = ?'
  ).get(req.userId!) as { pay_schedule: string } | undefined;

  const pay_schedule = user?.pay_schedule || 'biweekly';

  res.json({
    rolling_4wk_avg,
    weighted_4wk_avg,
    total_this_month: Math.round(total_this_month * 100) / 100,
    shift_count,
    pay_schedule,
  });
});

export { router as shiftRoutes, incomeRouter as incomeRoutes };
