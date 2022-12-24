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
import TransactionsFilesPage from '@/pages/import/import-transactions';
import TransactionsListPage from '@/pages/transactions';
import TransactionsItemPage from '@/pages/transactions-item';
import UsersUsersFilesPage from '@/pages/import/import-users';
import UsersUsersListPage from '@/pages/users/users-list';
import UsersItemPage from '@/pages/users-item';
import CreatedListsPage from '@/pages/lists';
import ListsItemPage from '@/pages/lists-item';
import RulesPage from '@/pages/rules';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RouteItem } from '@/services/routing/types';
import SettingsPage from '@/pages/settings';
import SanctionsPage from '@/pages/sanctions';
import AuditLogPage from '@/pages/auditlog';
import { isAtLeastAdmin, useAuth0User } from '@/utils/user-utils';

export function useRoutes(): RouteItem[] {
  const isRiskLevelsEnabled = useFeature('PULSE');
  const isImportFilesEnabled = useFeature('IMPORT_FILES');
  const isListsFeatureEnabled = useFeature('LISTS');
  const isSanctionsEnabled = useFeature('SANCTIONS');
  const isAuditLogEnabled = useFeature('AUDIT_LOGS');
  const [lastActiveTab] = useLocalStorageState('user-active-tab', 'consumer');
  const [lastActiveRuleTab] = useLocalStorageState('rule-active-tab', 'rules-library');
  const [lastActiveList] = useLocalStorageState('user-active-list', 'whitelist');
  const [lastActiveSanctionsTab] = useLocalStorageState('sanctions-active-tab', 'search');
  const [lastCasesActiveTab] = useLocalStorageState('cases-active-tab', 'transaction');
  const user = useAuth0User();
  const isAtLeastAdminUser = isAtLeastAdmin(user);

  return useMemo((): RouteItem[] => {
    const routes: (RouteItem | boolean)[] = [
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
            path: '/case-management/case/:id',
            component: CaseManagementItemPage,
            name: 'item',
          },
          {
            path: '/case-management/:list',
            name: 'list',
            component: CaseManagementPage,
          },
          {
            path: '/case-management',
            redirect:
              lastCasesActiveTab === 'user'
                ? '/case-management/user'
                : '/case-management/transaction',
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
            path: '/transactions/item/:id',
            component: TransactionsItemPage,
            name: 'transactions-item',
          },
          {
            name: 'transactions-list',
            component: TransactionsListPage,
            path: '/transactions/list',
          },
          {
            name: 'transactions-files',
            path: '/transactions/files',
            component: TransactionsFilesPage,
          },
          {
            path: '/transactions',
            redirect: '/transactions/list',
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
            name: 'user-lists',
            hideChildrenInMenu: true,
            routes: [
              {
                path: '/users/list',
                redirect:
                  lastActiveTab === 'consumer'
                    ? '/users/list/consumer/all'
                    : lastActiveTab === 'all'
                    ? '/users/list/all/all'
                    : '/users/list/business/all',
              },
              {
                path: '/users/list/:list/all',
                name: 'user-lists-all',
                component: UsersUsersListPage,
              },
              {
                path: '/users/list/:list/:id',
                name: 'user-lists-item',
                component: UsersItemPage,
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
        icon: 'Gavel',
        hideChildrenInMenu: true,
        position: 'top',
        routes: [
          {
            path: '/rules',
            redirect:
              lastActiveRuleTab === 'my-rules'
                ? '/rules/my-rules'
                : lastActiveRuleTab === 'rules-library'
                ? '/rules/rules-library'
                : '/rules/request-new',
          },
          {
            path: '/rules/:rule',
            name: 'rule',
            component: RulesPage,
          },
        ],
      },
      isRiskLevelsEnabled && {
        path: '/risk-levels',
        icon: 'BarChartOutlined',
        name: 'risk-levels',
        position: 'top',
        routes: [
          {
            path: '/risk-levels',
            redirect: '/risk-levels/risk-level/user',
          },
          {
            name: 'risk-level',
            path: '/risk-levels/risk-level/',
            component: RiskLevelPage,
          },
          {
            name: 'risk-level',
            path: '/risk-levels/risk-level/:type',
            component: RiskLevelPage,
            hideInMenu: true,
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
      isImportFilesEnabled && {
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
            component: TransactionsFilesPage,
          },
        ],
      },
      isListsFeatureEnabled && {
        name: 'lists',
        path: '/lists',
        icon: 'UnorderedListOutlined',
        position: 'top',
        hideChildrenInMenu: true,
        routes: [
          {
            path: '/lists/:type',
            name: 'lists-type',
            component: CreatedListsPage,
          },
          {
            path: '/lists/:type/:id',
            name: 'lists-item',
            component: ListsItemPage,
          },
          {
            path: '/lists',
            redirect: lastActiveList === 'whitelist' ? '/lists/whitelist' : '/lists/blacklist',
          },
        ],
      },
      {
        path: '/sanctions',
        name: 'sanctions',
        icon: 'GlobalOutlined',
        hideChildrenInMenu: true,
        position: 'top',
        disabled: !isSanctionsEnabled,
        routes: isSanctionsEnabled
          ? [
              {
                path: '/sanctions',
                redirect:
                  lastActiveSanctionsTab === 'search'
                    ? '/sanctions/search'
                    : '/sanctions/search-history',
              },
              {
                path: '/sanctions/:type',
                name: 'sanctions',
                component: SanctionsPage,
              },
              {
                path: '/sanctions/search/:searchId',
                component: SanctionsPage,
                name: 'search-history-item',
              },
            ]
          : [],
      },
      isAtLeastAdminUser &&
        isAuditLogEnabled && {
          path: '/auditlog',
          icon: 'ContainerOutlined',
          name: 'auditlog',
          position: 'bottom',
          component: AuditLogPage,
        },
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
    ];

    return routes.filter((x): x is RouteItem => x !== false);
  }, [
    lastActiveTab,
    lastActiveRuleTab,
    isRiskLevelsEnabled,
    isImportFilesEnabled,
    isListsFeatureEnabled,
    lastActiveList,
    isSanctionsEnabled,
    isAuditLogEnabled,
    lastActiveSanctionsTab,
    lastCasesActiveTab,
    isAtLeastAdminUser,
  ]);
}
