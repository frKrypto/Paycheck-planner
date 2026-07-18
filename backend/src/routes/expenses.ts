import { Router, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// All expense routes require authentication
router.use(authMiddleware);

// ─── Constants ──────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'rent', 'utilities', 'groceries', 'transportation',
  'debt', 'subscriptions', 'other',
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

// ─── Validation helpers ─────────────────────────────────────────────

function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return !isNaN(parsed);
}

function validateExpenseBody(body: Record<string, unknown>): string | null {
  const { category, amount, date } = body;

  if (typeof amount !== 'number' || amount <= 0) {
    return 'amount must be a positive number';
  }

  if (!date || !isValidISODate(date)) {
    return 'A valid ISO date is required';
  }

  if (!VALID_CATEGORIES.includes(category as Category)) {
    return `category must be one of: ${VALID_CATEGORIES.join(', ')}`;
  }

  // description is optional
  if (body.description !== undefined && typeof body.description !== 'string') {
    return 'description must be a string';
  }

  return null;
}

// ─── Expense CRUD ───────────────────────────────────────────────────

// POST /api/expenses — Create a one-off expense
router.post('/', (req: AuthRequest, res: Response): void => {
  const error = validateExpenseBody(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const { category, amount, date } = req.body;
  const description = typeof req.body.description === 'string' ? req.body.description : '';

  const db = getDb();

  const result = db.prepare(
    `INSERT INTO expenses (user_id, category, amount, date, description)
     VALUES (?, ?, ?, ?, ?)`
  ).run(req.userId!, category, amount, date, description);

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json(expense);
});

// GET /api/expenses — List expenses for user, sorted by date DESC
router.get('/', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const { start, end, category } = req.query;

  let query = 'SELECT * FROM expenses WHERE user_id = ?';
  const params: unknown[] = [req.userId!];

  if (typeof start === 'string' && start.length > 0) {
    query += ' AND date >= ?';
    params.push(start);
  }

  if (typeof end === 'string' && end.length > 0) {
    query += ' AND date <= ?';
    params.push(end);
  }

  if (typeof category === 'string' && category.length > 0) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY date DESC';

  const expenses = db.prepare(query).all(...params);
  res.json(expenses);
});

// GET /api/expenses/:id — Get a single expense
router.get('/:id', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid expense ID' });
    return;
  }

  const expense = db.prepare(
    'SELECT * FROM expenses WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!);

  if (!expense) {
    res.status(404).json({ error: 'Expense not found' });
    return;
  }

  res.json(expense);
});

// PUT /api/expenses/:id — Update an expense
router.put('/:id', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid expense ID' });
    return;
  }

  // Verify ownership
  const existing = db.prepare(
    'SELECT * FROM expenses WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!);

  if (!existing) {
    res.status(404).json({ error: 'Expense not found' });
    return;
  }

  const error = validateExpenseBody(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const { category, amount, date } = req.body;
  const description = typeof req.body.description === 'string' ? req.body.description : '';

  db.prepare(
    `UPDATE expenses
     SET category = ?, amount = ?, date = ?, description = ?
     WHERE id = ? AND user_id = ?`
  ).run(category, amount, date, description, id, req.userId!);

  const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/expenses/:id — Delete an expense
router.delete('/:id', (req: AuthRequest, res: Response): void => {
  const db = getDb();
  const rawId = req.params.id as string;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid expense ID' });
    return;
  }

  const existing = db.prepare(
    'SELECT * FROM expenses WHERE id = ? AND user_id = ?'
  ).get(id, req.userId!);

  if (!existing) {
    res.status(404).json({ error: 'Expense not found' });
    return;
  }

  db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(id, req.userId!);
  res.status(204).send();
});

export default router;
