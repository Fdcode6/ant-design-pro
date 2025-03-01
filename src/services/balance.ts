import { request } from '@umijs/max';
import type { TransactionRecord } from '@/pages/BalanceManagement';

// 获取交易记录列表
export async function getTransactions(params: {
  current?: number;
  pageSize?: number;
  username?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
}) {
  return request<{
    data: TransactionRecord[];
    total: number;
    success: boolean;
  }>('/api/transactions', {
    method: 'GET',
    params,
  });
}

// 获取用户列表（用于下拉选择）
export async function getUserOptions() {
  return request<{
    data: { label: string; value: string }[];
    success: boolean;
  }>('/api/users/options', {
    method: 'GET',
  });
} 