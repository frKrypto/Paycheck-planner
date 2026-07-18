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
  /** Weighted 4-week avg: recent weeks count 3x, middle 1x, older 0.5x */
  weighted_4wk_avg: number;
  total_this_month: number;
  shift_count: number;
  pay_schedule: string;
}

export interface CreateShiftPayload {
  date: string;
  hours_worked: number;
  hourly_rate: number;
  tips?: number;
  overtime_hours?: number;
}

export async function fetchShifts(): Promise<Shift[]> {
  const res = await apiClient.get<Shift[]>('/shifts');
  return res.data;
}

export async function fetchIncomeStats(): Promise<IncomeStats> {
  const res = await apiClient.get<IncomeStats>('/income/stats');
  return res.data;
}

export async function createShift(payload: CreateShiftPayload): Promise<Shift> {
  const res = await apiClient.post<Shift>('/shifts', payload);
  return res.data;
}

export async function deleteShift(id: number): Promise<void> {
  await apiClient.delete(`/shifts/${id}`);
}
