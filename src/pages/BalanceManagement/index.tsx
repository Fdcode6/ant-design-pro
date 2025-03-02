import React, { useRef } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { ProTable, ActionType, ProFormInstance, ProColumns } from '@ant-design/pro-components';
import { Button, Tag, message, Modal, Form, Radio, InputNumber, Input, Select } from 'antd';
import dayjs from 'dayjs';
import { useModel, request } from '@umijs/max';

// 交易记录类型
interface TransactionRecord {
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

// 余额调整表单
interface AdjustBalanceForm {
  type: 'increase' | 'decrease';
  amount: number;
  reason: string;
}

const BalanceManagement: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const isAdmin = currentUser?.access === 'admin';
  const userId = currentUser?.userid;
  
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const [form] = Form.useForm();
  const [adjustModalVisible, setAdjustModalVisible] = React.useState(false);
  const [adjustingUser, setAdjustingUser] = React.useState<{ id: string, username: string } | null>(null);

  // 打开余额调整窗口
  const handleAdjustBalance = (record: TransactionRecord) => {
    setAdjustingUser({
      id: record.userId.toString(),
      username: record.username,
    });
    form.resetFields();
    setAdjustModalVisible(true);
  };

  // 提交余额调整
  const handleAdjustBalanceSubmit = async () => {
    try {
      const values = await form.validateFields();
      const userId = adjustingUser?.id;

      if (!userId) {
        message.error('用户ID不存在');
        return;
      }

      // 余额调整逻辑
      const response = await request(`/api/users/${userId}/balance`, {
        method: 'POST',
        data: {
          type: values.type,
          amount: values.amount,
          reason: values.reason,
        },
      });

      if (response.success) {
        message.success('余额调整成功');
        setAdjustModalVisible(false);
        actionRef.current?.reload();
      } else {
        message.error(response.error || '余额调整失败');
      }
    } catch (error) {
      console.error('余额调整提交错误:', error);
      message.error('余额调整失败');
    }
  };

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
    <>
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
        request={async (params, sort, filter) => {
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

      {/* 余额调整模态框 */}
      <Modal
        title={`调整用户 ${adjustingUser?.username || ''} 的余额`}
        open={adjustModalVisible}
        onCancel={() => setAdjustModalVisible(false)}
        onOk={handleAdjustBalanceSubmit}
        destroyOnClose
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="type"
            label="操作类型"
            initialValue="increase"
            rules={[{ required: true, message: '请选择操作类型' }]}
          >
            <Radio.Group>
              <Radio value="increase">充值</Radio>
              <Radio value="decrease">消费</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="amount"
            label="金额"
            rules={[
              { required: true, message: '请输入金额' },
              { type: 'number', min: 0.01, message: '金额必须大于0' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              precision={2}
              placeholder="请输入金额"
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="原因"
            rules={[{ required: true, message: '请输入操作原因' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入操作原因" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default BalanceManagement; 