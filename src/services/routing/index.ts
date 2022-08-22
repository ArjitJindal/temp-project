import { useMemo } from 'react';
import { useLocalStorageState } from 'ahooks';
import AccountsPage from '@/pages/accounts';
import DashboardAnalysisPage from '@/pages/dashboard/analysis';
import Page404 from '@/pages/404';
import CaseManagementPage from '@/pages/case-management';
import CaseManagementItemPage from '@/pages/case-management-item';
import RiskLevelsConfigurePage from '@/pages/risk-levels/configure';
import RiskLevelPage from '@/pages/risk-levels/risk-level';
import RiskAlgorithmTable from '@/pages/risk-levels/risk-algorithm';
import TransactionsTransactionsFilesPage from '@/pages/import/import-transactions';
import TransactionsTransactionsListPage from '@/pages/transactions/transactions-list';
import UsersUsersFilesPage from '@/pages/import/import-users';
import UsersUsersListPage from '@/pages/users/users-list';
import RulesPage from '@/pages/rules';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RouteItem, TreeRouteItem } from '@/services/routing/types';
import SettingsPage from '@/pages/settings';

export function useRoutes(): RouteItem[] {
  const isRiskLevelsEnabled = useFeature('PULSE');
  const isImportFilesEnabled = useFeature('IMPORT_FILES');
  const [lastActiveTab, _] = useLocalStorageState('user-active-tab', 'consumer');
  const [lastActiveRuleTab, __] = useLocalStorageState('rule-active-tab', 'create-rule');
  return useMemo(
    () => [
      {
        path: '/dashboard',
        name: 'dashboard',
        icon: 'dashboard',
        position: 'top',
        hideChildrenInMenu: true,
        routes: [
          {
            path: '/dashboard',
            redirect: '/dashboard/analysis',
          },
          {
            path: '/dashboard/analysis',
            name: 'item',
            component: DashboardAnalysisPage,
          },
        ],
      },
      {
        path: '/case-management',
        name: 'case-management',
        icon: 'FlagOutlined',
        position: 'top',
        hideChildrenInMenu: true,
        routes: [
          {
            path: '/case-management/:id',
            component: CaseManagementItemPage,
            name: 'item',
          },
          {
            path: '/case-management',
            name: 'list',
            component: CaseManagementPage,
          },
        ],
      },
      {
        path: '/transactions',
        icon: 'table',
        name: 'transactions',
        hideChildrenInMenu: true,
        position: 'top',
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
        path: '/users',
        icon: 'TeamOutlined',
        name: 'users',
        hideChildrenInMenu: true,
        position: 'top',
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
                redirect:
                  lastActiveTab === 'consumer'
                    ? '/users/list/consumer/all'
                    : '/users/list/business/all',
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
        path: '/rules',
        name: 'rules',
        icon: 'UnorderedListOutlined',
        hideChildrenInMenu: true,
        position: 'top',
        routes: [
          {
            path: '/rules',
            redirect:
              lastActiveRuleTab === 'my-rules'
                ? '/rules/my-rules'
                : lastActiveRuleTab === 'create-rule'
                ? '/rules/create-rule'
                : '/rules/request-new',
          },
          {
            path: '/rules/:rule',
            name: 'rule',
            component: RulesPage,
          },
        ],
      },
      ...((isRiskLevelsEnabled
        ? [
            {
              path: '/risk-levels',
              icon: 'BarChartOutlined',
              name: 'risk-levels',
              position: 'top',
              routes: [
                {
                  path: '/risk-levels',
                  redirect: '/risk-levels/risk-level',
                },
                {
                  name: 'risk-level',
                  path: '/risk-levels/risk-level',
                  component: RiskLevelPage,
                },
                {
                  name: 'configure',
                  path: '/risk-levels/configure',
                  component: RiskLevelsConfigurePage,
                },
                {
                  name: 'risk-algorithm',
                  path: '/risk-levels/risk-algorithm',
                  component: RiskAlgorithmTable,
                },
              ],
            },
          ]
        : []) as TreeRouteItem[]),
      ...((isImportFilesEnabled
        ? [
            {
              path: '/import',
              name: 'import',
              icon: 'ImportOutlined',
              position: 'top',
              routes: [
                {
                  name: 'import-users',
                  path: '/import/import-users',
                  component: UsersUsersFilesPage,
                },
                {
                  name: 'import-transactions',
                  path: '/import/import-transactions',
                  component: TransactionsTransactionsFilesPage,
                },
              ],
            },
          ]
        : []) as TreeRouteItem[]),
      {
        path: '/settings',
        icon: 'SettingOutlined',
        name: 'settings',
        position: 'bottom',
        component: SettingsPage,
      },
      {
        path: '/accounts',
        icon: 'UsergroupAddOutlined',
        name: 'accounts',
        position: 'bottom',
        component: AccountsPage,
      },
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
    [isImportFilesEnabled, isRiskLevelsEnabled, lastActiveRuleTab, lastActiveTab],
  );
}
