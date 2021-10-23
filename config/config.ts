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
  // https://umijs.org/zh-CN/plugins/plugin-locale
  locale: {
    // default zh-CN
    default: 'zh-CN',
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
      path: '/transactions',
      icon: 'table',
      name: 'transactions',
      routes: [
        {
          path: '/transactions/search',
          name: 'search-transactions',
          component: './transactions/search',
          routes: [
            {
              path: '/transactions/search',
              redirect: '/transactions/search/articles',
            },
            {
              name: 'articles',
              icon: 'smile',
              path: '/transactions/search/articles',
              component: './transactions/search/articles',
            },
            {
              name: 'projects',
              icon: 'smile',
              path: '/transactions/search/projects',
              component: './transactions/search/projects',
            },
            {
              name: 'applications',
              icon: 'smile',
              path: '/transactions/search/applications',
              component: './transactions/search/applications',
            },
          ],
        },
        {
          path: '/transactions',
          redirect: '/transactions/table-list',
        },
        {
          name: 'table-list',
          icon: 'smile',
          path: '/transactions/table-list',
          component: './transactions/table-list',
        },
        {
          name: 'basic-list',
          icon: 'smile',
          path: '/transactions/basic-list',
          component: './transactions/basic-list',
        },
        {
          name: 'card-list',
          icon: 'smile',
          path: '/transactions/card-list',
          component: './transactions/card-list',
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
          name: 'active-rules',
          icon: 'smile',
          path: '/rules/active-rules',
          component: './rules/active-rules',
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
      path: '/form',
      icon: 'form',
      name: 'form',
      routes: [
        {
          path: '/form',
          redirect: '/form/basic-form',
        },
        {
          name: 'basic-form',
          icon: 'smile',
          path: '/form/basic-form',
          component: './form/basic-form',
        },
        {
          name: 'step-form',
          icon: 'smile',
          path: '/form/step-form',
          component: './form/step-form',
        },
        {
          name: 'advanced-form',
          icon: 'smile',
          path: '/form/advanced-form',
          component: './form/advanced-form',
        },
      ],
    },
    {
      name: 'account',
      icon: 'user',
      path: '/account',
      routes: [
        {
          path: '/account',
          redirect: '/account/center',
        },
        {
          name: 'center',
          icon: 'smile',
          path: '/account/center',
          component: './account/center',
        },
        {
          name: 'settings',
          icon: 'smile',
          path: '/account/settings',
          component: './account/settings',
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
