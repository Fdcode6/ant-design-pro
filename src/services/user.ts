import { request } from '@umijs/max';
import type { UserItem } from '@/pages/UserManagement';

// 获取用户列表
export async function getUsers(params: {
  current?: number;
  pageSize?: number;
  username?: string;
  status?: string;
}) {
  return request<{
    data: UserItem[];
    total: number;
    success: boolean;
  }>('/api/users', {
    method: 'GET',
    params,
  });
}

// 创建用户
export async function createUser(data: {
  username: string;
  realName: string;
  password: string;
  initialBalance: number;
  role?: string;
}) {
  return request<{
    success: boolean;
    data: UserItem;
  }>('/api/users', {
    method: 'POST',
    data,
  });
}

// 更新用户
export async function updateUser(id: string, data: Partial<UserItem>) {
  return request<{
    success: boolean;
  }>(`/api/users/${id}`, {
    method: 'PUT',
    data,
  });
}

// 调整用户余额
export async function adjustBalance(id: string, data: {
  type: 'increase' | 'decrease';
  amount: number;
  reason: string;
}) {
  console.log('Adjusting balance:', id, data);
  try {
    const response = await request<{
      success: boolean;
    }>(`/api/users/${id}/balance`, {
      method: 'POST',
      data,
    });
    console.log('Balance adjustment response:', response);
    return response.success;
  } catch (error) {
    console.error('Balance adjustment error:', error);
    return false;
  }
} 