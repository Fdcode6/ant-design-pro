import React, { useRef } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ProTable,
  ModalForm,
  ProFormSelect,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Button, message } from 'antd';

export type TransactionRecord = {
  id: string;
  userId: string;
  username: string;
  type: 'increase' | 'decrease';
  amount: number;
  balance: number;
  reason: string;
  operator: string;
  createdAt: Date;
};

export const BalanceManagementList: React.FC = () => {
  const actionRef = useRef<ActionType>();

  const columns: ProColumns<TransactionRecord>[] = [
    {
      title: '交易ID',
      dataIndex: 'id',
      copyable: true,
      width: 100,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      width: 120,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      valueEnum: {
        increase: { text: '增加', status: 'Success' },
        decrease: { text: '扣除', status: 'Error' },
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      valueType: 'money',
    },
    {
      title: '变动后余额',
      dataIndex: 'balance',
      width: 120,
      valueType: 'money',
    },
    {
      title: '原因',
      dataIndex: 'reason',
      width: 200,
      ellipsis: true,
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      width: 120,
    },
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
    },
  ];

  return (
    <ProTable<TransactionRecord>
      headerTitle="余额变动记录"
      actionRef={actionRef}
      rowKey="id"
      search={{
        labelWidth: 120,
      }}
      toolBarRender={() => [
        <ModalForm
          key="adjust"
          title="余额调整"
          trigger={
            <Button type="primary">
              余额调整
            </Button>
          }
          autoFocusFirstInput
          modalProps={{
            destroyOnClose: true,
          }}
          onFinish={async (values) => {
            console.log(values);
            message.success('提交成功');
            return true;
          }}
        >
          <ProFormSelect
            name="userId"
            label="选择用户"
            rules={[{ required: true, message: '请选择用户' }]}
            request={async () => {
              // 这里需要实现获取用户列表的API
              return [
                { label: '张三', value: '1' },
                { label: '李四', value: '2' },
              ];
            }}
          />
          <ProFormSelect
            name="type"
            label="操作类型"
            rules={[{ required: true, message: '请选择操作类型' }]}
            options={[
              { label: '增加余额', value: 'increase' },
              { label: '扣除余额', value: 'decrease' },
            ]}
          />
          <ProFormDigit
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
            min={0.01}
            fieldProps={{ precision: 2 }}
          />
          <ProFormTextArea
            name="reason"
            label="调整原因"
            rules={[{ required: true, message: '请输入调整原因' }]}
          />
        </ModalForm>,
      ]}
      request={async (params) => {
        // 这里需要实现与后端API的对接
        // 目前返回模拟数据
        return {
          data: [
            {
              id: '1',
              userId: '1',
              username: '张三',
              type: 'increase',
              amount: 1000.00,
              balance: 2000.00,
              reason: '充值',
              operator: 'admin',
              createdAt: new Date(),
            },
          ],
          success: true,
          total: 1,
        };
      }}
      columns={columns}
    />
  );
}; 