import React from 'react';
import type { Settings as LayoutSettings } from '@ant-design/pro-layout';
import { PageLoading } from '@ant-design/pro-layout';
import type { RunTimeLayoutConfig } from 'umi';
import { history, Link } from 'umi';
import { BookOutlined, LinkOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { Auth0Provider, withAuthenticationRequired } from '@auth0/auth0-react';
import Footer from '@/components/Footer';
import RightContent from '@/components/RightContent';

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
  currentUser?: API.CurrentUser;
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

const AuthWrapperProvider: React.FC = ({ children }) => {
  const onRedirectCallback = (appState: any) => {
    history.push(appState && appState.returnTo ? appState.returnTo : window.location.pathname);
  };
  const providerConfig = {
    // TODO: Use env-specific values
    domain: 'dev-flagright.eu.auth0.com',
    clientId: 'uGGbVNumU7d57NswPLD5UaTwvf17tc7y',
    redirectUri: window.location.origin,
    onRedirectCallback,
  };
  const AuthenticationRequiredWrapper = withAuthenticationRequired(
    (({ children: innerChildren }) => innerChildren) as React.FC,
    { onRedirecting: () => <PageLoading /> },
  );
  return (
    <Auth0Provider {...providerConfig}>
      <AuthenticationRequiredWrapper>{children}</AuthenticationRequiredWrapper>
    </Auth0Provider>
  );
};

export function rootContainer(container: ReactNode) {
  return <AuthWrapperProvider>{container}</AuthWrapperProvider>;
}
