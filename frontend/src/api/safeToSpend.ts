import apiClient from './client';
import type { UpcomingBill } from './bills';

export type IncomeVolatility = 'stable' | 'moderate' | 'volatile';

export interface SafeToSpendDetails {
  daysUntilPaycheck: number;
  totalBillsDue: number;
  availableAfterBills: number;
  dailyAmount: number;
  bufferRate: number;
  billsConsidered: number;
  /** Array of warning codes (e.g. 'income_below_bills', 'income_trending_down') */
  warnings: string[];
  /** @deprecated use warnings array; kept for backward compatibility */
  warning?: string | null;
  /** Income predictability: 'stable' | 'moderate' | 'volatile' */
  incomeVolatility: IncomeVolatility;
  /** Weighted 4-week rolling average income */
  weightedAvgIncome: number;
}

export interface SafeToSpendResponse {
  safeToSpend: number;
  details: SafeToSpendDetails;
  upcomingBills: UpcomingBill[];
  expectedPaycheckAmount: number;
  nextPaycheckDate: string;
}

export async function fetchSafeToSpend(balance: number): Promise<SafeToSpendResponse> {
  const res = await apiClient.get<SafeToSpendResponse>('/safe-to-spend', {
    params: { balance },
  });
  return res.data;
}
