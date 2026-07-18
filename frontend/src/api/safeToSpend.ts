import apiClient from './client';
import type { UpcomingBill } from './bills';

export interface SafeToSpendDetails {
  daysUntilPaycheck: number;
  totalBillsDue: number;
  availableAfterBills: number;
  dailyAmount: number;
  bufferRate: number;
  billsConsidered: number;
  warning?: 'no_income_history' | 'income_below_bills';
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
