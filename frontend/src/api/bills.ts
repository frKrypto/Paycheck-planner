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

export interface CreateBillPayload {
  name: string;
  amount: number;
  due_date: number;
  frequency: string;
  category: string;
}

export interface UpdateBillPayload {
  name?: string;
  amount?: number;
  due_date?: number;
  frequency?: string;
  category?: string;
}

export async function fetchBills(params?: { category?: string }): Promise<Bill[]> {
  const res = await apiClient.get<Bill[]>('/bills', { params });
  return res.data;
}

export async function fetchUpcomingBills(): Promise<UpcomingBill[]> {
  const res = await apiClient.get<UpcomingBill[]>('/bills/upcoming');
  return res.data;
}

export async function createBill(payload: CreateBillPayload): Promise<Bill> {
  const res = await apiClient.post<Bill>('/bills', payload);
  return res.data;
}

export async function updateBill(id: number, payload: UpdateBillPayload): Promise<Bill> {
  const res = await apiClient.put<Bill>(`/bills/${id}`, payload);
  return res.data;
}

export async function deleteBill(id: number): Promise<void> {
  await apiClient.delete(`/bills/${id}`);
}
