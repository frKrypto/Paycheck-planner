import { Router, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// All income source routes require authentication
router.use(authMiddleware);

// ─── Validation helpers ───────────────────────────────────────────

const VALID_PAY_SCHEDULES = ['weekly', 'biweekly', 'semi-monthly', 'monthly'];

function validateIncomeSourceBody(body: Record<string, unknown>): string | null {
  const { name, hourly_rate, pay_schedule } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return 'name is required and must be a non-empty string';
  }

  if (typeof hourly_rate !== 'number' || hourly_rate <= 0) {
    return 'hourly_rate must be a positive number';
  }

  if (pay_schedule !== undefined) {
    if (typeof pay_schedule !== 'string' || !VALID_PAY_SCHEDULES.includes(pay_schedule)) {
      return `pay_schedule must be one of: ${VALID_PAY_SCHEDULES.join(', ')}`;
    }
  }

  if (body.is_default !== undefined && typeof body.is_default !== 'boolean') {
    return 'is_default must be a boolean';
  }

  return null;
}

// ─── Income Source CRUD ────────────────────────────────────────────

// GET /api/income-sources — List user's income sources
router.get('/', (req: AuthRequest, res: Response): void => {
  const db = getDb();

  const sources = db.prepare(
    'SELECT * FROM income_sources WHERE user_id = ? ORDER BY is_default DESC, name ASC'
  ).all(req.userId!);

  // Map is_default from 0/1 to boolean
  const mapped = (sources as any[]).map(s => ({
    ...s,
    is_default: s.is_default === 1,
  }));

  res.json(mapped);
});

// POST /api/income-sources — Create a new income source
router.post('/', (req: AuthRequest, res: Response): void => {
  const error = validateIncomeSourceBody(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const db = getDb();
  const { name, hourly_rate, pay_schedule } = req.body;
  const isDefault = req.body.is_default === true ? 1 : 0;
  const schedule = pay_schedule || 'weekly';

  // If this is set as default, unset all other defaults for the user
  if (isDefault) {
    db.prepare(
      'UPDATE income_sources SET is_default = 0 WHERE user_id = ?'
    ).run(req.userId!);
  }

  const result = db.prepare(
    `INSERT INTO income_sources (user_id, name, hourly_rate, pay_schedule, is_default)
     VALUES (?, ?, ?, ?, ?)`
  ).run(req.userId!, name.trim(), hourly_rate, schedule, isDefault);

  const source = db.prepare('SELECT * FROM income_sources WHERE id = ?').get(result.lastInsertRowid) as any;

  res.status(201).json({
    ...source,
    is_default: source.is_default === 1,
  });
});

// PUT /api/income-sources/:id — Update an income source
router.put('/:id', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid income source ID' });
    return;
  }

  // Verify ownership
  const existing = db.prepare(
    'SELECT * FROM income_sources WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!) as any;

  if (!existing) {
    res.status(404).json({ error: 'Income source not found' });
    return;
  }

  const error = validateIncomeSourceBody(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const { name, hourly_rate, pay_schedule } = req.body;
  const isDefault = req.body.is_default === true ? 1 : 0;
  const schedule = pay_schedule || existing.pay_schedule;

  // If this is set as default, unset all other defaults for the user
  if (isDefault) {
    db.prepare(
      'UPDATE income_sources SET is_default = 0 WHERE user_id = ?'
    ).run(req.userId!);
  }

  db.prepare(
    `UPDATE income_sources
     SET name = ?, hourly_rate = ?, pay_schedule = ?, is_default = ?
     WHERE id = ? AND user_id = ?`
  ).run(name.trim(), hourly_rate, schedule, isDefault, id, req.userId!);

  const updated = db.prepare('SELECT * FROM income_sources WHERE id = ?').get(id) as any;

  res.json({
    ...updated,
    is_default: updated.is_default === 1,
  });
});

// DELETE /api/income-sources/:id — Delete only if no shifts reference it
router.delete('/:id', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid income source ID' });
    return;
  }

  const existing = db.prepare(
    'SELECT * FROM income_sources WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!) as any;

  if (!existing) {
    res.status(404).json({ error: 'Income source not found' });
    return;
  }

  // Check if any shifts reference this income source
  const shiftCount = db.prepare(
    'SELECT COUNT(*) as count FROM shifts WHERE income_source_id = ? AND user_id = ?'
  ).get(id, req.userId!) as { count: number };

  if (shiftCount.count > 0) {
    res.status(400).json({
      error: 'Cannot delete income source that has shifts assigned to it. Reassign or delete those shifts first.',
    });
    return;
  }

  db.prepare('DELETE FROM income_sources WHERE id = ? AND user_id = ?').run(id, req.userId!);
  res.status(204).send();
});

// ─── Income Source Stats ──────────────────────────────────────────

// GET /api/income-sources/:id/stats — Summary stats for an income source
router.get('/:id/stats', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid income source ID' });
    return;
  }

  // Verify ownership
  const source = db.prepare(
    'SELECT * FROM income_sources WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!) as any;

  if (!source) {
    res.status(404).json({ error: 'Income source not found' });
    return;
  }

  // Last 4 weeks date range
  const now = new Date();
  const twentyEightDaysAgo = new Date(now);
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
  const trailingDate = twentyEightDaysAgo.toISOString().split('T')[0];

  // Get shifts for this income source in the last 4 weeks
  const recentShifts = db.prepare(
    `SELECT hours_worked, hourly_rate, tips
     FROM shifts
     WHERE user_id = ? AND income_source_id = ? AND date >= ?`
  ).all(req.userId!, id, trailingDate) as { hours_worked: number; hourly_rate: number; tips: number }[];

  const totalHours = recentShifts.reduce((sum, s) => sum + s.hours_worked, 0);
  const totalEarnings = recentShifts.reduce(
    (sum, s) => sum + (s.hours_worked * s.hourly_rate) + s.tips,
    0
  );

  // Average hourly rate: earnings / hours across all recent shifts
  const avgHourlyRate = totalHours > 0
    ? Math.round((totalEarnings / totalHours) * 100) / 100
    : 0;

  // Total shift count (all time for this source)
  const shiftCountRow = db.prepare(
    'SELECT COUNT(*) as count FROM shifts WHERE user_id = ? AND income_source_id = ?'
  ).get(req.userId!, id) as { count: number };

  res.json({
    income_source: {
      ...source,
      is_default: source.is_default === 1,
    },
    total_hours: Math.round(totalHours * 100) / 100,
    total_earnings: Math.round(totalEarnings * 100) / 100,
    average_hourly_rate: avgHourlyRate,
    shift_count: shiftCountRow.count,
    period: 'last_4_weeks',
  });
});

export default router;
