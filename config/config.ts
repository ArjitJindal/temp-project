// https://umijs.org/config/
import { defineConfig } from 'umi';
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
        {
          name: 'users-files',
          icon: 'smile',
          path: '/users/users-files',
          component: './users/users-files',
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
        {
          name: 'transactions-files',
          icon: 'smile',
          path: '/transactions/transactions-files',
          component: './transactions/transactions-files',
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
      path: '/accounts',
      icon: 'UserSwitchOutlined',
      name: 'accounts',
      component: './accounts',
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
  fastRefresh: {},
  nodeModulesTransform: {
    type: 'none',
  },
  mfsu: {},
  extraBabelPlugins: ['@babel/plugin-proposal-class-properties'],
  exportStatic: {},
  forkTSChecker: {
    typescript: true,
  },
});
