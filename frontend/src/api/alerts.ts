import apiClient from './client';

export interface AlertBill {
  id: number;
  name: string;
  amount: number;
  due_date: string;
  projected_due_date: string;
}

export interface BillAlert {
  type: 'IMMINENT_BILL' | 'LOW_SAFE_TO_SPEND' | 'BILL_DUE_BEFORE_PAYCHECK';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  bill?: AlertBill;
}

export interface AlertsResponse {
  alerts: BillAlert[];
  count: number;
}

export async function fetchAlerts(severity?: string): Promise<AlertsResponse> {
  const params: Record<string, string> = {};
  if (severity) {
    params.severity = severity;
  }
  const res = await apiClient.get<AlertsResponse>('/alerts', { params });
  return res.data;
}
