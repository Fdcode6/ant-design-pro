import React, { useRef } from 'react';
import { ProTable, ActionType, ProFormInstance, ProColumns } from '@ant-design/pro-components';
import { Tag, message } from 'antd';
import dayjs from 'dayjs';
import { useModel, request } from '@umijs/max';

// 交易记录类型
export interface TransactionRecord {
  id: number;
  userId: number;
  username: string;
  type: 'increase' | 'decrease';
  amount: number;
  balance: number;
  reason: string;
  operator: string;
  createdAt: Date;
  created_at: string; // 添加这个字段以匹配API返回
}

const BalanceManagement: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const isAdmin = currentUser?.access === 'admin';
  const userId = currentUser?.userid;

  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();

  const columns: ProColumns<TransactionRecord>[] = [
    {
      title: '交易ID',
      dataIndex: 'id',
      search: false,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      ellipsis: true,
      formItemProps: {
        rules: [
          {
            required: false,
            message: '此项为可选项',
          },
        ],
      },
      // 普通用户不需要搜索用户名
      search: isAdmin,
    },
    {
      title: '类型',
      dataIndex: 'type',
      valueEnum: {
        increase: {
          text: '充值',
          status: 'Success',
        },
        decrease: {
          text: '消费',
          status: 'Error',
        },
      },
      render: (_: any, record: TransactionRecord) => (
        <Tag color={record.type === 'increase' ? 'green' : 'red'}>
          {record.type === 'increase' ? '充值' : '消费'}
        </Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      search: false,
      render: (_: any, record: TransactionRecord) => (
        <span style={{ color: record.type === 'increase' ? 'green' : 'red' }}>
          {record.type === 'increase' ? '+' : '-'}
          {record.amount}
        </span>
      ),
    },
    {
      title: '余额',
      dataIndex: 'balance',
      search: false,
    },
    {
      title: '原因',
      dataIndex: 'reason',
      ellipsis: true,
      search: false,
    },
    {
      title: '操作员',
      dataIndex: 'operator',
      search: false,
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      sorter: true,
      search: false,
      render: (_: any, record: TransactionRecord) => dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <ProTable<TransactionRecord>
        headerTitle="余额管理"
        actionRef={actionRef}
        formRef={formRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          // 删除充值余额按钮
        ]}
        request={async (params) => {
          // 构建请求参数
          const requestParams: any = {
            ...params,
            pageSize: params.pageSize,
            current: params.current,
          };

          // 如果是普通用户，限制只能查看自己的交易记录
          if (!isAdmin && userId) {
            requestParams.userId = userId;
          }

          try {
            // 获取交易记录
            const response = await request('/api/transactions', {
              method: 'GET',
              params: requestParams,
            });

            return {
              data: response.data,
              success: response.success,
              total: response.total,
            };
          } catch (error) {
            message.error('获取交易记录失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        columns={columns}
      />
  );
};

export default BalanceManagement;
