import { useMemo } from 'react';
import { useLocalStorageState } from 'ahooks';
import RulesItemPage from 'src/pages/rules/rules-item';
import RulesLibraryItemPage from 'src/pages/rules/rules-library-item';
import AccountsPage from '@/pages/accounts';
import DashboardAnalysisPage from '@/pages/dashboard/analysis';
import Page404 from '@/pages/404';
import CaseManagementPage from '@/pages/case-management';
import CaseManagementItemPage from '@/pages/case-management-item';
import AlertItemPage from '@/pages/alert-item';
import RiskLevelsConfigurePage from '@/pages/risk-levels/configure';
import RiskLevelPage from '@/pages/risk-levels/risk-factors';
import CustomRiskFactorsPage from '@/pages/risk-levels/custom-risk-factors';
import RiskAlgorithmTable from '@/pages/risk-levels/risk-algorithms';
import TransactionsListPage from '@/pages/transactions';
import TransactionsItemPage from '@/pages/transactions-item';
import UsersUsersListPage from '@/pages/users/users-list';
import UsersItemPage from '@/pages/users-item';
import CreatedListsPage from '@/pages/lists';
import ListsItemPage from '@/pages/lists-item';
import RulesPage from '@/pages/rules';
import SimulationHistoryPage from '@/pages/rules/simulation-history';
import SimulationHistoryItemPage from '@/pages/rules/simulation-history-item';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { isLeaf, isTree, RouteItem } from '@/services/routing/types';
import SettingsPage from '@/pages/settings';
import SanctionsPage from '@/pages/sanctions';
import AuditLogPage from '@/pages/auditlog';
import {
  isAtLeastAdmin,
  useAuth0User,
  useHasPermissions,
  usePermissions,
} from '@/utils/user-utils';
import { Permission } from '@/apis';
import ForbiddenPage from '@/pages/403';
import ReportsList from '@/pages/reports';
import Clueso from '@/pages/auth/clueso';
import { QASamplesTable } from '@/pages/qa-samples';
import { QASamplePage } from '@/pages/qa-sample-item';
import { SimulationHistoryResultPage } from '@/pages/risk-levels/RiskFactorsSimulation/SimulationHistoryPage/SimulationHistoryResultPage';
import { SimulationHistoryPage as RiskFactorsSimulationHistoryPage } from '@/pages/risk-levels/RiskFactorsSimulation/SimulationHistoryPage';
import { RuleInstancePage } from '@/pages/rules/rule-instance-page';
import RiskFactorItemPage from '@/pages/risk-levels/custom-risk-factors/RiskItem';
import { MlModelsPage } from '@/pages/ml-models';

export function useRoutes(): RouteItem[] {
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');
  const isRiskScoringV8Enabled = useFeatureEnabled('RISK_SCORING_V8');
  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');
  const isAuditLogEnabled = useFeatureEnabled('AUDIT_LOGS');
  const isSarEnabled = useFeatureEnabled('SAR');
  const hasMachineLearningFeature = useFeatureEnabled('MACHINE_LEARNING');
  const isSalesRiskScoringEnabled = useFeatureEnabled('SALES_RISK_SCORING');
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
        icon: 'case-management',
        position: 'top',
        hideChildrenInMenu: true,
        permissions: [
          'case-management:case-overview:read',
          'case-management:qa:read',
          'transactions:overview:read',
        ],
        routes: [
          {
            path: '/case-management/case/:id',
            component: CaseManagementItemPage,
            name: 'item',
            permissions: ['case-management:case-details:read'],
          },
          {
            path: '/case-management/alerts/:id',
            component: AlertItemPage,
            name: 'alert-item',
            permissions: ['case-management:case-details:read'],
          },
          {
            path: '/case-management/alerts/:id/:tab',
            component: AlertItemPage,
            name: 'alert-item',
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
            permissions: [
              'case-management:case-overview:read',
              'case-management:qa:read',
              'transactions:overview:read',
            ],
          },
          {
            path: '/case-management/cases',
            component: CaseManagementPage,
            name: 'list',
            permissions: [
              'case-management:case-overview:read',
              'case-management:qa:read',
              'transactions:overview:read',
            ],
          },
          {
            path: '/case-management/qa-sampling',
            component: QASamplesTable,
            name: 'qa-sampling',
            permissions: ['case-management:qa:read'],
          },
          {
            path: '/case-management/qa-sampling/:samplingId',
            component: QASamplePage,
            name: 'qa-sampling-item',
            permissions: ['case-management:qa:read'],
          },
        ],
      },
      {
        path: '/transactions',
        icon: 'transactions',
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
            path: '/transactions',
            redirect: '/transactions/list',
          },
        ],
      },
      {
        path: '/users',
        icon: 'users',
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
        ],
      },
      {
        path: '/rules',
        name: 'rules',
        icon: 'rules',
        hideChildrenInMenu: true,
        permissions: ['rules:library:read'],
        position: 'top',
        routes: [
          {
            path: '/rules',
            redirect: lastActiveRuleTab === 'my-rules' ? '/rules/my-rules' : '/rules/rules-library',
          },
          {
            path: '/rules/my-rules/simulation-history',
            name: 'simulation-history',
            component: SimulationHistoryPage,
          },
          {
            path: '/rules/my-rules/simulation-history/:id',
            name: 'simulation-history',
            component: SimulationHistoryItemPage,
          },
          {
            path: '/rules/rules-library/simulation-history',
            name: 'simulation-history',
            component: SimulationHistoryPage,
          },
          {
            path: '/rules/rules-library/simulation-history/:id',
            name: 'simulation-history',
            component: SimulationHistoryItemPage,
          },
          {
            path: '/rules/my-rules/:id',
            name: 'rule-instance',
            component: RuleInstancePage,
          },
          {
            path: '/rules/my-rules/:id/:mode',
            name: 'rules-item',
            component: RulesItemPage,
          },
          {
            path: '/rules/rules-library/:id',
            name: 'rules-library-item',
            component: RulesLibraryItemPage,
          },
          {
            path: '/rules/:tab',
            name: 'my-rules',
            component: RulesPage,
          },
        ],
      },
      isSarEnabled && {
        path: '/reports',
        name: 'reports',
        icon: 'reports',
        hideChildrenInMenu: true,
        permissions: ['reports:generated:read'],
        position: 'top',
        routes: [
          {
            path: '/reports',
            name: 'reports',
            component: ReportsList,
          },
          {
            path: '/reports/:reportId',
            name: 'reports-item',
            component: ReportsList,
          },
        ],
      },
      isSalesRiskScoringEnabled && {
        path: '/risk-levels',
        icon: 'risk-scoring',
        name: 'risk-levels',
        position: 'top',
        permissions: [
          'risk-scoring:risk-factors:read',
          'risk-scoring:risk-levels:read',
          'risk-scoring:risk-algorithms:read',
        ],
        routes: [
          {
            path: '/risk-levels',
            redirect: '/risk-levels/risk-factors',
            permissions: ['risk-scoring:risk-factors:read'],
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
            name: 'risk-factors',
            path: '/risk-levels/risk-factors/simulation-history',
            component: RiskFactorsSimulationHistoryPage,
            hideInMenu: true,
            permissions: ['risk-scoring:risk-factors:read'],
          },
          {
            name: 'risk-factors',
            path: '/risk-levels/risk-factors/simulation-history/:jobId',
            component: SimulationHistoryResultPage,
            hideInMenu: true,
            permissions: ['risk-scoring:risk-factors:read'],
          },
          {
            name: 'risk-factors',
            path: '/risk-levels/risk-factors/simulation-result/:jobId',
            component: SimulationHistoryResultPage,
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
          {
            name: 'custom-risk-factors',
            path: '/risk-levels/custom-risk-factors/',
            component: CustomRiskFactorsPage,
            permissions: ['risk-scoring:risk-factors:read'] as Permission[],
          },
          {
            name: 'custom-risk-factors',
            path: '/risk-levels/custom-risk-factors/:type',
            component: CustomRiskFactorsPage,
            hideInMenu: true,
            permissions: ['risk-scoring:risk-factors:read'] as Permission[],
          },
          {
            name: 'custom-risk-factors',
            path: '/risk-levels/custom-risk-factors/simulation-mode/:key/:type/:id/:mode',
            component: RiskFactorItemPage,
            hideInMenu: true,
            permissions: ['risk-scoring:risk-factors:read'] as Permission[],
          },
          {
            name: 'custom-risk-factors',
            path: '/risk-levels/custom-risk-factors/simulation-mode/:key/:type/:mode',
            component: RiskFactorItemPage,
            hideInMenu: true,
            permissions: ['risk-scoring:risk-factors:read'] as Permission[],
          },
          {
            name: 'custom-risk-factors',
            path: '/risk-levels/custom-risk-factors/:type/:id/:mode',
            component: RiskFactorItemPage,
            hideInMenu: true,
            permissions: ['risk-scoring:risk-factors:read'] as Permission[],
          },
          {
            name: 'custom-risk-factors',
            path: '/risk-levels/custom-risk-factors/:type/:mode',
            component: RiskFactorItemPage,
            hideInMenu: true,
            permissions: ['risk-scoring:risk-factors:read'] as Permission[],
          },
          {
            name: 'custom-risk-factors',
            path: '/risk-levels/custom-risk-factors/simulation-history',
            component: RiskFactorsSimulationHistoryPage,
            hideInMenu: true,
            permissions: ['risk-scoring:risk-factors:read'],
          },
          {
            name: 'custom-risk-factors',
            path: '/risk-levels/custom-risk-factors/simulation-history/:jobId',
            component: SimulationHistoryResultPage,
            hideInMenu: true,
            permissions: ['risk-scoring:risk-factors:read'],
          },
          {
            name: 'custom-risk-factors',
            path: '/risk-levels/custom-risk-factors/simulation-result/:jobId',
            component: SimulationHistoryResultPage,
            hideInMenu: true,
            permissions: ['risk-scoring:risk-factors:read'],
          },
        ],
      },
      !isSalesRiskScoringEnabled &&
        (isRiskScoringEnabled || isRiskScoringV8Enabled) && {
          path: '/risk-levels',
          icon: 'risk-scoring',
          name: 'risk-levels',
          position: 'top',
          permissions: [
            'risk-scoring:risk-factors:read',
            'risk-scoring:risk-levels:read',
            'risk-scoring:risk-algorithms:read',
          ],
          routes: [
            ...(!isRiskScoringV8Enabled && isRiskScoringEnabled
              ? [
                  {
                    path: '/risk-levels',
                    redirect: '/risk-levels/risk-factors',
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'risk-factors',
                    path: '/risk-levels/risk-factors/',
                    component: RiskLevelPage,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'risk-factors',
                    path: '/risk-levels/risk-factors/:type',
                    component: RiskLevelPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'risk-factors',
                    path: '/risk-levels/risk-factors/simulation-history',
                    component: RiskFactorsSimulationHistoryPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'risk-factors',
                    path: '/risk-levels/risk-factors/simulation-history/:jobId',
                    component: SimulationHistoryResultPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'risk-factors',
                    path: '/risk-levels/risk-factors/simulation-result/:jobId',
                    component: SimulationHistoryResultPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                ]
              : []),
            ...(isRiskScoringV8Enabled
              ? [
                  {
                    path: '/risk-levels',
                    redirect: '/risk-levels/custom-risk-factors',
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'custom-risk-factors',
                    path: '/risk-levels/custom-risk-factors/',
                    component: CustomRiskFactorsPage,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'custom-risk-factors',
                    path: '/risk-levels/custom-risk-factors/:type',
                    component: CustomRiskFactorsPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'custom-risk-factors',
                    path: '/risk-levels/custom-risk-factors/simulation-mode/:key/:type/:id/:mode',
                    component: RiskFactorItemPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'custom-risk-factors',
                    path: '/risk-levels/custom-risk-factors/simulation-mode/:key/:type/:mode',
                    component: RiskFactorItemPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'custom-risk-factors',
                    path: '/risk-levels/custom-risk-factors/:type/:id/:mode',
                    component: RiskFactorItemPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'custom-risk-factors',
                    path: '/risk-levels/custom-risk-factors/:type/:mode',
                    component: RiskFactorItemPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'custom-risk-factors',
                    path: '/risk-levels/custom-risk-factors/simulation-history',
                    component: RiskFactorsSimulationHistoryPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'custom-risk-factors',
                    path: '/risk-levels/custom-risk-factors/simulation-history/:jobId',
                    component: SimulationHistoryResultPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                  {
                    name: 'custom-risk-factors',
                    path: '/risk-levels/custom-risk-factors/simulation-result/:jobId',
                    component: SimulationHistoryResultPage,
                    hideInMenu: true,
                    permissions: ['risk-scoring:risk-factors:read'] as Permission[],
                  },
                ]
              : []),
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
      {
        name: 'lists',
        path: '/lists',
        icon: 'lists',
        position: 'top',
        hideChildrenInMenu: true,
        permissions: [],
        routes: [
          {
            path: '/lists/whitelist',
            name: 'lists-whitelist',
            component: CreatedListsPage,
            permissions: ['lists:whitelist:read'],
          },
          {
            path: '/lists/blacklist',
            name: 'lists-blacklist',
            component: CreatedListsPage,
            permissions: ['lists:blacklist:read'],
          },
          {
            path: '/lists/whitelist/:id',
            name: 'lists-whitelist-item',
            component: ListsItemPage,
            permissions: ['lists:whitelist:read'],
          },
          {
            path: '/lists/blacklist/:id',
            name: 'lists-blacklist-item',
            component: ListsItemPage,
            permissions: ['lists:blacklist:read'],
          },
          {
            path: '/lists',
            redirect: lastActiveList === 'whitelist' ? '/lists/whitelist' : '/lists/blacklist',
            permissions: [],
          },
        ],
      },
      // Redirect any path starting with /sanctions to /screening
      {
        path: '/sanctions/*',
        name: 'sanctions-redirect',
        hideInMenu: true,
        routes: [
          {
            path: '/sanctions',
            redirect: '/screening',
          },
          {
            path: '/sanctions/:type',
            redirect: '/screening/:type',
          },
          {
            path: '/sanctions/search/:searchId',
            redirect: '/screening/search/:searchId',
          },
          {
            path: '/sanctions/activity',
            redirect: '/screening/activity',
          },
        ],
      },
      {
        path: '/screening',
        name: 'sanctions',
        icon: 'sanctions',
        hideChildrenInMenu: true,
        position: 'top',
        disabled: !isSanctionsEnabled,
        associatedFeatures: ['SANCTIONS'],
        permissions: ['sanctions:search:read'],
        routes: isSanctionsEnabled
          ? [
              {
                path: '/screening',
                redirect:
                  lastActiveSanctionsTab === 'search'
                    ? '/screening/search'
                    : '/screening/search-history',
              },
              {
                path: '/screening/:type',
                name: 'sanctions',
                component: SanctionsPage,
              },
              {
                path: '/screening/search/:searchId',
                component: SanctionsPage,
                name: 'search-history-item',
              },
            ]
          : [],
      },
      (isAtLeastAdminUser || hasAuditLogPermission) && {
        path: '/auditlog',
        icon: 'auditlog',
        name: 'auditlog',
        position: 'top',
        permissions: ['audit-log:export:read'],
        disabled: !isAuditLogEnabled,
        associatedFeatures: ['AUDIT_LOGS'],
        component: AuditLogPage,
      },
      ...(hasMachineLearningFeature
        ? [
            {
              path: '/ml-models',
              icon: 'ml-models',
              name: 'ml-models',
              position: 'top',
              hideChildrenInMenu: true,
              component: MlModelsPage,
            } as RouteItem,
          ]
        : []),
      {
        path: '/settings',
        icon: 'settings',
        name: 'settings',
        position: 'bottom',

        hideChildrenInMenu: true,
        component: SettingsPage,
        routes: [
          {
            path: '/settings/:section',
            name: 'settings-section',
            component: SettingsPage,
          },
        ],
      },
      {
        path: '/accounts',
        icon: 'accounts',
        name: 'accounts',
        position: 'bottom',
        hideChildrenInMenu: true,
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
        permissions: ['dashboard:download-data:read'],
      },
      {
        path: '/auth/clueso',
        name: 'clueso',
        component: Clueso,
        hideInMenu: true,
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
    isRiskScoringEnabled,
    isSarEnabled,
    lastActiveList,
    isSanctionsEnabled,
    isAuditLogEnabled,
    lastActiveSanctionsTab,
    isAtLeastAdminUser,
    hasAuditLogPermission,
    permissions,
    hasMachineLearningFeature,
    isRiskScoringV8Enabled,
    isSalesRiskScoringEnabled,
  ]);
}

function disableForbiddenRoutes(r: RouteItem, permissions?: Map<Permission, boolean>): RouteItem {
  if (!(isLeaf(r) || isTree(r))) {
    return r;
  }
  const routePermissions = r.permissions ?? [];
  const hasAnyOnePermission = routePermissions.some((p) => permissions?.get(p));
  if (routePermissions.length > 0 && !hasAnyOnePermission) {
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
