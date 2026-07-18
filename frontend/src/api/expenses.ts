import apiClient from './client';

export interface Expense {
  id: number;
  user_id: number;
  category: string;
  amount: number;
  date: string;
  description: string;
  created_at: string;
}

export interface CreateExpensePayload {
  category: string;
  amount: number;
  date: string;
  description?: string;
}

export async function fetchExpenses(
  params?: { start?: string; end?: string; category?: string }
): Promise<Expense[]> {
  const res = await apiClient.get<Expense[]>('/expenses', { params });
  return res.data;
}

export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  const res = await apiClient.post<Expense>('/expenses', payload);
  return res.data;
}

export async function deleteExpense(id: number): Promise<void> {
  await apiClient.delete(`/expenses/${id}`);
}
