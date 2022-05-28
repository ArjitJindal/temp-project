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
      path: '/case-management',
      name: 'case-management',
      icon: 'FlagOutlined',
      hideChildrenInMenu: true,
      routes: [
        {
          path: '/case-management',
          exact: true,
          redirect: '/case-management/all',
        },
        {
          path: '/case-management/:id',
          component: './case-management',
          name: 'item',
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
          exact: true,
          redirect: '/users/list',
        },
        {
          path: '/users/list',
          name: 'lists',
          hideChildrenInMenu: true,
          routes: [
            {
              path: '/users/list',
              exact: true,
              redirect: '/users/list/consumer/all',
            },
            {
              icon: 'smile',
              path: '/users/list/:list/:id',
              name: 'list',
              component: './users/users-list',
            },
          ],
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
          hideChildrenInMenu: true,
          routes: [
            {
              path: '/transactions/transactions-list',
              exact: true,
              redirect: '/transactions/transactions-list/all',
            },
            {
              path: '/transactions/transactions-list/:id',
              component: './transactions/transactions-list',
              name: 'item',
            },
          ],
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
          name: 'my-rules',
          icon: 'smile',
          path: '/rules/my-rules',
          component: './rules/my-rules',
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
