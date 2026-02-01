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
      // 调用后端统计 API
      const response = await request('/api/dashboard/stats', {
        method: 'GET',
        params: {
          userId: userId,
          isAdmin: isAdmin ? 'true' : 'false',
        },
      });

      if (response.success && response.data) {
        const data = response.data;

        // 获取当前月份用于默认趋势数据
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        setStats({
          totalUsers: data.totalUsers || 0,
          totalBalance: data.totalBalance || 0,
          monthlyIncome: data.monthlyIncome || 0,
          monthlyExpense: data.monthlyExpense || 0,
          trends: data.trends && data.trends.length > 0 ? data.trends : [
            { date: currentMonth, type: '充值', value: 0 },
            { date: currentMonth, type: '消费', value: 0 },
          ],
        });
      } else {
        message.error('获取数据失败');
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