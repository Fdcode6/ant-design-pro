import React, { useRef } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  PageContainer,
  ProTable,
  ModalForm,
  ProFormText,
  ProFormDigit,
  ProFormSelect,
} from '@ant-design/pro-components';
import { Button, message } from 'antd';
import { getUsers, createUser, updateUser } from '@/services/user';
import { request } from '@umijs/max';

export type UserItem = {
  id: string;
  username: string;
  realName: string;
  balance: number;
  createdAt: Date;
  status: string;
  role?: string;
};

const UserManagement: React.FC = () => {
  const actionRef = useRef<ActionType>();

  const columns: ProColumns<UserItem>[] = [
    {
      title: '用户ID',
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
      title: '真实姓名',
      dataIndex: 'realName',
      width: 120,
    },
    {
      title: '余额',
      dataIndex: 'balance',
      width: 120,
      valueType: 'money',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        active: { text: '正常', status: 'Success' },
        inactive: { text: '禁用', status: 'Error' },
      },
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 100,
      valueEnum: {
        admin: { text: '管理员', status: 'Warning' },
        user: { text: '普通用户', status: 'Default' },
      },
    },
    {
      title: '操作',
      width: 180,
      valueType: 'option',
      render: (_, record) => [
        <ModalForm
          key="edit"
          title="编辑用户"
          trigger={<a>编辑</a>}
          initialValues={record}
          autoFocusFirstInput
          modalProps={{
            destroyOnClose: true,
          }}
          onFinish={async (values) => {
            if (!values.status) {
              values.status = record.status || 'active';
            }
            console.log('Updating user with values:', values);
            const success = await updateUser(record.id, values);
            if (success) {
              message.success('更新成功');
              actionRef.current?.reload();
              return true;
            }
            return false;
          }}
        >
          <ProFormText
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          />
          <ProFormText
            name="realName"
            label="真实姓名"
            rules={[{ required: true, message: '请输入真实姓名' }]}
          />
          <ProFormSelect
            name="status"
            label="状态"
            valueEnum={{
              active: '正常',
              inactive: '禁用',
            }}
            rules={[{ required: true, message: '请选择状态' }]}
          />
        </ModalForm>,
        <ModalForm
          key="increase"
          title="增加余额"
          trigger={<a>增加余额</a>}
          autoFocusFirstInput
          modalProps={{
            destroyOnClose: true,
          }}
          onFinish={async (values) => {
            // 设置操作类型为增加
            values.type = 'increase';
            const success = await handleAdjustBalance(record.id, values);
            if (success) {
              message.success('增加余额成功');
              actionRef.current?.reload();
              return true;
            }
            return false;
          }}
        >
          <ProFormDigit
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
            min={0.01}
            fieldProps={{ precision: 2 }}
          />
          <ProFormText
            name="reason"
            label="调整原因"
          />
        </ModalForm>,
        <ModalForm
          key="decrease"
          title="扣除余额"
          trigger={<a>扣除余额</a>}
          autoFocusFirstInput
          modalProps={{
            destroyOnClose: true,
          }}
          onFinish={async (values) => {
            // 设置操作类型为扣除
            values.type = 'decrease';
            const success = await handleAdjustBalance(record.id, values);
            if (success) {
              message.success('扣除余额成功');
              actionRef.current?.reload();
              return true;
            }
            return false;
          }}
        >
          <ProFormDigit
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
            min={0.01}
            fieldProps={{ precision: 2 }}
          />
          <ProFormText
            name="reason"
            label="调整原因"
          />
        </ModalForm>,
      ],
    },
  ];

  const handleAdjustBalance = async (id: string, values: any) => {
    console.log('Handling balance adjustment:', { id, values });
    const { amount, type, reason } = values;
    
    try {
      // 确保amount是数字
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        message.error('金额必须大于0');
        return false;
      }
      
      // 调用API调整余额
      const result = await request<{ success: boolean }>(`/api/users/${id}/balance`, {
        method: 'POST',
        data: {
          amount: numAmount,
          type: type,
          reason: reason,
        },
      });
      
      console.log('Balance adjustment result:', result);
      
      if (result && result.success) {
        return true;
      } else {
        message.error('余额调整失败');
        return false;
      }
    } catch (error) {
      console.error('Balance adjustment error:', error);
      message.error('余额调整出错');
      return false;
    }
  };

  const handleCreateUser = async (values: any) => {
    const { username, realName, password, initialBalance, role } = values;
    return createUser({
      username,
      realName,
      password,
      initialBalance: Number(initialBalance),
      role: role || 'user',
    });
  };

  return (
    <PageContainer>
      <ProTable<UserItem>
        headerTitle="用户管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <ModalForm
            key="create"
            title="新建用户"
            trigger={
              <Button type="primary">
                <PlusOutlined />
                新建用户
              </Button>
            }
            autoFocusFirstInput
            modalProps={{
              destroyOnClose: true,
            }}
            onFinish={async (values) => {
              const success = await handleCreateUser(values);
              if (success) {
                message.success('创建成功');
                actionRef.current?.reload();
                return true;
              }
              return false;
            }}
          >
            <ProFormText
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            />
            <ProFormText
              name="realName"
              label="真实姓名"
              rules={[{ required: true, message: '请输入真实姓名' }]}
            />
            <ProFormText.Password
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            />
            <ProFormDigit
              name="initialBalance"
              label="初始余额"
              rules={[{ required: true, message: '请输入初始余额' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormSelect
              name="role"
              label="角色"
              valueEnum={{
                admin: '管理员',
                user: '普通用户',
              }}
              initialValue="user"
              rules={[{ required: true, message: '请选择角色' }]}
            />
          </ModalForm>,
        ]}
        request={getUsers}
        columns={columns}
      />
    </PageContainer>
  );
};

export default UserManagement; 