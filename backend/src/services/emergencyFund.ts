/**
 * Emergency Fund Calculator
 *
 * Pure function that computes how many days a user could survive
 * if income stopped, based on monthly expenses and savings.
 */

export type EmergencyFundRating = 'critical' | 'low' | 'adequate' | 'strong';

export interface EmergencyFundInput {
  /** Sum of all recurring bills normalized to monthly total */
  monthlyBillsTotal: number;
  /** Average monthly spend on one-off expenses (last 30 days) */
  averageMonthlyExpenses: number;
  /** User's current savings balance */
  savings: number;
}

export interface EmergencyFundResult {
  daysCovered: number;
  monthlyExpenses: number;
  dailyRate: number;
  savings: number;
  rating: EmergencyFundRating;
}

/**
 * Frequency multiplier to convert a bill amount to a monthly equivalent.
 */
const FREQUENCY_MULTIPLIERS: Record<string, number> = {
  monthly: 1,
  weekly: 52 / 12,
  biweekly: 26 / 12,
  'semi-monthly': 2,
};

/**
 * Normalize a bill amount to a monthly total based on its frequency.
 */
export function normalizeToMonthlyAmount(amount: number, frequency: string): number {
  const multiplier = FREQUENCY_MULTIPLIERS[frequency];
  if (multiplier === undefined) {
    throw new Error(`Unknown bill frequency: ${frequency}`);
  }
  return amount * multiplier;
}

/**
 * Compute the rating based on how many days the savings would cover.
 */
export function getRating(daysCovered: number): EmergencyFundRating {
  if (daysCovered < 7) return 'critical';
  if (daysCovered < 30) return 'low';
  if (daysCovered < 90) return 'adequate';
  return 'strong';
}

/**
 * Calculate emergency fund coverage.
 *
 * @returns An object with daysCovered, monthlyExpenses, dailyRate, savings, and rating.
 *          If monthlyExpenses is 0 (no bills or expenses), daysCovered is Infinity
 *          and rating is "strong".
 */
export function calculateEmergencyFund(input: EmergencyFundInput): EmergencyFundResult {
  const { monthlyBillsTotal, averageMonthlyExpenses, savings } = input;

  const monthlyExpenses = monthlyBillsTotal + averageMonthlyExpenses;
  const dailyRate = monthlyExpenses / 30;

  // If there are no expenses at all, the savings last indefinitely
  if (dailyRate === 0) {
    return {
      daysCovered: savings > 0 ? Infinity : 0,
      monthlyExpenses,
      dailyRate,
      savings,
      rating: savings > 0 ? 'strong' : 'critical',
    };
  }

  const daysCovered = savings / dailyRate;

  return {
    daysCovered,
    monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
    dailyRate: Math.round(dailyRate * 100) / 100,
    savings,
    rating: getRating(daysCovered),
  };
}
