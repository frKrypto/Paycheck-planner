import apiClient from './client';

export type EmergencyFundRating = 'critical' | 'low' | 'adequate' | 'strong';

export interface EmergencyFundResponse {
  daysCovered: number;
  monthlyExpenses: number;
  dailyRate: number;
  savings: number;
  rating: EmergencyFundRating;
}

export async function fetchEmergencyFund(savings: number): Promise<EmergencyFundResponse> {
  const res = await apiClient.get<EmergencyFundResponse>('/emergency-fund', {
    params: { savings },
  });
  return res.data;
}
