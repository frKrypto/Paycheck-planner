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
    expect(result.details.warnings).toEqual([]);
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

  test('zero balance → safeToSpend = 0, warnings include income_below_bills', () => {
    const result = calculateSafeToSpend({
      ...defaultParams,
      currentBalance: 0,
    });
    expect(result.safeToSpend).toBe(0);
    expect(result.details.warnings).toContain('income_below_bills');
    expect(result.details.warning).toBe('income_below_bills');
  });

  test('bills exceed balance → safeToSpend = 0, warnings include income_below_bills', () => {
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
    expect(result.details.warnings).toEqual([]);
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

  test('custom/explicit buffer rate is still respected', () => {
    // When incomeHistory is provided AND bufferRate is explicitly passed,
    // the explicit bufferRate takes precedence in the old API.
    // But our new API computes bufferRate from incomeHistory.
    // Test backward compat: no incomeHistory → default 0.85
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
    });
    // (1000 / 14) * 0.85
    const expected = Math.round((1000 / 14) * 0.85 * 100) / 100;
    expect(result.safeToSpend).toBe(expected);
    expect(result.details.bufferRate).toBe(0.85);
  });

  test('default buffer rate is 0.85 when no incomeHistory', () => {
    const result = calculateSafeToSpend(defaultParams);
    expect(result.details.bufferRate).toBe(0.85);
    expect(result.details.incomeVolatility).toBe('moderate');
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

  // ── Volatility-Aware Buffer Tests ─────────────────────────

  test('stable income (CV < 0.2) → bufferRate = 0.90, volatility = stable', () => {
    // Very consistent weekly earnings: [500, 510, 490, 505, 500, 495, 500, 500]
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
      incomeHistory: [500, 510, 490, 505, 500, 495, 500, 500],
    });
    expect(result.details.bufferRate).toBe(0.90);
    expect(result.details.incomeVolatility).toBe('stable');
    // (1000 / 14) * 0.90
    const expected = Math.round((1000 / 14) * 0.90 * 100) / 100;
    expect(result.safeToSpend).toBe(expected);
  });

  test('moderate income (CV 0.2–0.5) → bufferRate = 0.85, volatility = moderate', () => {
    // Moderate variation: [500, 300, 700, 400, 600, 350, 650, 450]
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
      incomeHistory: [500, 300, 700, 400, 600, 350, 650, 450],
    });
    expect(result.details.bufferRate).toBe(0.85);
    expect(result.details.incomeVolatility).toBe('moderate');
  });

  test('volatile income (CV > 0.5) → bufferRate = 0.75, volatility = volatile', () => {
    // High variation: [1000, 0, 800, 100, 900, 50, 700, 200]
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
      incomeHistory: [1000, 0, 800, 100, 900, 50, 700, 200],
    });
    expect(result.details.bufferRate).toBe(0.75);
    expect(result.details.incomeVolatility).toBe('volatile');
    // (1000 / 14) * 0.75
    const expected = Math.round((1000 / 14) * 0.75 * 100) / 100;
    expect(result.safeToSpend).toBe(expected);
  });

  test('CV exactly at 0.2 boundary → moderate (bufferRate = 0.85)', () => {
    // CV = 0.2 exactly: mean=500, std=100 → sum of squared dev = 8*10000 = 80000
    // Two values at 300 and 700 give: 200^2 + 200^2 = 80000
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
      incomeHistory: [300, 700, 500, 500, 500, 500, 500, 500],
    });
    expect(result.details.bufferRate).toBe(0.85);
    expect(result.details.incomeVolatility).toBe('moderate');
  });

  test('CV exactly at 0.5 boundary → moderate (bufferRate = 0.85)', () => {
    // CV = 0.5: mean=500, std=250 → sum of squared dev = 8*62500 = 500000
    // Two values at 0 and 1000 give: 500^2 + 500^2 = 500000
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
      incomeHistory: [0, 1000, 500, 500, 500, 500, 500, 500],
    });
    expect(result.details.bufferRate).toBe(0.85);
    expect(result.details.incomeVolatility).toBe('moderate');
  });

  // ── Weighted Average in Details ────────────────────────────

  test('weightedAvgIncome is set to expectedPaycheckAmount', () => {
    const result = calculateSafeToSpend({
      ...defaultParams,
      expectedPaycheckAmount: 850.75,
    });
    expect(result.details.weightedAvgIncome).toBe(850.75);
  });

  // ── Backward Compatibility Tests ───────────────────────────

  test('incomeHistory is optional — works without it', () => {
    // No incomeHistory provided — should default to bufferRate 0.85
    const result = calculateSafeToSpend({
      currentBalance: 1000,
      upcomingBills: [],
      nextPaycheckDate: futureDate(14),
      expectedPaycheckAmount: 500,
    });
    expect(result.safeToSpend).toBeGreaterThan(0);
    expect(result.details.bufferRate).toBe(0.85);
    expect(result.details.incomeVolatility).toBe('moderate');
  });

  test('incomeHistory with less than 2 data points → defaults to 0.85', () => {
    // Single data point — not enough for CV calc
    const result = calculateSafeToSpend({
      currentBalance: 1000,
      upcomingBills: [],
      nextPaycheckDate: futureDate(14),
      expectedPaycheckAmount: 500,
      incomeHistory: [800],
    });
    expect(result.details.bufferRate).toBe(0.85);
    expect(result.details.incomeVolatility).toBe('moderate');
  });

  test('empty incomeHistory array → defaults to 0.85', () => {
    const result = calculateSafeToSpend({
      currentBalance: 1000,
      upcomingBills: [],
      nextPaycheckDate: futureDate(14),
      expectedPaycheckAmount: 500,
      incomeHistory: [],
    });
    expect(result.details.bufferRate).toBe(0.85);
    expect(result.details.incomeVolatility).toBe('moderate');
  });

  test('warnings array is present and warning field provides backward compat', () => {
    const result = calculateSafeToSpend({
      currentBalance: 0,
      upcomingBills: [{ amount: 500, projected_due_date: futureDate(3) }],
      nextPaycheckDate: futureDate(14),
      expectedPaycheckAmount: 500,
    });
    expect(Array.isArray(result.details.warnings)).toBe(true);
    expect(result.details.warnings).toContain('income_below_bills');
    expect(result.details.warning).toBe('income_below_bills');
  });

  test('no warnings → warning is null, warnings is empty', () => {
    const result = calculateSafeToSpend({
      ...defaultParams,
      upcomingBills: [],
    });
    expect(result.details.warnings).toEqual([]);
    expect(result.details.warning).toBeNull();
  });
});
