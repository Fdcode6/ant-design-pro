import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, message } from 'antd';
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import RcResizeObserver from 'rc-resize-observer';
import { Column } from '@ant-design/charts';
import { request, useModel } from '@umijs/max';

// 统计数据类型
interface DashboardStats {
  totalUsers: number;
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  trends: Array<{
    date: string;
    type: string;
    value: number;
  }>;
}

const Dashboard: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const isAdmin = currentUser?.access === 'admin';
  const userId = currentUser?.userid;
  
  const [responsive, setResponsive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalBalance: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    trends: [],
  });

  // 从后端获取统计数据
  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        // 管理员可以查看所有数据
        // 获取用户统计
        const usersResponse = await request('/api/users', {
          method: 'GET',
          params: {
            pageSize: 1,
          },
        });
        
        // 获取交易记录统计
        const transactionsResponse = await request('/api/transactions', {
          method: 'GET',
          params: {
            pageSize: 100, // 获取足够的数据来计算
          },
        });
        
        if (usersResponse.success && transactionsResponse.success) {
          // 计算总用户数
          const totalUsers = usersResponse.total || 0;
          
          // 计算总余额和收支趋势
          let totalBalance = 0;
          let monthlyIncome = 0;
          let monthlyExpense = 0;
          
          // 获取所有用户
          const allUsersResponse = await request('/api/users', {
            method: 'GET',
            params: {
              pageSize: 999, // 获取所有用户
            },
          });
          
          if (allUsersResponse.success) {
            // 计算总余额
            totalBalance = allUsersResponse.data.reduce((sum: number, user: any) => sum + parseFloat(user.balance || 0), 0);
          }
          
          // 获取当前月份
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          
          // 处理交易记录
          const transactions = transactionsResponse.data || [];
          const trends: any[] = [];
          const monthlyData: Record<string, Record<string, number>> = {};
          
          transactions.forEach((transaction: any) => {
            // 计算本月收支
            const txDate = new Date(transaction.created_at);
            const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
            
            // 初始化月度数据
            if (!monthlyData[txMonth]) {
              monthlyData[txMonth] = { increase: 0, decrease: 0 };
            }
            
            // 累加月度数据
            const amount = parseFloat(transaction.amount || 0);
            monthlyData[txMonth][transaction.type] += amount;
            
            // 本月收支
            if (txMonth === currentMonth) {
              if (transaction.type === 'increase') {
                monthlyIncome += amount;
              } else {
                monthlyExpense += amount;
              }
            }
          });
          
          // 构建趋势数据
          Object.keys(monthlyData).sort().forEach(month => {
            trends.push({
              date: month,
              type: '充值',
              value: monthlyData[month].increase,
            });
            trends.push({
              date: month,
              type: '消费',
              value: monthlyData[month].decrease,
            });
          });
          
          setStats({
            totalUsers,
            totalBalance,
            monthlyIncome,
            monthlyExpense,
            trends: trends.length > 0 ? trends : [
              { date: currentMonth, type: '充值', value: 0 },
              { date: currentMonth, type: '消费', value: 0 },
            ],
          });
        } else {
          message.error('获取数据失败');
        }
      } else {
        // 普通用户只能查看自己的数据
        if (userId) {
          // 获取用户信息
          const userResponse = await request(`/api/users/${userId}`, {
            method: 'GET',
          });
          
          // 获取用户交易记录
          const transactionsResponse = await request('/api/transactions', {
            method: 'GET',
            params: {
              userId: userId,
              pageSize: 100, // 获取足够的数据来计算
            },
          });
          
          if (userResponse.success && transactionsResponse.success) {
            const userData = userResponse.data;
            const userBalance = parseFloat(userData.balance || 0);
            
            // 获取当前月份
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            // 处理交易记录
            const transactions = transactionsResponse.data || [];
            const trends: any[] = [];
            const monthlyData: Record<string, Record<string, number>> = {};
            
            let monthlyIncome = 0;
            let monthlyExpense = 0;
            
            transactions.forEach((transaction: any) => {
              // 计算本月收支
              const txDate = new Date(transaction.created_at);
              const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
              
              // 初始化月度数据
              if (!monthlyData[txMonth]) {
                monthlyData[txMonth] = { increase: 0, decrease: 0 };
              }
              
              // 累加月度数据
              const amount = parseFloat(transaction.amount || 0);
              monthlyData[txMonth][transaction.type] += amount;
              
              // 本月收支
              if (txMonth === currentMonth) {
                if (transaction.type === 'increase') {
                  monthlyIncome += amount;
                } else {
                  monthlyExpense += amount;
                }
              }
            });
            
            // 构建趋势数据
            Object.keys(monthlyData).sort().forEach(month => {
              trends.push({
                date: month,
                type: '充值',
                value: monthlyData[month].increase,
              });
              trends.push({
                date: month,
                type: '消费',
                value: monthlyData[month].decrease,
              });
            });
            
            setStats({
              totalUsers: 1, // 普通用户只有自己
              totalBalance: userBalance,
              monthlyIncome,
              monthlyExpense,
              trends: trends.length > 0 ? trends : [
                { date: currentMonth, type: '充值', value: 0 },
                { date: currentMonth, type: '消费', value: 0 },
              ],
            });
          } else {
            message.error('获取数据失败');
          }
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('获取仪表盘数据失败:', error);
      message.error('获取数据失败');
      setLoading(false);
    }
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchDashboardStats();
  }, [userId, isAdmin]);

  return (
    <RcResizeObserver
      key="resize-observer"
      onResize={(offset) => {
        setResponsive(offset.width < 596);
      }}
    >
      <ProCard
        title="数据概览"
        extra={<a onClick={fetchDashboardStats}>刷新</a>}
        split={responsive ? 'horizontal' : 'vertical'}
        headerBordered
        bordered
        loading={loading}
      >
        <ProCard split="horizontal">
          <ProCard split="horizontal">
            <ProCard split={responsive ? 'horizontal' : 'vertical'}>
              <StatisticCard
                statistic={{
                  title: isAdmin ? '总用户数' : '账户信息',
                  value: isAdmin ? stats.totalUsers : 1,
                  suffix: '人',
                }}
              />
              <StatisticCard
                statistic={{
                  title: isAdmin ? '总余额' : '我的余额',
                  value: stats.totalBalance,
                  precision: 2,
                  prefix: '¥',
                }}
              />
            </ProCard>
            <ProCard split={responsive ? 'horizontal' : 'vertical'}>
              <StatisticCard
                statistic={{
                  title: isAdmin ? '本月充值金额' : '本月充值',
                  value: stats.monthlyIncome,
                  precision: 2,
                  prefix: '¥',
                }}
              />
              <StatisticCard
                statistic={{
                  title: isAdmin ? '本月消费金额' : '本月消费',
                  value: stats.monthlyExpense,
                  precision: 2,
                  prefix: '¥',
                }}
              />
            </ProCard>
          </ProCard>
          <ProCard title={isAdmin ? "收支趋势" : "我的收支趋势"}>
            <Column
              data={stats.trends}
              isStack={true}
              xField="date"
              yField="value"
              seriesField="type"
              label={{
                position: 'middle',
              }}
              legend={{
                position: 'top-right',
              }}
            />
          </ProCard>
        </ProCard>
      </ProCard>
    </RcResizeObserver>
  );
};

export default Dashboard; 