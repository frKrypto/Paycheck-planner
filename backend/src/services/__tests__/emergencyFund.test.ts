import { calculateEmergencyFund, normalizeToMonthlyAmount, getRating } from '../emergencyFund';

describe('normalizeToMonthlyAmount', () => {
  test('monthly bill → amount unchanged', () => {
    expect(normalizeToMonthlyAmount(100, 'monthly')).toBe(100);
  });

  test('weekly bill → multiplied by 52/12', () => {
    const expected = 100 * (52 / 12);
    expect(normalizeToMonthlyAmount(100, 'weekly')).toBe(expected);
  });

  test('biweekly bill → multiplied by 26/12', () => {
    const expected = 100 * (26 / 12);
    expect(normalizeToMonthlyAmount(100, 'biweekly')).toBe(expected);
  });

  test('semi-monthly bill → multiplied by 2', () => {
    expect(normalizeToMonthlyAmount(100, 'semi-monthly')).toBe(200);
  });

  test('unknown frequency throws an error', () => {
    expect(() => normalizeToMonthlyAmount(100, 'yearly')).toThrow('Unknown bill frequency: yearly');
  });
});

describe('getRating', () => {
  test('< 7 days → critical', () => {
    expect(getRating(0)).toBe('critical');
    expect(getRating(3)).toBe('critical');
    expect(getRating(6)).toBe('critical');
  });

  test('7 to < 30 days → low', () => {
    expect(getRating(7)).toBe('low');
    expect(getRating(15)).toBe('low');
    expect(getRating(29)).toBe('low');
  });

  test('30 to < 90 days → adequate', () => {
    expect(getRating(30)).toBe('adequate');
    expect(getRating(60)).toBe('adequate');
    expect(getRating(89)).toBe('adequate');
  });

  test('90+ days → strong', () => {
    expect(getRating(90)).toBe('strong');
    expect(getRating(365)).toBe('strong');
    expect(getRating(Infinity)).toBe('strong');
  });
});

describe('calculateEmergencyFund', () => {
  test('normal case — computes coverage correctly', () => {
    // $3000 monthly bills + $600 variable expenses = $3600/month = $120/day
    // $6000 savings / $120 = 50 days → "adequate"
    const result = calculateEmergencyFund({
      monthlyBillsTotal: 3000,
      averageMonthlyExpenses: 600,
      savings: 6000,
    });

    expect(result.monthlyExpenses).toBe(3600);
    expect(result.dailyRate).toBe(120);
    expect(result.savings).toBe(6000);
    expect(result.daysCovered).toBe(50);
    expect(result.rating).toBe('adequate');
  });

  test('low coverage — under 7 days', () => {
    // $3000 monthly / 30 = $100/day, $500 savings → 5 days
    const result = calculateEmergencyFund({
      monthlyBillsTotal: 3000,
      averageMonthlyExpenses: 0,
      savings: 500,
    });

    expect(result.daysCovered).toBe(5);
    expect(result.rating).toBe('critical');
  });

  test('strong coverage — over 90 days', () => {
    // $2000 monthly / 30 ≈ $66.67/day, $20000 savings → ~300 days
    const result = calculateEmergencyFund({
      monthlyBillsTotal: 2000,
      averageMonthlyExpenses: 0,
      savings: 20000,
    });

    expect(result.daysCovered).toBe(300);
    expect(result.rating).toBe('strong');
  });

  test('zero savings → daysCovered = 0, rating critical', () => {
    const result = calculateEmergencyFund({
      monthlyBillsTotal: 2000,
      averageMonthlyExpenses: 0,
      savings: 0,
    });

    expect(result.daysCovered).toBe(0);
    expect(result.rating).toBe('critical');
  });

  test('zero expenses and positive savings → Infinity days, rating strong', () => {
    const result = calculateEmergencyFund({
      monthlyBillsTotal: 0,
      averageMonthlyExpenses: 0,
      savings: 10000,
    });

    expect(result.daysCovered).toBe(Infinity);
    expect(result.dailyRate).toBe(0);
    expect(result.rating).toBe('strong');
  });

  test('zero expenses and zero savings → 0 days, rating critical', () => {
    const result = calculateEmergencyFund({
      monthlyBillsTotal: 0,
      averageMonthlyExpenses: 0,
      savings: 0,
    });

    expect(result.daysCovered).toBe(0);
    expect(result.rating).toBe('critical');
  });
});
