import { useMemo } from 'react';
import { useLocalStorageState } from 'ahooks';
import AccountsPage from '@/pages/accounts';
import DashboardAnalysisPage from '@/pages/dashboard/analysis';
import Page404 from '@/pages/404';
import CaseManagementPage from '@/pages/case-management';
import CaseManagementItemPage from '@/pages/case-management-item';
import RiskLevelsConfigurePage from '@/pages/risk-levels/configure';
import RiskLevelPage from '@/pages/risk-levels/risk-factors';
import RiskAlgorithmTable from '@/pages/risk-levels/risk-algorithms';
import TransactionsFilesPage from '@/pages/import/import-transactions';
import TransactionsListPage from '@/pages/transactions';
import TransactionsItemPage from '@/pages/transactions-item';
import UsersUsersFilesPage from '@/pages/import/import-users';
import UsersUsersListPage from '@/pages/users/users-list';
import UsersItemPage from '@/pages/users-item';
import CreatedListsPage from '@/pages/lists';
import ListsItemPage from '@/pages/lists-item';
import RulesPage from '@/pages/rules';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { isLeaf, isTree, RouteItem } from '@/services/routing/types';
import SettingsPage from '@/pages/settings';
import SanctionsPage from '@/pages/sanctions';
import AuditLogPage from '@/pages/auditlog';
import {
  useHasPermissions,
  isAtLeastAdmin,
  useAuth0User,
  usePermissions,
} from '@/utils/user-utils';
import { Permission } from '@/apis';
import ForbiddenPage from '@/pages/403';
import ReportsList from '@/pages/reports';

export function useRoutes(): RouteItem[] {
  const isRiskLevelsEnabled = useFeatureEnabled('PULSE');
  const isImportFilesEnabled = useFeatureEnabled('IMPORT_FILES');
  const isListsFeatureEnabled = useFeatureEnabled('LISTS');
  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');
  const isAuditLogEnabled = useFeatureEnabled('AUDIT_LOGS');
  const isSarEnabled = useFeatureEnabled('SAR');
  const [lastActiveTab] = useLocalStorageState('user-active-tab', 'consumer');
  const [lastActiveRuleTab] = useLocalStorageState('rule-active-tab', 'rules-library');
  const [lastActiveList] = useLocalStorageState('user-active-list', 'whitelist');
  const [lastActiveSanctionsTab] = useLocalStorageState('sanctions-active-tab', 'search');
  const permissions = usePermissions();

  const hasAuditLogPermission = useHasPermissions(['audit-log:export:read']);
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
        permissions: ['dashboard:download-data:read'],
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
        permissions: ['case-management:case-overview:read'],
        routes: [
          {
            path: '/case-management/case/:id',
            component: CaseManagementItemPage,
            name: 'item',
            permissions: ['case-management:case-details:read'],
          },
          {
            path: '/case-management/case/:id/:tab',
            component: CaseManagementItemPage,
            name: 'item-tab',
            permissions: ['case-management:case-details:read'],
          },
          {
            path: '/case-management',
            redirect: '/case-management/cases',
          },
          {
            path: '/case-management/cases',
            component: CaseManagementPage,
            name: 'list',
          },
        ],
      },
      {
        path: '/transactions',
        icon: 'table',
        name: 'transactions',
        hideChildrenInMenu: true,
        position: 'top',
        permissions: ['transactions:overview:read'],
        routes: [
          {
            path: '/transactions/item/:id',
            component: TransactionsItemPage,
            name: 'transactions-item',
            permissions: ['transactions:details:read'],
          },
          {
            path: '/transactions/item/:id/:tab',
            component: TransactionsItemPage,
            name: 'transactions-item-tab',
            permissions: ['transactions:details:read'],
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
        permissions: ['users:user-overview:read'],
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
              {
                path: '/users/list/:list/:id/:tab',
                name: 'user-lists-item-tab',
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
            redirect: lastActiveRuleTab === 'my-rules' ? '/rules/my-rules' : 'rules-library',
          },
          {
            path: '/rules/:rule',
            name: 'rule',
            component: RulesPage,
          },
        ],
      },
      isSarEnabled && {
        path: '/reports',
        name: 'reports',
        icon: 'Article',
        hideChildrenInMenu: true,
        position: 'top',
        routes: [
          {
            path: '/reports',
            name: 'reports',
            component: ReportsList,
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
            redirect: '/risk-levels/risk-factors/user',
          },
          {
            name: 'risk-factors',
            path: '/risk-levels/risk-factors/',
            component: RiskLevelPage,
            permissions: ['risk-scoring:risk-factors:read'],
          },
          {
            name: 'risk-factors',
            path: '/risk-levels/risk-factors/:type',
            component: RiskLevelPage,
            hideInMenu: true,
            permissions: ['risk-scoring:risk-factors:read'],
          },
          {
            name: 'configure',
            path: '/risk-levels/configure',
            component: RiskLevelsConfigurePage,
            permissions: ['risk-scoring:risk-levels:read'],
          },
          {
            name: 'risk-algorithms',
            path: '/risk-levels/risk-algorithms',
            component: RiskAlgorithmTable,
            permissions: ['risk-scoring:risk-algorithms:read'],
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
            permissions: ['users:import:write'],
            component: UsersUsersFilesPage,
          },
          {
            name: 'import-transactions',
            path: '/import/import-transactions',
            permissions: ['transactions:import:write'],
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
        permissions: ['lists:all:read'],
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
        permissions: ['sanctions:search:read'],
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
      (isAtLeastAdminUser || hasAuditLogPermission) && {
        path: '/auditlog',
        icon: 'ContainerOutlined',
        name: 'auditlog',
        position: 'bottom',
        permissions: ['audit-log:export:read'],
        disabled: !isAuditLogEnabled,
        component: AuditLogPage,
      },
      {
        path: '/settings',
        icon: 'SettingOutlined',
        name: 'settings',
        position: 'bottom',
        permissions: ['settings:organisation:read'],
        component: SettingsPage,
      },
      {
        path: '/accounts',
        icon: 'UsergroupAddOutlined',
        name: 'accounts',
        position: 'bottom',
        hideChildrenInMenu: true,
        permissions: ['settings:organisation:read'],
        routes: [
          {
            path: '/accounts',
            redirect: '/accounts/team',
          },
          {
            path: '/accounts/:section',
            name: 'accounts-section',
            component: AccountsPage,
          },
        ],
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

    return routes
      .filter((x): x is RouteItem => x !== false)
      .map((r) => disableForbiddenRoutes(r, permissions));
  }, [
    lastActiveTab,
    lastActiveRuleTab,
    isRiskLevelsEnabled,
    isImportFilesEnabled,
    isSarEnabled,
    isListsFeatureEnabled,
    lastActiveList,
    isSanctionsEnabled,
    isAuditLogEnabled,
    lastActiveSanctionsTab,
    isAtLeastAdminUser,
    hasAuditLogPermission,
    permissions,
  ]);
}

function disableForbiddenRoutes(r: RouteItem, permissions?: Map<Permission, boolean>): RouteItem {
  if (!(isLeaf(r) || isTree(r))) {
    return r;
  }
  if (r.permissions && r.permissions.filter((required) => !permissions?.has(required)).length > 0) {
    r.disabled = true;
    if (isLeaf(r)) {
      r.component = ForbiddenPage;
    }
  }
  if (isTree(r)) {
    // If parent disabled, disable children.
    if (r.disabled) {
      r.routes = r.routes.map((r) => ({ ...r, disabled: true, component: ForbiddenPage }));
    } else {
      r.routes = r.routes.map((r) => {
        return disableForbiddenRoutes(r, permissions);
      });
    }
  }
  return r;
}
