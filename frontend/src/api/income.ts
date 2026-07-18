import apiClient from './client';

export interface Shift {
  id: number;
  user_id: number;
  date: string;
  hours_worked: number;
  hourly_rate: number;
  tips: number;
  overtime_hours: number;
  created_at: string;
}

export interface IncomeStats {
  rolling_4wk_avg: number;
  total_this_month: number;
  shift_count: number;
  pay_schedule: string;
}

export async function fetchShifts(): Promise<Shift[]> {
  const res = await apiClient.get<Shift[]>('/shifts');
  return res.data;
}

export async function fetchIncomeStats(): Promise<IncomeStats> {
  const res = await apiClient.get<IncomeStats>('/income/stats');
  return res.data;
}
