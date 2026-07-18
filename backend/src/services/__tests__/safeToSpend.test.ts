import { calculateSafeToSpend } from '../safeToSpend';

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

describe('calculateSafeToSpend', () => {
  const defaultParams = {
    currentBalance: 1000,
    upcomingBills: [
      { amount: 200, projected_due_date: futureDate(5) },
      { amount: 150, projected_due_date: futureDate(10) },
    ],
    nextPaycheckDate: futureDate(14),
    expectedPaycheckAmount: 1200,
  };

  // ── Normal Cases ──────────────────────────────────────────

  test('balance covers bills with buffer → returns positive daily amount', () => {
    const result = calculateSafeToSpend(defaultParams);
    expect(result.safeToSpend).toBeGreaterThan(0);
    expect(result.details.warning).toBeNull();
  });

  test('daily amount = (balance - bills) / days * 0.85', () => {
    const result = calculateSafeToSpend(defaultParams);
    // (1000 - 350) / 14 * 0.85 = 650 / 14 * 0.85 = 46.428... * 0.85 = 39.46...
    const expected = Math.round((1000 - 350) / 14 * 0.85 * 100) / 100;
    expect(result.safeToSpend).toBe(expected);
  });

  test('bills due outside the window are ignored', () => {
    const params = {
      ...defaultParams,
      upcomingBills: [
        // Due today or after — should be included
        { amount: 100, projected_due_date: futureDate(2) },
        // Due before today — should be ignored by the filter
        { amount: 500, projected_due_date: '2020-01-01' },
        // Due after paycheck — should be ignored
        { amount: 300, projected_due_date: futureDate(30) },
      ],
      nextPaycheckDate: futureDate(7),
    };
    const result = calculateSafeToSpend(params);
    expect(result.details.billsConsidered).toBe(1);
    expect(result.details.totalBillsDue).toBe(100);
  });

  // ── Edge Cases ────────────────────────────────────────────

  test('zero balance → safeToSpend = 0, warning = income_below_bills', () => {
    const result = calculateSafeToSpend({
      ...defaultParams,
      currentBalance: 0,
    });
    expect(result.safeToSpend).toBe(0);
    expect(result.details.warning).toBe('income_below_bills');
  });

  test('bills exceed balance → safeToSpend = 0, warning = income_below_bills', () => {
    const result = calculateSafeToSpend({
      ...defaultParams,
      currentBalance: 200,
      upcomingBills: [{ amount: 500, projected_due_date: futureDate(3) }],
    });
    expect(result.safeToSpend).toBe(0);
    expect(result.details.warning).toBe('income_below_bills');
    expect(result.details.availableAfterBills).toBe(-300);
  });

  test('no upcoming bills → safeToSpend = (balance / days) * 0.85', () => {
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
      nextPaycheckDate: futureDate(10),
    });
    expect(result.details.totalBillsDue).toBe(0);
    expect(result.details.billsConsidered).toBe(0);
    const expected = Math.round((1000 / 10) * 0.85 * 100) / 100;
    expect(result.safeToSpend).toBe(expected);
  });

  test('no income history (expectedPaycheckAmount=0, no bills) → safeToSpend computed normally', () => {
    // The function itself computes based on available data.
    // The "no_income_history" warning is set at the route layer.
    const result = calculateSafeToSpend({
      currentBalance: 500,
      upcomingBills: [],
      nextPaycheckDate: futureDate(7),
      expectedPaycheckAmount: 0,
    });
    expect(result.safeToSpend).toBeGreaterThan(0);
  });

  test('days until paycheck is 0 → falls back to 7 days', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
      nextPaycheckDate: yesterday.toISOString().split('T')[0],
    });
    expect(result.details.daysUntilPaycheck).toBe(7);
  });

  test('days until paycheck is negative → falls back to 7 days', () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
      nextPaycheckDate: lastWeek.toISOString().split('T')[0],
    });
    expect(result.details.daysUntilPaycheck).toBe(7);
  });

  test('very large balance → handles without overflow', () => {
    const result = calculateSafeToSpend({
      currentBalance: 9999999.99,
      upcomingBills: [{ amount: 100, projected_due_date: futureDate(3) }],
      nextPaycheckDate: futureDate(14),
      expectedPaycheckAmount: 5000,
    });
    expect(result.safeToSpend).toBeGreaterThan(0);
    expect(Number.isFinite(result.safeToSpend)).toBe(true);
    expect(Number.isFinite(result.details.availableAfterBills)).toBe(true);
  });

  test('zero upcoming bills and zero balance → safeToSpend = 0', () => {
    const result = calculateSafeToSpend({
      currentBalance: 0,
      upcomingBills: [],
      nextPaycheckDate: futureDate(7),
      expectedPaycheckAmount: 0,
    });
    expect(result.safeToSpend).toBe(0);
  });

  // ── Boundary Cases ────────────────────────────────────────

  test('balance exactly equals bills → safeToSpend = 0', () => {
    const result = calculateSafeToSpend({
      currentBalance: 500,
      upcomingBills: [
        { amount: 200, projected_due_date: futureDate(3) },
        { amount: 300, projected_due_date: futureDate(5) },
      ],
      nextPaycheckDate: futureDate(7),
      expectedPaycheckAmount: 1000,
    });
    expect(result.details.availableAfterBills).toBe(0);
    expect(result.safeToSpend).toBe(0);
  });

  test('balance = bills + 1 cent → returns tiny positive daily amount', () => {
    const result = calculateSafeToSpend({
      currentBalance: 500.01,
      upcomingBills: [{ amount: 500, projected_due_date: futureDate(3) }],
      nextPaycheckDate: futureDate(10),
      expectedPaycheckAmount: 1000,
    });
    expect(result.details.availableAfterBills).toBe(0.01);
    // (0.01 / 10) * 0.85 = 0.00085, rounded to 0.00
    expect(result.safeToSpend).toBe(0);
    // Pre-buffer daily also rounds down: 0.01/10 = 0.001, rounds to 0.00
    expect(result.details.dailyAmount).toBe(0);
  });

  test('custom buffer rate is respected', () => {
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
      bufferRate: 0.5,
    });
    // (1000 / 14) * 0.5
    const expected = Math.round((1000 / 14) * 0.5 * 100) / 100;
    expect(result.safeToSpend).toBe(expected);
    expect(result.details.bufferRate).toBe(0.5);
  });

  test('default buffer rate is 0.85', () => {
    const result = calculateSafeToSpend(defaultParams);
    expect(result.details.bufferRate).toBe(0.85);
  });

  test('details.dailyAmount is the pre-buffer daily amount', () => {
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
    });
    const preBuffer = Math.round((1000 / 14) * 100) / 100;
    expect(result.details.dailyAmount).toBe(preBuffer);
    // safeToSpend should be preBuffer * 0.85 (rounded)
    expect(result.safeToSpend).toBeLessThan(result.details.dailyAmount);
  });
});
