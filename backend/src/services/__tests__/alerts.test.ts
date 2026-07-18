import { generateAlerts, BillAlert } from '../alerts';

// ── Helper: build a test bill ─────────────────────────────────────

function bill(overrides: Partial<{
  id: number;
  name: string;
  amount: number;
  due_date: string;
  frequency: string;
  category: string;
}> = {}): {
  id: number;
  name: string;
  amount: number;
  due_date: string;
  frequency: string;
  category: string;
} {
  return {
    id: 1,
    name: 'Rent',
    amount: 500,
    due_date: '15',
    frequency: 'monthly',
    category: 'rent',
    ...overrides,
  };
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// ── Tests ─────────────────────────────────────────────────────────

describe('generateAlerts', () => {
  const defaultIncome = 1000;
  const defaultPaySchedule = 'biweekly';

  // ── No bills due soon → empty ─────────────────────────────────

  test('no bills due soon → empty alerts array', () => {
    // Bill due on day 15, and we set today to day 20 so it projects to next month (far future)
    const today = new Date(2026, 6, 20); // July 20
    const alerts = generateAlerts({
      bills: [bill({ due_date: '15', amount: 500 })],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
      today,
    });
    expect(alerts).toEqual([]);
  });

  test('empty bills list → empty alerts', () => {
    const alerts = generateAlerts({
      bills: [],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
    });
    expect(alerts).toEqual([]);
  });

  // ── IMMINENT_BILL ────────────────────────────────────────────

  test('bill due tomorrow → IMMINENT_BILL warning', () => {
    // Use a due_date that computes to tomorrow (day 22 when today is July 21)
    const today = new Date(2026, 6, 21); // July 21
    const alerts = generateAlerts({
      bills: [bill({ due_date: '22', amount: 100 })],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
      today,
    });

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const imminent = alerts.find((a) => a.type === 'IMMINENT_BILL');
    expect(imminent).toBeDefined();
    expect(imminent!.severity).toBe('warning');
    expect(imminent!.bill).toBeDefined();
    expect(imminent!.bill!.name).toBe('Rent');
    expect(imminent!.bill!.projected_due_date).toBe('2026-07-22');
  });

  test('bill due tomorrow + amount > 50% income → IMMINENT_BILL critical', () => {
    const today = new Date(2026, 6, 21); // July 21
    const alerts = generateAlerts({
      bills: [bill({ due_date: '22', amount: 600 })], // 600 > 50% of 1000
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
      today,
    });

    const imminent = alerts.find((a) => a.type === 'IMMINENT_BILL');
    expect(imminent).toBeDefined();
    expect(imminent!.severity).toBe('critical');
    expect(imminent!.message).toMatch(/large expense/);
  });

  test('bill due today → IMMINENT_BILL alert', () => {
    const today = new Date(2026, 6, 21); // July 21
    const alerts = generateAlerts({
      bills: [bill({ due_date: '21', amount: 200 })],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
      today,
    });

    const imminent = alerts.find((a) => a.type === 'IMMINENT_BILL');
    expect(imminent).toBeDefined();
    expect(imminent!.bill!.projected_due_date).toBe('2026-07-21');
  });

  test('bill due in 3 days → IMMINENT_BILL alert', () => {
    const today = new Date(2026, 6, 21); // July 21
    const alerts = generateAlerts({
      bills: [bill({ due_date: '24', amount: 200 })],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
      today,
    });

    const imminent = alerts.find((a) => a.type === 'IMMINENT_BILL');
    expect(imminent).toBeDefined();
  });

  test('bill due in 4 days → no IMMINENT_BILL alert', () => {
    const today = new Date(2026, 6, 21); // July 21
    const alerts = generateAlerts({
      bills: [bill({ due_date: '25', amount: 200 })],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
      today,
    });

    const imminent = alerts.filter((a) => a.type === 'IMMINENT_BILL');
    expect(imminent.length).toBe(0);
  });

  test('bill exactly at 50% income → IMMINENT_BILL warning (not critical)', () => {
    const today = new Date(2026, 6, 21); // July 21
    const alerts = generateAlerts({
      bills: [bill({ due_date: '22', amount: 500 })], // exactly 50% of 1000
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
      today,
    });

    const imminent = alerts.find((a) => a.type === 'IMMINENT_BILL');
    expect(imminent).toBeDefined();
    expect(imminent!.severity).toBe('warning');
  });

  // ── LOW_SAFE_TO_SPEND ────────────────────────────────────────

  test('bills in 7 days > 80% income → LOW_SAFE_TO_SPEND warning', () => {
    const today = new Date(2026, 6, 15); // July 15
    // Bill due on day 20 ($850) which is within 7 days and > 80% of 1000
    const alerts = generateAlerts({
      bills: [bill({ due_date: '20', amount: 850 })],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
      today,
    });

    const lowSts = alerts.find((a) => a.type === 'LOW_SAFE_TO_SPEND');
    expect(lowSts).toBeDefined();
    expect(lowSts!.severity).toBe('warning');
    expect(lowSts!.message).toMatch(/eating most of your income/);
  });

  test('bills in 7 days > income → LOW_SAFE_TO_SPEND critical', () => {
    const today = new Date(2026, 6, 15); // July 15
    // Bill due on day 20 ($1200) which exceeds income of 1000
    const alerts = generateAlerts({
      bills: [bill({ due_date: '20', amount: 1200 })],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
      today,
    });

    const lowSts = alerts.find((a) => a.type === 'LOW_SAFE_TO_SPEND');
    expect(lowSts).toBeDefined();
    expect(lowSts!.severity).toBe('critical');
    expect(lowSts!.message).toMatch(/exceed your expected income/);
  });

  test('bills in 7 days ≤ 80% income → no LOW_SAFE_TO_SPEND alert', () => {
    const today = new Date(2026, 6, 15); // July 15
    const alerts = generateAlerts({
      bills: [bill({ due_date: '20', amount: 700 })], // 70% of income
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
      today,
    });

    const lowSts = alerts.filter((a) => a.type === 'LOW_SAFE_TO_SPEND');
    expect(lowSts.length).toBe(0);
  });

  test('multiple bills aggregated for LOW_SAFE_TO_SPEND', () => {
    const today = new Date(2026, 6, 15); // July 15
    const alerts = generateAlerts({
      bills: [
        bill({ id: 1, due_date: '18', amount: 400 }),
        bill({ id: 2, due_date: '20', amount: 500 }), // total = 900 > 80% of 1000
      ],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: defaultPaySchedule,
      today,
    });

    const lowSts = alerts.find((a) => a.type === 'LOW_SAFE_TO_SPEND');
    expect(lowSts).toBeDefined();
    expect(lowSts!.severity).toBe('warning');
  });

  test('zero income → no LOW_SAFE_TO_SPEND alert', () => {
    const today = new Date(2026, 6, 15); // July 15
    const alerts = generateAlerts({
      bills: [bill({ due_date: '20', amount: 500 })],
      weightedWeeklyIncome: 0,
      paySchedule: defaultPaySchedule,
      today,
    });

    const lowSts = alerts.filter((a) => a.type === 'LOW_SAFE_TO_SPEND');
    expect(lowSts.length).toBe(0);
  });

  // ── BILL_DUE_BEFORE_PAYCHECK ─────────────────────────────────

  test('bill due before next paycheck → BILL_DUE_BEFORE_PAYCHECK critical', () => {
    // With biweekly, next paycheck is 14 days out
    // Bill due on day 10 (today is day 5), so it's due before the paycheck
    const today = new Date(2026, 6, 5); // July 5
    const alerts = generateAlerts({
      bills: [bill({ due_date: '10', amount: 300 })],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: 'biweekly',
      today,
    });

    const beforePaycheck = alerts.find(
      (a) => a.type === 'BILL_DUE_BEFORE_PAYCHECK'
    );
    expect(beforePaycheck).toBeDefined();
    expect(beforePaycheck!.severity).toBe('critical');
    expect(beforePaycheck!.bill).toBeDefined();
    expect(beforePaycheck!.bill!.name).toBe('Rent');
    expect(beforePaycheck!.message).toMatch(/before your next paycheck/);
  });

  test('bill due after next paycheck → no BILL_DUE_BEFORE_PAYCHECK alert', () => {
    // With biweekly, next paycheck is 14 days out from July 5 → July 19
    // Bill due on day 25 is after that
    const today = new Date(2026, 6, 5); // July 5
    const alerts = generateAlerts({
      bills: [bill({ due_date: '25', amount: 300 })],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: 'biweekly',
      today,
    });

    const beforePaycheck = alerts.filter(
      (a) => a.type === 'BILL_DUE_BEFORE_PAYCHECK'
    );
    expect(beforePaycheck.length).toBe(0);
  });

  // ── Multiple alerts aggregated ───────────────────────────────

  test('multiple alerts aggregated correctly', () => {
    // Today: July 5, biweekly pay schedule (next paycheck July 19)
    // Bill 1: due July 7 (within 3 days → IMMINENT_BILL, also before paycheck)
    // Bill 2: due July 12 (within 7 days, before paycheck)
    // Total week bills = 800, income = 500 → LOW_SAFE_TO_SPEND critical
    const today = new Date(2026, 6, 5); // July 5
    const alerts = generateAlerts({
      bills: [
        bill({ id: 1, due_date: '7', amount: 300 }), // within 3 days
        bill({ id: 2, due_date: '12', amount: 500 }), // within 7 days, before paycheck
      ],
      weightedWeeklyIncome: 500,
      paySchedule: 'biweekly',
      today,
    });

    // Should have: IMMINENT_BILL for bill 1, LOW_SAFE_TO_SPEND (critical), 
    // BILL_DUE_BEFORE_PAYCHECK for both bills
    expect(alerts.length).toBe(4);

    const imminentAlerts = alerts.filter((a) => a.type === 'IMMINENT_BILL');
    expect(imminentAlerts.length).toBe(1);
    expect(imminentAlerts[0].bill!.id).toBe(1);

    const lowStsAlerts = alerts.filter((a) => a.type === 'LOW_SAFE_TO_SPEND');
    expect(lowStsAlerts.length).toBe(1);
    expect(lowStsAlerts[0].severity).toBe('critical');

    const beforePaycheckAlerts = alerts.filter(
      (a) => a.type === 'BILL_DUE_BEFORE_PAYCHECK'
    );
    expect(beforePaycheckAlerts.length).toBe(2);
  });

  test('all alert objects have required fields', () => {
    const today = new Date(2026, 6, 21); // July 21
    const alerts = generateAlerts({
      bills: [bill({ due_date: '22', amount: 600 })],
      weightedWeeklyIncome: 500,
      paySchedule: 'weekly',
      today,
    });

    for (const alert of alerts) {
      expect(alert).toHaveProperty('type');
      expect(alert).toHaveProperty('severity');
      expect(alert).toHaveProperty('title');
      expect(alert).toHaveProperty('message');
      expect(['warning', 'critical', 'info']).toContain(alert.severity);
      expect([
        'IMMINENT_BILL',
        'LOW_SAFE_TO_SPEND',
        'BILL_DUE_BEFORE_PAYCHECK',
        'BILL_INCREASE',
        'SUBSCRIPTION_REVIEW',
        'OVERTIME_OPPORTUNITY',
      ]).toContain(alert.type);
    }
  });

  // ── Edge Cases ───────────────────────────────────────────────

  test('bill due on exact paycheck date → no BILL_DUE_BEFORE_PAYCHECK (not BEFORE)', () => {
    // With weekly on Monday July 13: next paycheck is July 13
    // Bill due on July 13: not "before" paycheck
    const today = new Date(2026, 6, 13); // July 13 (Monday)
    const alerts = generateAlerts({
      bills: [bill({ due_date: '13', amount: 300 })],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: 'weekly',
      today,
    });

    const beforePaycheck = alerts.filter(
      (a) => a.type === 'BILL_DUE_BEFORE_PAYCHECK'
    );
    expect(beforePaycheck.length).toBe(0);
  });

  test('custom today date is respected', () => {
    const alerts = generateAlerts({
      bills: [bill({ due_date: '15', amount: 200 })],
      weightedWeeklyIncome: defaultIncome,
      paySchedule: 'biweekly',
      today: new Date(2026, 6, 14), // July 14 — bill due tomorrow
    });

    const imminent = alerts.find((a) => a.type === 'IMMINENT_BILL');
    expect(imminent).toBeDefined();
    expect(imminent!.bill!.projected_due_date).toBe('2026-07-15');
  });

  test('multiple IMMINENT bills each get their own alert', () => {
    const today = new Date(2026, 6, 10); // July 10
    const alerts = generateAlerts({
      bills: [
        bill({ id: 1, due_date: '11', amount: 100, name: 'Internet' }),
        bill({ id: 2, due_date: '12', amount: 200, name: 'Phone' }),
      ],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today,
    });

    const imminent = alerts.filter((a) => a.type === 'IMMINENT_BILL');
    expect(imminent.length).toBe(2);
    expect(imminent.map((a) => a.bill!.name)).toContain('Internet');
    expect(imminent.map((a) => a.bill!.name)).toContain('Phone');
  });

  // ── BILL_INCREASE ─────────────────────────────────────────────

  test('amount increased >10% with history → BILL_INCREASE alert', () => {
    const alerts = generateAlerts({
      bills: [bill({ id: 1, amount: 150, name: 'Netflix' })],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today: new Date(2026, 6, 15),
      billHistory: [
        { bill_id: 1, amount: 100, recorded_at: '2026-06-01' },
        { bill_id: 1, amount: 110, recorded_at: '2026-07-01' },
      ],
    });

    const increaseAlerts = alerts.filter((a) => a.type === 'BILL_INCREASE');
    expect(increaseAlerts.length).toBe(1);
    expect(increaseAlerts[0].severity).toBe('warning');
    expect(increaseAlerts[0].title).toBe('Bill increase detected');
    expect(increaseAlerts[0].message).toMatch(/Netflix increased from \$110\.00 to \$150\.00/);
    expect(increaseAlerts[0].percentIncrease).toBe(36);
    expect(increaseAlerts[0].bill).toBeDefined();
    expect(increaseAlerts[0].bill!.name).toBe('Netflix');
  });

  test('amount increased by exactly 10% → no BILL_INCREASE alert', () => {
    const alerts = generateAlerts({
      bills: [bill({ id: 1, amount: 110, name: 'Netflix' })],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today: new Date(2026, 6, 15),
      billHistory: [
        { bill_id: 1, amount: 100, recorded_at: '2026-07-01' },
      ],
    });

    const increaseAlerts = alerts.filter((a) => a.type === 'BILL_INCREASE');
    expect(increaseAlerts.length).toBe(0);
  });

  test('amount decreased → no BILL_INCREASE alert', () => {
    const alerts = generateAlerts({
      bills: [bill({ id: 1, amount: 80, name: 'Netflix' })],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today: new Date(2026, 6, 15),
      billHistory: [
        { bill_id: 1, amount: 100, recorded_at: '2026-07-01' },
      ],
    });

    const increaseAlerts = alerts.filter((a) => a.type === 'BILL_INCREASE');
    expect(increaseAlerts.length).toBe(0);
  });

  test('no bill history → no BILL_INCREASE alert', () => {
    const alerts = generateAlerts({
      bills: [bill({ id: 1, amount: 150, name: 'Netflix' })],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today: new Date(2026, 6, 15),
    });

    const increaseAlerts = alerts.filter((a) => a.type === 'BILL_INCREASE');
    expect(increaseAlerts.length).toBe(0);
  });

  // ── SUBSCRIPTION_REVIEW ───────────────────────────────────────

  test('subscriptions never reviewed → SUBSCRIPTION_REVIEW alert', () => {
    const alerts = generateAlerts({
      bills: [
        bill({ id: 1, name: 'Netflix', amount: 15, category: 'subscriptions' }),
        bill({ id: 2, name: 'Spotify', amount: 10, category: 'subscriptions' }),
        bill({ id: 3, name: 'Rent', amount: 500, category: 'rent' }),
      ],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today: new Date(2026, 6, 15),
    });

    const reviewAlerts = alerts.filter((a) => a.type === 'SUBSCRIPTION_REVIEW');
    expect(reviewAlerts.length).toBe(1);
    expect(reviewAlerts[0].severity).toBe('warning');
    expect(reviewAlerts[0].title).toBe('Review your subscriptions');
    expect(reviewAlerts[0].subscriptionCount).toBe(2);
    expect(reviewAlerts[0].totalMonthly).toBe(25);
    expect(reviewAlerts[0].message).toMatch(/2 subscriptions totaling \$25\.00\/mo/);
  });

  test('subscriptions reviewed recently → no SUBSCRIPTION_REVIEW alert', () => {
    const recentlyReviewed = daysFromNow(-5); // 5 days ago
    const alerts = generateAlerts({
      bills: [
        {
          ...bill({ id: 1, name: 'Netflix', amount: 15, category: 'subscriptions' }),
          last_reviewed_at: recentlyReviewed,
        },
        {
          ...bill({ id: 2, name: 'Spotify', amount: 10, category: 'subscriptions' }),
          last_reviewed_at: recentlyReviewed,
        },
      ],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today: new Date(2026, 6, 15),
    });

    const reviewAlerts = alerts.filter((a) => a.type === 'SUBSCRIPTION_REVIEW');
    expect(reviewAlerts.length).toBe(0);
  });

  test('subscription reviewed 31 days ago → SUBSCRIPTION_REVIEW alert', () => {
    // today is July 15, so 31+ days ago is June 14 or earlier
    const alerts = generateAlerts({
      bills: [
        {
          ...bill({ id: 1, name: 'Netflix', amount: 15, category: 'subscriptions' }),
          last_reviewed_at: '2026-06-14',
        },
      ],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today: new Date(2026, 6, 15),
    });

    const reviewAlerts = alerts.filter((a) => a.type === 'SUBSCRIPTION_REVIEW');
    expect(reviewAlerts.length).toBe(1);
    expect(reviewAlerts[0].subscriptionCount).toBe(1);
    expect(reviewAlerts[0].totalMonthly).toBe(15);
  });

  test('no subscriptions → no SUBSCRIPTION_REVIEW alert', () => {
    const alerts = generateAlerts({
      bills: [
        bill({ id: 1, name: 'Rent', amount: 500, category: 'rent' }),
        bill({ id: 2, name: 'Groceries', amount: 200, category: 'groceries' }),
      ],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today: new Date(2026, 6, 15),
    });

    const reviewAlerts = alerts.filter((a) => a.type === 'SUBSCRIPTION_REVIEW');
    expect(reviewAlerts.length).toBe(0);
  });

  // ── OVERTIME_OPPORTUNITY ────────────────────────────────────────

  test('low safe-to-spend + recent overtime → OVERTIME_OPPORTUNITY with OT variant', () => {
    // Today: July 10, bill due July 15 ($900) > 80% of $1000 = low safe-to-spend
    const today = new Date(2026, 6, 10); // July 10
    const alerts = generateAlerts({
      bills: [bill({ id: 1, due_date: '15', amount: 900, name: 'Rent' })],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today,
      shifts: [
        { date: '2026-07-05', overtime_hours: 2, hourly_rate: 25 },
        { date: '2026-06-20', overtime_hours: 0, hourly_rate: 25 },
      ],
      averageHourlyRate: 25,
    });

    const otAlerts = alerts.filter((a) => a.type === 'OVERTIME_OPPORTUNITY');
    expect(otAlerts.length).toBe(1);
    expect(otAlerts[0].severity).toBe('info');
    expect(otAlerts[0].title).toBe('Pick up extra shifts?');
    expect(otAlerts[0].message).toMatch(/you've worked overtime recently/);
    expect(otAlerts[0].message).toMatch(/\$100\.00/); // $25/hr × 4 = $100
    expect(otAlerts[0].estimatedExtraIncome).toBe(100);
  });

  test('low safe-to-spend + no overtime history → OVERTIME_OPPORTUNITY generic variant', () => {
    // Today: July 10, bill due July 15 ($900) > 80% of $1000 = low safe-to-spend
    const today = new Date(2026, 6, 10); // July 10
    const alerts = generateAlerts({
      bills: [bill({ id: 1, due_date: '15', amount: 900, name: 'Rent' })],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today,
      shifts: [
        { date: '2026-07-05', overtime_hours: 0, hourly_rate: 20 },
      ],
      averageHourlyRate: 20,
    });

    const otAlerts = alerts.filter((a) => a.type === 'OVERTIME_OPPORTUNITY');
    expect(otAlerts.length).toBe(1);
    expect(otAlerts[0].severity).toBe('info');
    expect(otAlerts[0].title).toBe('Consider extra hours');
    expect(otAlerts[0].message).toBe('Your budget is tight. An extra shift could help bridge the gap.');
    expect(otAlerts[0].estimatedExtraIncome).toBe(80); // $20/hr × 4 = $80
  });

  test('safe-to-spend is fine → no OVERTIME_OPPORTUNITY alert', () => {
    // Today: July 10, bill due July 15 ($500) = 50% of $1000 = not low
    const today = new Date(2026, 6, 10); // July 10
    const alerts = generateAlerts({
      bills: [bill({ id: 1, due_date: '15', amount: 500, name: 'Rent' })],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today,
      shifts: [
        { date: '2026-07-05', overtime_hours: 3, hourly_rate: 25 },
      ],
      averageHourlyRate: 25,
    });

    const otAlerts = alerts.filter((a) => a.type === 'OVERTIME_OPPORTUNITY');
    expect(otAlerts.length).toBe(0);
  });

  test('low safe-to-spend + OT older than 30 days → generic variant', () => {
    // Today: July 15, OT only on June 14 (31 days ago), bill $900 > 80% of $1000
    const today = new Date(2026, 6, 15); // July 15
    const alerts = generateAlerts({
      bills: [bill({ id: 1, due_date: '18', amount: 900, name: 'Rent' })],
      weightedWeeklyIncome: 1000,
      paySchedule: 'biweekly',
      today,
      shifts: [
        { date: '2026-06-14', overtime_hours: 2, hourly_rate: 30 },
      ],
      averageHourlyRate: 30,
    });

    const otAlerts = alerts.filter((a) => a.type === 'OVERTIME_OPPORTUNITY');
    expect(otAlerts.length).toBe(1);
    expect(otAlerts[0].title).toBe('Consider extra hours'); // generic, not OT variant
    expect(otAlerts[0].estimatedExtraIncome).toBe(120); // $30/hr × 4
  });
});
