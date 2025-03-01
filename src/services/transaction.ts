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
  console.log('前端请求交易记录参数:', params);
  return request<{
    data: TransactionRecord[];
    total: number;
    success: boolean;
  }>('/api/transactions', {
    method: 'GET',
    params: {
      ...params,
      page: params.current, // 添加page参数以兼容后端
    },
  });
}

// 调整用户余额
export async function adjustUserBalance(data: {
  userId: string;
  type: 'increase' | 'decrease';
  amount: number;
  reason: string;
}) {
  console.log('Adjusting balance via transaction service:', data);
  return request<{
    success: boolean;
  }>(`/api/users/${data.userId}/balance`, {
    method: 'POST',
    data: {
      type: data.type,
      amount: data.amount,
      reason: data.reason,
    },
  });
}

// 获取用户下拉选项
export async function getUserOptions() {
  return request<{
    data: {
      value: string;
      label: string;
    }[];
    success: boolean;
  }>('/api/users/options');
} 