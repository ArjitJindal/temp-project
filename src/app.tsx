import type { ReactNode } from 'react';
import React from 'react';
import type { Settings as LayoutSettings } from '@ant-design/pro-layout';
import { PageLoading } from '@ant-design/pro-layout';
import { Link, RunTimeLayoutConfig, setLocale } from 'umi';
import { BookOutlined, LinkOutlined } from '@ant-design/icons';
import Footer from '@/components/Footer';
import RightContent from '@/components/RightContent';
import AppWrapper from '@/components/AppWrapper';

setLocale('en-US', false);

const isDev = process.env.NODE_ENV === 'development';

/** 获取用户信息比较慢的时候会展示一个 loading */
export const initialStateConfig = {
  loading: <PageLoading />,
};

/**
 * @see  https://umijs.org/zh-CN/plugins/plugin-initial-state
 * */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: LegacyAPI.CurrentUser;
}> {
  return {
    settings: {},
  };
}

// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  return {
    rightContentRender: () => <RightContent />,
    disableContentMargin: false,
    footerRender: () => <Footer />,
    links: isDev
      ? [
          <Link to="/umi/plugin/openapi" target="_blank">
            <LinkOutlined />
            <span>OpenAPI Docs</span>
          </Link>,
          <Link to="/~docs">
            <BookOutlined />
            <span>Local Docs</span>
          </Link>,
        ]
      : [],
    menuHeaderRender: undefined,
    // 自定义 403 页面
    // unAccessible: <div>unAccessible</div>,
    ...initialState?.settings,
  };
};

export function rootContainer(container: ReactNode) {
  return <AppWrapper>{container}</AppWrapper>;
}
