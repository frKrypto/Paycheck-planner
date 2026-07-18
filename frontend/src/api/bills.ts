import apiClient from './client';

export interface Bill {
  id: number;
  user_id: number;
  name: string;
  amount: number;
  due_date: string;
  frequency: string;
  category: string;
  created_at: string;
}

export interface UpcomingBill extends Bill {
  projected_due_date: string;
}

export async function fetchBills(params?: { category?: string }): Promise<Bill[]> {
  const res = await apiClient.get<Bill[]>('/bills', { params });
  return res.data;
}

export async function fetchUpcomingBills(): Promise<UpcomingBill[]> {
  const res = await apiClient.get<UpcomingBill[]>('/bills/upcoming');
  return res.data;
}
