// https://umijs.org/config/
import { defineConfig } from 'umi';
import { join } from 'path';
import defaultSettings from './defaultSettings';
import proxy from './proxy';

const { REACT_APP_ENV } = process.env;

export default defineConfig({
  hash: true,
  antd: {},
  dva: {
    hmr: true,
  },
  layout: {
    // https://umijs.org/zh-CN/plugins/plugin-layout
    locale: true,
    siderWidth: 208,
    ...defaultSettings,
  },
  locale: {
    default: 'en-US',
    antd: true,
    // default true, when it is true, will use `navigator.language` overwrite default
    baseNavigator: true,
  },
  dynamicImport: {
    loading: '@ant-design/pro-layout/es/PageLoading',
  },
  targets: {
    ie: 11,
  },
  // umi routes: https://umijs.org/docs/routing
  routes: [
    {
      path: '/user',
      layout: false,
      routes: [
        {
          path: '/user/login',
          layout: false,
          name: 'login',
          component: './user/Login',
        },
        {
          path: '/user',
          redirect: '/user/login',
        },
        {
          name: 'register-result',
          icon: 'smile',
          path: '/user/register-result',
          component: './user/register-result',
        },
        {
          name: 'register',
          icon: 'smile',
          path: '/user/register',
          component: './user/register',
        },
        {
          component: '404',
        },
      ],
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      icon: 'dashboard',
      routes: [
        {
          path: '/dashboard',
          redirect: '/dashboard/analysis',
        },
        {
          name: 'analysis',
          icon: 'smile',
          path: '/dashboard/analysis',
          component: './dashboard/analysis',
        },
      ],
    },
    {
      path: '/users',
      icon: 'UsergroupAddOutlined',
      name: 'users',
      routes: [
        {
          path: '/users',
          redirect: '/users/users-list',
        },
        {
          name: 'users-list',
          icon: 'smile',
          path: '/users/users-list',
          component: './users/users-list',
        },
      ],
    },
    {
      path: '/transactions',
      icon: 'table',
      name: 'transactions',
      routes: [
        {
          path: '/transactions',
          redirect: '/transactions/transactions-list',
        },
        {
          name: 'transactions-list',
          icon: 'smile',
          path: '/transactions/transactions-list',
          component: './transactions/transactions-list',
        },
      ],
    },
    {
      path: '/rules',
      name: 'rules',
      icon: 'profile',
      routes: [
        {
          path: '/rules',
          redirect: '/rules/request-new',
        },
        {
          name: 'create-rule',
          icon: 'smile',
          path: '/rules/create-rule',
          component: './rules/create-rule',
        },
        {
          name: 'created-rules',
          icon: 'smile',
          path: '/rules/created-rules',
          component: './rules/created-rules',
        },
        {
          name: 'request-new',
          icon: 'smile',
          path: '/rules/request-new',
          component: './rules/request-new',
        },
      ],
    },
    {
      path: '/lists',
      icon: 'OrderedListOutlined',
      name: 'lists',
      routes: [
        {
          path: '/lists',
          redirect: '/lists/create-list',
        },
        {
          name: 'create-list',
          icon: 'smile',
          path: '/lists/create-list',
          component: './lists/create-list',
        },
        {
          name: 'created-lists',
          icon: 'smile',
          path: '/lists/created-lists',
          component: './lists/created-lists',
        },
      ],
    },
    {
      path: '/sar',
      icon: 'WarningOutlined',
      name: 'sar',
      routes: [
        {
          path: '/sar',
          redirect: '/sar/create-sar',
        },
        {
          name: 'create-sar',
          icon: 'smile',
          path: '/sar/create-sar',
          component: './sar/create-sar',
        },
      ],
    },
    {
      path: '/network',
      icon: 'PartitionOutlined',
      name: 'network',
      routes: [
        {
          path: '/network',
          redirect: '/network/network-analysis',
        },
        {
          name: 'network-analysis',
          icon: 'smile',
          path: '/network/network-analysis',
          component: './network/network-analysis',
        },
      ],
    },
    {
      path: '/risk-levels',
      icon: 'BarChartOutlined',
      name: 'risk-levels',
      routes: [
        {
          path: '/risk-levels',
          redirect: '/risk-levels/create-risk-levels',
        },
        {
          name: 'create-risk-levels',
          icon: 'smile',
          path: '/risk-levels/create-risk-levels',
          component: './risk-levels/create-risk-levels',
        },
      ],
    },
    {
      path: '/',
      redirect: '/dashboard/analysis',
    },
    {
      component: '404',
    },
  ],
  // Theme for antd: https://ant.design/docs/react/customize-theme-cn
  theme: {
    'primary-color': defaultSettings.primaryColor,
  },
  // esbuild is father build tools
  // https://umijs.org/plugins/plugin-esbuild
  esbuild: {},
  title: false,
  ignoreMomentLocale: true,
  proxy: proxy[REACT_APP_ENV || 'dev'],
  manifest: {
    basePath: '/',
  },
  // Fast Refresh 热更新
  fastRefresh: {},
  openAPI: [
    {
      requestLibPath: "import { request } from 'umi'",
      // 或者使用在线的版本
      // schemaPath: "https://gw.alipayobjects.com/os/antfincdn/M%24jrzTTYJN/oneapi.json"
      schemaPath: join(__dirname, 'oneapi.json'),
      mock: false,
    },
    {
      requestLibPath: "import { request } from 'umi'",
      schemaPath: 'https://gw.alipayobjects.com/os/antfincdn/CA1dOm%2631B/openapi.json',
      projectName: 'swagger',
    },
  ],
  nodeModulesTransform: {
    type: 'none',
  },
  mfsu: {},
  webpack5: {},
  exportStatic: {},
});
