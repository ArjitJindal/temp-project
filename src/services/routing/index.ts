import { useMemo } from 'react';
import AccountsPage from '@/pages/accounts';
import DashboardAnalysisPage from '@/pages/dashboard/analysis';
import Page404 from '@/pages/404';
import CaseManagementPage from '@/pages/case-management';
import RiskLevelsConfigurePage from '@/pages/risk-levels/configure';
import RiskMyRulesPage from '@/pages/rules/my-rules';
import RiskCreateRulePage from '@/pages/rules/create-rule';
import RiskRequestNewPage from '@/pages/rules/request-new';
import TransactionsTransactionsFilesPage from '@/pages/transactions/transactions-files';
import TransactionsTransactionsListPage from '@/pages/transactions/transactions-list';
import UsersUsersFilesPage from '@/pages/users/users-files';
import UsersUsersListPage from '@/pages/users/users-list';
import { useFeature } from '@/components/AppWrapper/Providers/FeaturesProvider';
import { RouteItem } from '@/services/routing/types';

export function useRoutes(): RouteItem[] {
  const isRiskLevelsEnabled = useFeature('PULSE');
  return useMemo(
    () => [
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
            path: '/dashboard/analysis',
            component: DashboardAnalysisPage,
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
            redirect: '/case-management/all',
          },
          {
            path: '/case-management/:id',
            component: CaseManagementPage,
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
            redirect: '/users/list',
          },
          {
            path: '/users/list',
            name: 'lists',
            hideChildrenInMenu: true,
            routes: [
              {
                path: '/users/list',
                redirect: '/users/list/consumer/all',
              },
              {
                path: '/users/list/:list/:id',
                name: 'list',
                component: UsersUsersListPage,
              },
            ],
          },
          {
            name: 'users-files',
            path: '/users/users-files',
            component: UsersUsersFilesPage,
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
            path: '/transactions/transactions-list',
            hideChildrenInMenu: true,
            routes: [
              {
                path: '/transactions/transactions-list',
                redirect: '/transactions/transactions-list/all',
              },
              {
                path: '/transactions/transactions-list/:id',
                name: 'item',
                component: TransactionsTransactionsListPage,
              },
            ],
          },
          {
            name: 'transactions-files',
            path: '/transactions/transactions-files',
            component: TransactionsTransactionsFilesPage,
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
            path: '/rules/create-rule',
            component: RiskCreateRulePage,
          },
          {
            name: 'my-rules',
            path: '/rules/my-rules',
            component: RiskMyRulesPage,
          },
          {
            name: 'request-new',
            path: '/rules/request-new',
            component: RiskRequestNewPage,
          },
        ],
      },
      {
        path: '/accounts',
        icon: 'UserSwitchOutlined',
        name: 'accounts',
        component: AccountsPage,
      },
      ...(isRiskLevelsEnabled
        ? [
            {
              path: '/risk-levels',
              icon: 'BarChartOutlined',
              name: 'risk-levels',
              routes: [
                {
                  path: '/risk-levels',
                  redirect: '/risk-levels/configure',
                },
                {
                  name: 'configure',
                  path: '/risk-levels/configure',
                  component: RiskLevelsConfigurePage,
                },
              ],
            },
          ]
        : []),
      {
        path: '/',
        redirect: '/dashboard/analysis',
      },
      {
        name: '404',
        path: '*',
        component: Page404,
        hideInMenu: true,
      },
    ],
    [isRiskLevelsEnabled],
  );
}
