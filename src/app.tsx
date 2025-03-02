import { AvatarDropdown, AvatarName, Footer, Question, SelectLang } from '@/components';
import { currentUser as queryCurrentUser } from '@/services/ant-design-pro/api';
import { LinkOutlined } from '@ant-design/icons';
import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RunTimeLayoutConfig, RequestConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import React, { useState } from 'react';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';
import { message } from 'antd';

const isDev = process.env.NODE_ENV === 'development';
const loginPath = '/user/login';

/**
 * @see  https://umijs.org/zh-CN/plugins/plugin-initial-state
 * */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: API.CurrentUser;
  loading?: boolean;
  fetchUserInfo?: () => Promise<API.CurrentUser | undefined>;
}> {
  const fetchUserInfo = async () => {
    try {
      // 从localStorage获取用户ID
      const userId = localStorage.getItem('userId');
      console.log('从localStorage获取到的userId:', userId);
      
      if (!userId) {
        console.error('没有找到userId，无法获取用户信息');
        return undefined;
      }
      
      // 获取当前窗口的主机名和端口
      const { protocol, hostname } = window.location;
      // 使用当前域名，不再指定端口
      const baseURL = `${protocol}//${hostname}`;
      
      // 发起请求获取用户信息
      const apiUrl = `${baseURL}/api/currentUser?userId=${userId}`;
      console.log('请求用户信息, URL:', apiUrl);
      
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
        });
        
        if (!response.ok) {
          console.error('请求用户信息失败, 状态码:', response.status);
          throw new Error(`请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('获取到的用户信息响应:', data);
        
        if (data.success) {
          console.log('成功获取用户信息');
          return data.data;
        } else {
          console.error('获取用户信息失败:', data);
          throw new Error('获取用户信息失败: ' + (data.error || '未知错误'));
        }
      } catch (fetchError) {
        console.error('获取用户信息请求失败:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error('获取用户信息失败', error);
      // 不再自动跳转到登录页，让调用者处理错误
      return undefined;
    }
  };
  // 如果不是登录页面，执行
  const { location } = history;
  if (location.pathname !== loginPath) {
    const currentUser = await fetchUserInfo();
    return {
      fetchUserInfo,
      currentUser,
      settings: defaultSettings as Partial<LayoutSettings>,
    };
  }
  return {
    fetchUserInfo,
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({ initialState, setInitialState }) => {
  // 保存当前用户角色状态
  const [access] = useState(initialState?.currentUser?.access);
  
  return {
    actionsRender: () => [<SelectLang key="SelectLang" />],
    avatarProps: {
      src: initialState?.currentUser?.avatar,
      title: <AvatarName />,
      render: (_, avatarChildren) => {
        return <AvatarDropdown>{avatarChildren}</AvatarDropdown>;
      },
    },
    waterMarkProps: {
      content: initialState?.currentUser?.name,
    },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
      // 如果没有登录，重定向到 login
      if (!initialState?.currentUser && location.pathname !== loginPath) {
        history.push(loginPath);
      }
    },
    bgLayoutImgList: [
      {
        src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/D2LWSqNny4sAAAAAAAAAAAAAFl94AQBr',
        left: 85,
        bottom: 100,
        height: '303px',
      },
      {
        src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/C2TWRpJpiC0AAAAAAAAAAAAAFl94AQBr',
        bottom: -68,
        right: -45,
        height: '303px',
      },
      {
        src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/F6vSTbj8KpYAAAAAAAAAAAAAFl94AQBr',
        bottom: 0,
        left: 0,
        width: '331px',
      },
    ],
    links: isDev
      ? [
          <Link key="openapi" to="/umi/plugin/openapi" target="_blank">
            <LinkOutlined />
            <span>OpenAPI 文档</span>
          </Link>,
        ]
      : [],
    menuHeaderRender: undefined,
    // 自定义 403 页面
    // unAccessible: <div>unAccessible</div>,
    // 增加一个 loading 的状态
    childrenRender: (children) => {
      // if (initialState?.loading) return <PageLoading />;
      return (
        <>
          {children}
          {isDev && (
            <SettingDrawer
              disableUrlParams
              enableDarkTheme
              settings={initialState?.settings}
              onSettingChange={(settings) => {
                setInitialState((preInitialState) => ({
                  ...preInitialState,
                  settings,
                }));
              }}
            />
          )}
        </>
      );
    },
    ...initialState?.settings,
    // 菜单权限控制
    menu: {
      locale: true,
      // 根据用户角色过滤菜单
      params: {
        userRole: access || 'user', // 默认为普通用户
      },
      request: async (params, defaultMenuData) => {
        // 如果是普通用户，过滤掉不应该显示的菜单
        if (params.userRole !== 'admin') {
          return defaultMenuData.filter((item: any) => item.path !== '/user-management');
        }
        return defaultMenuData;
      },
    },
    // 根据返回值判断页面是否有权限访问
    // 不需要权限的路由始终返回 true
    // 需要权限的路由根据当前用户权限判断
    access: (route: {path?: string}) => {
      // 仪表盘和余额管理页面所有人都可以访问
      if (
        route.path === '/dashboard' || 
        route.path === '/balance-management'
      ) {
        return true;
      }
      
      // 用户管理页面仅管理员可以访问
      if (route.path === '/user-management') {
        return access === 'admin';
      }
      
      // 其他情况默认放行
      return true;
    },
  };
};

/**
 * @name request 配置，可以配置错误处理
 * 它基于 axios 和 ahooks 的 useRequest 提供了一套统一的网络请求和错误处理方案。
 * @doc https://umijs.org/docs/max/request#配置
 */
export const request: RequestConfig = {
  ...errorConfig,
  // 动态设置baseURL，确保在不同设备上都能正确连接到后端
  baseURL: typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.hostname}` 
    : 'http://localhost',
  // 响应拦截器
  responseInterceptors: [
    (response) => {
      return response;
    },
  ],
};
