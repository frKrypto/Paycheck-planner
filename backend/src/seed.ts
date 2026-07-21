import bcrypt from 'bcryptjs';
import { initDb, getDb } from './db';

function main(): void {
  initDb();
  const db = getDb();
  const today = new Date();

  // ── Delete existing demo user and all related data (idempotent) ──

  const existingUser = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get('demo@example.com') as { id: number } | undefined;

  if (existingUser) {
    db.prepare('DELETE FROM shifts WHERE user_id = ?').run(existingUser.id);
    db.prepare('DELETE FROM bills WHERE user_id = ?').run(existingUser.id);
    db.prepare('DELETE FROM expenses WHERE user_id = ?').run(existingUser.id);
    db.prepare('DELETE FROM income_sources WHERE user_id = ?').run(existingUser.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(existingUser.id);
    console.log('Cleared existing demo user data.');
  }

  // ── Create demo user ───────────────────────────────────────────────

  const passwordHash = bcrypt.hashSync('demo1234', 10);
  const userResult = db.prepare(
    'INSERT INTO users (email, password_hash, name, pay_schedule) VALUES (?, ?, ?, ?)'
  ).run('demo@example.com', passwordHash, 'Alex Rivera', 'biweekly');

  const userId = userResult.lastInsertRowid as number;

  // ── Create income sources ────────────────────────────────────────────

  const insertIncomeSource = db.prepare(
    `INSERT INTO income_sources (user_id, name, hourly_rate, pay_schedule, is_default)
     VALUES (?, ?, ?, ?, ?)`
  );

  const restaurantResult = insertIncomeSource.run(
    userId, 'Restaurant', 18.5, 'biweekly', 1
  );
  const restaurantId = restaurantResult.lastInsertRowid as number;

  const uberResult = insertIncomeSource.run(
    userId, 'Uber', 22.0, 'weekly', 0
  );
  const uberId = uberResult.lastInsertRowid as number;

  console.log(`Created income sources: Restaurant (id=${restaurantId}), Uber (id=${uberId})`);

  // ── Helper: date offset from today ─────────────────────────────────

  function daysAgo(n: number): string {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  // ── Shift definitions ─────────────────────────────────────────────
  // [daysAgo, hours, overtime, tips, income_source_id]
  const shiftDefs: Array<[number, number, number, number, number]> = [
    // Week 6 (most recent, ~0-7 days ago) — 3 shifts (Restaurant)
    [2, 8, 0, 25, restaurantId],
    [4, 6, 0, 15, restaurantId],
    [6, 10, 2, 30, restaurantId],

    // Week 5 (~7-14 days ago) — 3 shifts (Restaurant)
    [9, 8, 0, 20, restaurantId],
    [11, 8, 0, 0, restaurantId],
    [13, 12, 4, 40, restaurantId],

    // Week 4 (~14-21 days ago) — 5 shifts (mixed)
    [15, 8, 0, 10, restaurantId],
    [16, 5, 0, 0, uberId],
    [18, 10, 2, 35, restaurantId],
    [19, 8, 0, 0, uberId],
    [21, 8, 0, 50, restaurantId],

    // Week 3 (~21-28 days ago) — 2 shifts (Uber)
    [24, 8, 0, 15, uberId],
    [27, 8, 0, 0, uberId],

    // Week 2 (~28-35 days ago) — 3 shifts (mixed)
    [29, 8, 0, 0, restaurantId],
    [31, 5, 0, 25, uberId],
    [34, 8, 0, 20, restaurantId],

    // Week 1 (~35-42 days ago) — 4 shifts (Uber)
    [36, 8, 0, 10, uberId],
    [37, 10, 2, 30, uberId],
    [40, 8, 0, 0, uberId],
    [42, 6, 0, 15, restaurantId],
  ];

  const insertShift = db.prepare(
    `INSERT INTO shifts (user_id, date, hours_worked, hourly_rate, tips, overtime_hours, income_source_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const hourlyRate = 18.5;
  let shiftCount = 0;

  for (const [days, hours, overtime, tips, sourceId] of shiftDefs) {
    insertShift.run(userId, daysAgo(days), hours, hourlyRate, tips, overtime, sourceId);
    shiftCount++;
  }

  // ── Bill definitions ───────────────────────────────────────────────
  // [name, amount, due_date, frequency, category]
  const billDefs: Array<[string, number, string, string, string]> = [
    ['Rent', 1200, '01', 'monthly', 'rent'],
    ['Utilities', 150, '15', 'monthly', 'utilities'],
    ['Car Payment', 320, '10', 'monthly', 'debt'],
    ['Phone', 85, '20', 'monthly', 'subscriptions'],
    ['Groceries', 400, '07', 'weekly', 'groceries'],
  ];

  const insertBill = db.prepare(
    `INSERT INTO bills (user_id, name, amount, due_date, frequency, category)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  let billCount = 0;
  for (const [name, amount, dueDate, frequency, category] of billDefs) {
    insertBill.run(userId, name, amount, dueDate, frequency, category);
    billCount++;
  }

  // ── Expense definitions ────────────────────────────────────────────
  // [daysAgo, category, amount, description]
  const expenseDefs: Array<[number, string, number, string]> = [
    [3, 'groceries', 85.40, 'Weekly grocery run'],
    [5, 'transportation', 45.00, 'Gas'],
    [8, 'subscriptions', 15.99, 'Netflix subscription'],
    [12, 'other', 120.00, 'New work shoes'],
    [16, 'groceries', 92.30, 'Weekly grocery run'],
    [18, 'transportation', 38.50, 'Gas'],
    [21, 'other', 65.00, 'Dinner out with friends'],
    [24, 'groceries', 78.20, 'Weekly grocery run'],
    [27, 'debt', 200.00, 'Credit card payment'],
    [29, 'subscriptions', 12.99, 'Spotify Premium'],
  ];

  const insertExpense = db.prepare(
    `INSERT INTO expenses (user_id, category, amount, date, description)
     VALUES (?, ?, ?, ?, ?)`
  );

  let expenseCount = 0;
  for (const [days, category, amount, description] of expenseDefs) {
    insertExpense.run(userId, category, amount, daysAgo(days), description);
    expenseCount++;
  }

  console.log(`Seeded: ${shiftCount} shifts, ${billCount} bills, ${expenseCount} expenses`);
}

main();
