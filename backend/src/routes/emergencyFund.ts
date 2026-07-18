import { Router, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { calculateEmergencyFund, normalizeToMonthlyAmount } from '../services/emergencyFund';

const router = Router();

// Emergency fund route requires authentication
router.use(authMiddleware);

/**
 * GET /api/emergency-fund
 *
 * Calculates how many days the user could survive if income stopped,
 * based on recurring bills, recent one-off expenses, and savings.
 *
 * Query params:
 *   savings (required) — user's current savings balance as a non-negative number
 *
 * Response:
 *   { daysCovered, monthlyExpenses, dailyRate, savings, rating }
 */
router.get('/', (req: AuthRequest, res: Response): void => {
  const db = getDb();

  // ── Validate savings query param ───────────────────────────────────
  const savingsRaw = req.query.savings as string | undefined;
  if (savingsRaw === undefined || savingsRaw === '') {
    res.status(400).json({ error: 'Missing required query parameter: savings' });
    return;
  }

  const savings = parseFloat(savingsRaw);
  if (isNaN(savings) || savings < 0) {
    res.status(400).json({ error: 'savings must be a non-negative number' });
    return;
  }

  // ── Sum all recurring bills, normalized to monthly ─────────────────
  const bills = db.prepare(
    'SELECT amount, frequency FROM bills WHERE user_id = ?'
  ).all(req.userId!) as { amount: number; frequency: string }[];

  const monthlyBillsTotal = bills.reduce((sum, bill) => {
    return sum + normalizeToMonthlyAmount(bill.amount, bill.frequency);
  }, 0);

  // ── Average monthly one-off expenses (last 30 days) ────────────────
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split('T')[0];

  const recentExpenses = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM expenses
     WHERE user_id = ? AND date >= ?`
  ).get(req.userId!, startDate) as { total: number };

  const averageMonthlyExpenses = recentExpenses.total;

  // ── Compute the emergency fund coverage ─────────────────────────────
  const result = calculateEmergencyFund({
    monthlyBillsTotal,
    averageMonthlyExpenses,
    savings,
  });

  res.json(result);
});

export default router;
