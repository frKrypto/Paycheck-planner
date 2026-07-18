import { Router, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// All bill routes require authentication
router.use(authMiddleware);

// ─── Constants ──────────────────────────────────────────────────────

const VALID_FREQUENCIES = ['monthly', 'weekly', 'biweekly', 'semi-monthly'] as const;
const VALID_CATEGORIES = [
  'rent', 'utilities', 'groceries', 'transportation',
  'debt', 'subscriptions', 'other',
] as const;

type Frequency = (typeof VALID_FREQUENCIES)[number];
type Category = (typeof VALID_CATEGORIES)[number];

// ─── Validation helpers ─────────────────────────────────────────────

function validateBillBody(body: Record<string, unknown>): string | null {
  const { name, amount, due_date, frequency, category } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return 'name is required and must not be empty';
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return 'amount must be a positive number';
  }

  if (due_date === undefined || due_date === null) {
    return 'due_date is required (day of month, 1-31)';
  }

  const dueDateNum = typeof due_date === 'string' ? parseInt(due_date, 10) : due_date;
  if (typeof dueDateNum !== 'number' || !Number.isInteger(dueDateNum) || dueDateNum < 1 || dueDateNum > 31) {
    return 'due_date must be a number between 1 and 31';
  }

  if (!VALID_FREQUENCIES.includes(frequency as Frequency)) {
    return `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`;
  }

  if (!VALID_CATEGORIES.includes(category as Category)) {
    return `category must be one of: ${VALID_CATEGORIES.join(', ')}`;
  }

  return null;
}

function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return !isNaN(parsed);
}

// ─── Helper: compute projected due date ─────────────────────────────

function computeProjectedDueDate(dueDay: number, referenceDate: Date): string {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed

  // Clamp day to last day of month (handle 31 on 30-day months)
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const effectiveDay = Math.min(dueDay, lastDayOfMonth);

  // If the due day is on or after today, use this month; otherwise next month
  const today = referenceDate.getDate();
  let targetMonth = month;
  let targetYear = year;

  if (effectiveDay < today) {
    // Due day already passed this month, use next month
    targetMonth = month + 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear = year + 1;
    }
  }

  // Re-clamp for the target month
  const targetLastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const finalDay = Math.min(dueDay, targetLastDay);

  const monthStr = String(targetMonth + 1).padStart(2, '0');
  const dayStr = String(finalDay).padStart(2, '0');
  return `${targetYear}-${monthStr}-${dayStr}`;
}

// ─── Helper: compute next paycheck date ─────────────────────────────

function computeNextPaycheck(paySchedule: string, today: Date): Date {
  const next = new Date(today);

  switch (paySchedule) {
    case 'weekly': {
      // Next Monday (or today if Monday)
      const dayOfWeek = today.getDay(); // 0 = Sunday
      const daysUntilMonday = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
      if (daysUntilMonday === 0) {
        // Today is Monday — return today
        return new Date(today);
      }
      next.setDate(today.getDate() + daysUntilMonday);
      return next;
    }

    case 'biweekly': {
      // Next occurrence: use today + 14 days as a reasonable default, then align to Friday
      // Simple approach: find next Friday from today
      const dayOfWeek = today.getDay();
      const daysUntilFriday = dayOfWeek === 5 ? 0 : (5 - dayOfWeek + 7) % 7;
      if (daysUntilFriday === 0) {
        daysUntilFriday; // today is Friday, use next Friday (7 days)
      }
      // For simplicity, use 14 days from today per the spec
      next.setDate(today.getDate() + 14);
      return next;
    }

    case 'semi-monthly': {
      // Next 1st or 15th
      const currentDay = today.getDate();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      if (currentDay < 1) {
        // Today is before 1st (impossible but handled)
        return new Date(currentYear, currentMonth, 1);
      } else if (currentDay < 15) {
        return new Date(currentYear, currentMonth, 15);
      } else {
        // After 15th — next 1st of next month
        return new Date(currentYear, currentMonth + 1, 1);
      }
    }

    default:
      // fallback: 14 days
      next.setDate(today.getDate() + 14);
      return next;
  }
}

// ─── Bill CRUD ──────────────────────────────────────────────────────

// POST /api/bills — Create a recurring bill
router.post('/', (req: AuthRequest, res: Response): void => {
  const error = validateBillBody(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const { name, amount, due_date, frequency, category } = req.body;
  const dueDateStr = String(due_date).padStart(2, '0');

  const db = getDb();

  const result = db.prepare(
    `INSERT INTO bills (user_id, name, amount, due_date, frequency, category)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(req.userId!, name.trim(), amount, dueDateStr, frequency, category);

  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json(bill);
});

// GET /api/bills/upcoming — Must come BEFORE /:id to avoid route conflict
router.get('/upcoming', (req: AuthRequest, res: Response): void => {
  const db = getDb();

  // Get user's pay schedule
  const user = db.prepare(
    'SELECT pay_schedule FROM users WHERE id = ?'
  ).get(req.userId!) as { pay_schedule: string } | undefined;

  const paySchedule = user?.pay_schedule || 'biweekly';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const nextPaycheck = computeNextPaycheck(paySchedule, today);
  const nextPaycheckStr = nextPaycheck.toISOString().split('T')[0];

  // Get all bills for the user
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

  // For each bill, compute projected due date and filter
  const upcoming = bills
    .map((bill) => {
      const dueDay = parseInt(bill.due_date, 10);
      const projectedDueDate = computeProjectedDueDate(dueDay, today);

      return {
        ...bill,
        projected_due_date: projectedDueDate,
      };
    })
    .filter((bill) => {
      // Bill is upcoming if its projected due date falls between today and next paycheck
      return bill.projected_due_date >= todayStr && bill.projected_due_date <= nextPaycheckStr;
    })
    .sort((a, b) => a.projected_due_date.localeCompare(b.projected_due_date));

  res.json(upcoming);
});

// GET /api/bills — List bills for user, sorted by due_date ASC
router.get('/', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const { category } = req.query;

  let query = 'SELECT * FROM bills WHERE user_id = ?';
  const params: unknown[] = [req.userId!];

  if (typeof category === 'string' && category.length > 0) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY due_date ASC';

  const bills = db.prepare(query).all(...params);
  res.json(bills);
});

// GET /api/bills/:id — Get a single bill
router.get('/:id', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid bill ID' });
    return;
  }

  const bill = db.prepare(
    'SELECT * FROM bills WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!);

  if (!bill) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  res.json(bill);
});

// PUT /api/bills/:id — Update a bill
router.put('/:id', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid bill ID' });
    return;
  }

  // Verify ownership
  const existing = db.prepare(
    'SELECT * FROM bills WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!);

  if (!existing) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  const error = validateBillBody(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const { name, amount, due_date, frequency, category } = req.body;
  const dueDateStr = String(due_date).padStart(2, '0');

  db.prepare(
    `UPDATE bills
     SET name = ?, amount = ?, due_date = ?, frequency = ?, category = ?
     WHERE id = ? AND user_id = ?`
  ).run(name.trim(), amount, dueDateStr, frequency, category, id, req.userId!);

  const updated = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/bills/:id — Delete a bill
router.delete('/:id', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid bill ID' });
    return;
  }

  const existing = db.prepare(
    'SELECT * FROM bills WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!);

  if (!existing) {
    res.status(404).json({ error: 'Bill not found' });
    return;
  }

  db.prepare('DELETE FROM bills WHERE id = ? AND user_id = ?').run(id, req.userId!);
  res.status(204).send();
});

export default router;
