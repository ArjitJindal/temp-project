import React, { useMemo } from 'react';
import { Resource } from '@flagright/lib/utils';
import { PermissionStatements } from '@/apis';
import {
  useFeatureEnabled,
  useResources,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { isLeaf, isTree, RouteItem } from '@/services/routing/types';
import {
  hasMinimumPermission,
  isAtLeastAdmin,
  useAuth0User,
  useHasResources,
} from '@/utils/user-utils';
import { useSafeLocalStorageState } from '@/utils/hooks';

const RulesItemPage = React.lazy(() => import('src/pages/rules/rules-item'));
const RulesLibraryItemPage = React.lazy(() => import('src/pages/rules/rules-library-item'));
const WorkflowsItemPage = React.lazy(() => import('src/pages/workflows/workflows-item-page'));
const ForbiddenPage = React.lazy(() => import('@/pages/403'));
const Page404 = React.lazy(() => import('@/pages/404'));
const AccountsPage = React.lazy(() => import('@/pages/accounts'));
const AlertItemPage = React.lazy(() => import('@/pages/alert-item'));
const AuditLogPage = React.lazy(() => import('@/pages/auditlog'));
const Clueso = React.lazy(() => import('@/pages/auth/clueso'));
const CaseManagementPage = React.lazy(() => import('@/pages/case-management'));
const CaseManagementItemPage = React.lazy(() => import('@/pages/case-management-item'));
const DashboardAnalysisPage = React.lazy(() => import('@/pages/dashboard/analysis'));
const CreatedListsPage = React.lazy(() => import('@/pages/lists'));
const ListsItemPage = React.lazy(() => import('@/pages/lists-item'));
const QASamplePage = React.lazy(() => import('@/pages/qa-sample-item'));
const QASamplesTable = React.lazy(() => import('@/pages/qa-samples'));
const ReportsList = React.lazy(() => import('@/pages/reports'));
const RiskLevelsConfigurePage = React.lazy(() => import('@/pages/risk-levels/configure'));
const RiskAlgorithmTable = React.lazy(() => import('@/pages/risk-levels/risk-algorithms'));
const RiskFactorPage = React.lazy(() => import('@/pages/risk-levels/risk-factors'));
const RiskFactorItemPage = React.lazy(() => import('@/pages/risk-levels/risk-factors/RiskItem'));
const RiskFactorsSimulationHistoryPage = React.lazy(
  () => import('@/pages/risk-levels/RiskFactorsSimulation/SimulationHistoryPage'),
);
const SimulationHistoryResultPage = React.lazy(
  () =>
    import(
      '@/pages/risk-levels/RiskFactorsSimulation/SimulationHistoryPage/SimulationHistoryResultPage'
    ),
);
const RulesPage = React.lazy(() => import('@/pages/rules'));
const RuleInstancePage = React.lazy(() => import('@/pages/rules/rule-instance-page'));
const SimulationHistoryPage = React.lazy(() => import('@/pages/rules/simulation-history'));
const SimulationHistoryItemPage = React.lazy(() => import('@/pages/rules/simulation-history-item'));
const SanctionsPage = React.lazy(() => import('@/pages/sanctions'));
const SettingsPage = React.lazy(() => import('@/pages/settings'));
const TransactionsListPage = React.lazy(() => import('@/pages/transactions'));
const TransactionsItemPage = React.lazy(() => import('@/pages/transactions-item'));
const UsersImport = React.lazy(() => import('@/pages/users-import/UsersImport'));
const UsersItemPage = React.lazy(() => import('@/pages/users-item'));
const UsersUsersListPage = React.lazy(() => import('@/pages/users/users-list'));
const WorkflowsPage = React.lazy(() => import('@/pages/workflows/workflows-page'));
const WorkflowsCreatePage = React.lazy(() => import('@/pages/workflows/workflows-create-page'));
const AccountsRolesItemPage = React.lazy(
  () => import('@/pages/accounts/RolesV2/AccountsRolesItemPage'),
);
const VersionHistoryPage = React.lazy(() => import('@/components/VersionHistory'));
const RiskVersionHistoryItem = React.lazy(
  () => import('@/pages/risk-levels/configure/RiskVersionHistoryItem'),
);
const RiskFactorVersionHistoryItem = React.lazy(
  () => import('@/pages/risk-levels/risk-factors/RiskFactorVersionHistoryItem'),
);
const ReportItem = React.lazy(() => import('@/pages/report-item'));
const TransactionsImportPage = React.lazy(() => import('@/pages/transactions-import'));

export function useRoutes(): RouteItem[] {
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');
  const isSarEnabled = useFeatureEnabled('SAR');
  const isWorkflowsEnabled = useFeatureEnabled('WORKFLOWS_BUILDER');
  const hasMachineLearningFeature = useFeatureEnabled('MACHINE_LEARNING');
  const [lastActiveTab] = useSafeLocalStorageState('user-active-tab', 'consumer');
  const [lastActiveRuleTab] = useSafeLocalStorageState('rule-active-tab', 'rules-library', true);
  const [lastActiveList] = useSafeLocalStorageState('user-active-list', 'whitelist');
  const [lastActiveSanctionsTab] = useSafeLocalStorageState('sanctions-active-tab', 'search', true);
  const { statements } = useResources();

  const hasAuditLogPermission = useHasResources(['read:::audit-log/export/*']);

  // Check permissions for screening tabs
  const hasManualScreeningPermission = useHasResources(['read:::screening/manual-screening/*']);
  const hasActivityPermission = useHasResources(['read:::screening/activity/*']);
  const hasWhitelistPermission = useHasResources(['read:::screening/whitelist/*']);
  const user = useAuth0User();
  const isAtLeastAdminUser = isAtLeastAdmin(user);
  const isRiskLevelSimulationMode =
    localStorage.getItem('SIMULATION_CUSTOM_RISK_FACTORS') === 'true';

  return useMemo((): RouteItem[] => {
    const routes: (RouteItem | boolean)[] = [
      {
        path: '/dashboard',
        name: 'dashboard',
        icon: 'dashboard',
        position: 'top',
        hideChildrenInMenu: true,
        minRequiredResources: ['read:::dashboard/download-data/*'],
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
        minRequiredResources: ['read:::case-management/*'],
        routes: [
          {
            path: '/case-management/case/:id',
            component: CaseManagementItemPage,
            name: 'item',
            minRequiredResources: ['read:::case-management/case-details/*'],
          },
          {
            path: '/case-management/alerts/:id',
            component: AlertItemPage,
            name: 'alert-item',
            minRequiredResources: ['read:::case-management/case-details/*'],
          },
          {
            path: '/case-management/alerts/:id/:tab',
            component: AlertItemPage,
            name: 'alert-item',
            minRequiredResources: ['read:::case-management/case-details/*'],
          },
          {
            path: '/case-management/case/:id/:tab',
            component: CaseManagementItemPage,
            name: 'item-tab',
            minRequiredResources: ['read:::case-management/case-details/*'],
          },
          {
            path: '/case-management',
            redirect: '/case-management/cases',
            minRequiredResources: ['read:::case-management/*'],
          },
          {
            path: '/case-management/cases',
            component: CaseManagementPage,
            name: 'list',
            minRequiredResources: ['read:::case-management/*'],
          },
          {
            path: '/case-management/qa-sampling',
            component: QASamplesTable,
            name: 'qa-sampling',
            minRequiredResources: ['read:::case-management/qa/*'],
          },
          {
            path: '/case-management/qa-sampling/:samplingId',
            component: QASamplePage,
            name: 'qa-sampling-item',
            minRequiredResources: ['read:::case-management/qa/*'],
          },
        ],
      },
      {
        path: '/transactions',
        icon: 'transactions',
        name: 'transactions',
        hideChildrenInMenu: true,
        position: 'top',
        minRequiredResources: ['read:::transactions/overview/*'],
        routes: [
          {
            path: '/transactions/item/:id',
            component: TransactionsItemPage,
            name: 'transactions-item',
            minRequiredResources: ['read:::transactions/details/*'],
          },
          {
            path: '/transactions/item/:id/:tab',
            component: TransactionsItemPage,
            name: 'transactions-item-tab',
            minRequiredResources: ['read:::transactions/details/*'],
          },
          {
            name: 'transactions-list',
            component: TransactionsListPage,
            path: '/transactions/list',
          },
          {
            name: 'transactions-import',
            component: TransactionsImportPage,
            path: '/transactions/import/csv',
          },
          {
            path: '/transactions/import',
            redirect: '/transactions/import/csv',
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
        minRequiredResources: ['read:::users/user-overview/*'],
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
                    ? '/users/list/consumer'
                    : lastActiveTab === 'all'
                    ? '/users/list/all'
                    : '/users/list/business',
              },
              {
                path: '/users/list/:list',
                name: 'user-lists-all',
                component: UsersUsersListPage,
              },
              {
                path: '/users/list/:list/import',
                name: 'user-import',
                component: UsersImport,
                hideInMenu: true,
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
        position: 'top',
        minRequiredResources: ['read:::rules/my-rules/*', 'read:::rules/library/*'],
        routes: [
          {
            path: '/rules',
            redirect:
              lastActiveRuleTab === 'my-rules'
                ? '/rules/my-rules'
                : lastActiveRuleTab === 'rules-library' || !hasMachineLearningFeature
                ? '/rules/rules-library'
                : '/rules/ai-detection',
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
          ...(hasMachineLearningFeature
            ? [
                {
                  path: '/rules/ai-detection/simulation-history',
                  name: 'simulation-history',
                  component: SimulationHistoryPage,
                },
                {
                  path: '/rules/ai-detection/simulation-history/:id',
                  name: 'simulation-history',
                  component: SimulationHistoryItemPage,
                },
              ]
            : []),
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
          ...(hasMachineLearningFeature
            ? [
                {
                  path: '/rules/:tab',
                  name: 'ai-detection',
                  component: RulesPage,
                },
              ]
            : []),
        ],
      },
      isSarEnabled && {
        path: '/reports',
        name: 'reports',
        icon: 'reports',
        hideChildrenInMenu: true,
        minRequiredResources: ['read:::reports/generated/*'],
        position: 'top',
        routes: [
          {
            path: '/reports',
            name: 'reports',
            component: ReportsList,
          },
          {
            path: '/report/:reportId/:mode',
            name: 'report-item',
            component: ReportItem,
          },
        ],
      },
      (isRiskLevelsEnabled || isRiskScoringEnabled) && {
        path: isRiskLevelSimulationMode ? '/risk-levels/risk-factors/simulation' : '/risk-levels',
        icon: 'risk-scoring',
        name: 'risk-levels',
        position: 'top',
        minRequiredResources: ['read:::risk-scoring/*'],
        routes: [
          ...(isRiskLevelsEnabled
            ? [
                {
                  name: 'risk-levels-configure',
                  path: '/risk-levels/configure',
                  component: RiskLevelsConfigurePage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-levels/*'] as Resource[],
                },
                {
                  name: 'risk-levels-configure',
                  path: '/risk-levels/configure/:type',
                  component: RiskLevelsConfigurePage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-levels/*'] as Resource[],
                },
                {
                  name: 'risk-levels-version-history',
                  path: '/risk-levels/version-history',
                  component: VersionHistoryPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-levels/*'] as Resource[],
                },
                {
                  name: 'risk-levels-version-history-item',
                  path: '/risk-levels/version-history/:versionId',
                  component: RiskVersionHistoryItem,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-levels/*'] as Resource[],
                },
              ]
            : []),
          ...(isRiskScoringEnabled
            ? [
                {
                  name: 'risk-factors',
                  path: isRiskLevelSimulationMode
                    ? '/risk-levels/risk-factors/simulation'
                    : '/risk-levels/risk-factors',
                  component: RiskFactorPage,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors',
                  path: isRiskLevelSimulationMode
                    ? '/risk-levels/risk-factors/simulation/:type'
                    : '/risk-levels/risk-factors/:type',
                  component: RiskFactorPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors-version-history',
                  path: '/risk-levels/risk-factors/version-history',
                  component: VersionHistoryPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors-version-history-item',
                  path: '/risk-levels/risk-factors/version-history/:versionId/:type',
                  component: RiskFactorVersionHistoryItem,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors',
                  path: '/risk-levels/risk-factors/simulation-history',
                  component: RiskFactorsSimulationHistoryPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors',
                  path: '/risk-levels/risk-factors/simulation-history/:jobId',
                  component: SimulationHistoryResultPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors',
                  path: '/risk-levels/risk-factors/simulation-result/:jobId',
                  component: SimulationHistoryResultPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors-create',
                  path: '/risk-levels/risk-factors/:type/create',
                  component: RiskFactorItemPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors-edit',
                  path: '/risk-levels/risk-factors/:type/:id/edit',
                  component: RiskFactorItemPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors-read',
                  path: '/risk-levels/risk-factors/:type/:id/read',
                  component: RiskFactorItemPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors-duplicate',
                  path: '/risk-levels/risk-factors/:type/:id/duplicate',
                  component: RiskFactorItemPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors-simulation-mode-create',
                  path: '/risk-levels/risk-factors/simulation-mode/:key/:type/create',
                  component: RiskFactorItemPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors-simulation-mode-edit',
                  path: '/risk-levels/risk-factors/simulation-mode/:key/:type/:id/edit',
                  component: RiskFactorItemPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  name: 'risk-factors-simulation-mode-read',
                  path: '/risk-levels/risk-factors/simulation-mode/:key/:type/:id/read',
                  component: RiskFactorItemPage,
                  hideInMenu: true,
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
                {
                  path: '/risk-levels',
                  redirect: '/risk-levels/risk-factors',
                  minRequiredResources: ['read:::risk-scoring/risk-factors/*'] as Resource[],
                },
              ]
            : []),
          {
            name: 'risk-algorithms',
            path: '/risk-levels/risk-algorithms',
            component: RiskAlgorithmTable,
            minRequiredResources: ['read:::risk-scoring/risk-algorithms/*'] as Resource[],
          },
        ],
      },
      {
        name: 'lists',
        path: '/lists',
        icon: 'lists',
        position: 'top',
        hideChildrenInMenu: true,
        minRequiredResources: ['read:::lists/*'],
        routes: [
          {
            path: '/lists/whitelist',
            name: 'lists-whitelist',
            component: CreatedListsPage,
            minRequiredResources: ['read:::lists/whitelist/*'],
          },
          {
            path: '/lists/blacklist',
            name: 'lists-blacklist',
            component: CreatedListsPage,
            minRequiredResources: ['read:::lists/blacklist/*'],
          },
          {
            path: '/lists/whitelist/:id',
            name: 'lists-whitelist-item',
            component: ListsItemPage,
            minRequiredResources: ['read:::lists/whitelist/*'],
          },
          {
            path: '/lists/blacklist/:id',
            name: 'lists-blacklist-item',
            component: ListsItemPage,
            minRequiredResources: ['read:::lists/blacklist/*'],
          },
          {
            path: '/lists',
            redirect: lastActiveList === 'whitelist' ? '/lists/whitelist' : '/lists/blacklist',
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
            path: '/sanctions/manual-screening/:searchId',
            redirect: '/screening/manual-screening/:searchId',
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
        minRequiredResources: [
          'read:::screening/manual-screening/*',
          'read:::screening/activity/*',
          'read:::screening/whitelist/*',
        ],
        routes: isSanctionsEnabled
          ? [
              {
                path: '/screening',
                redirect: (() => {
                  // Determine redirect based on permissions and last active tab
                  if (lastActiveSanctionsTab === 'search' && hasManualScreeningPermission) {
                    return '/screening/manual-screening';
                  } else if (lastActiveSanctionsTab === 'activity' && hasActivityPermission) {
                    return '/screening/activity';
                  } else if (lastActiveSanctionsTab === 'whitelist' && hasWhitelistPermission) {
                    return '/screening/whitelist';
                  }

                  // Fallback: redirect to first available tab
                  if (hasManualScreeningPermission) {
                    return '/screening/manual-screening';
                  } else if (hasActivityPermission) {
                    return '/screening/activity';
                  } else if (hasWhitelistPermission) {
                    return '/screening/whitelist';
                  }

                  // If no permissions, redirect to manual-screening (will show forbidden)
                  return '/screening/manual-screening';
                })(),
              },
              {
                path: '/screening/:type',
                name: 'sanctions',
                component: SanctionsPage,
              },
              {
                path: '/screening/manual-screening/:searchId',
                component: SanctionsPage,
                name: 'search-history-item',
              },
            ]
          : [],
      },
      isWorkflowsEnabled && {
        path: '/workflows',
        name: 'workflows',
        icon: 'workflows',
        hideChildrenInMenu: true,
        position: 'top',
        disabled: !isWorkflowsEnabled,
        associatedFeatures: ['WORKFLOWS_BUILDER'],
        // permissions: ['workflows:all:read'],
        // requiredResources: ['read:::workflows/all/*'],
        routes: [
          {
            path: '/workflows',
            redirect: '/workflows/list',
          },
          {
            path: '/workflows/:type/item/:id',
            name: 'workflows-item-page',
            component: WorkflowsItemPage,
          },
          {
            path: '/workflows/:type/create/:templateId',
            name: 'workflows-create-page',
            component: WorkflowsCreatePage,
          },
          {
            path: '/workflows/:section',
            name: 'workflows-page',
            component: WorkflowsPage,
          },
        ],
      },
      (isAtLeastAdminUser || hasAuditLogPermission) && {
        path: '/auditlog',
        icon: 'auditlog',
        name: 'auditlog',
        position: 'top',
        minRequiredResources: ['read:::audit-log/export/*'],
        component: AuditLogPage,
      },
      {
        path: '/settings',
        icon: 'settings',
        name: 'settings',
        position: 'bottom',
        minRequiredResources: ['read:::settings/*'],
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
        minRequiredResources: ['write:::accounts/*'],
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
          {
            path: '/accounts/roles/:roleId',
            name: 'accounts-roles-item',
            component: AccountsRolesItemPage,
          },
          {
            path: '/accounts/roles/:roleId/:mode',
            name: 'accounts-roles-item-mode',
            component: AccountsRolesItemPage,
          },
        ],
      },
      {
        path: '/',
        redirect: '/dashboard/analysis',
        minRequiredResources: ['read:::dashboard/analysis/*'],
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
      .map((r) => disableForbiddenRoutes(r, statements));
  }, [
    lastActiveTab,
    lastActiveRuleTab,
    isSarEnabled,
    isRiskLevelsEnabled,
    isRiskScoringEnabled,
    isRiskLevelSimulationMode,
    lastActiveList,
    isSanctionsEnabled,
    lastActiveSanctionsTab,
    isWorkflowsEnabled,
    isAtLeastAdminUser,
    hasAuditLogPermission,
    hasMachineLearningFeature,
    hasManualScreeningPermission,
    hasActivityPermission,
    hasWhitelistPermission,
    statements,
  ]);
}

function disableForbiddenRoutes(r: RouteItem, statements?: PermissionStatements[]): RouteItem {
  if (!(isLeaf(r) || isTree(r))) {
    return r;
  }

  const result: RouteItem = { ...r };
  const minRequiredResources = r.minRequiredResources ?? [];

  const hasAccess =
    minRequiredResources.length > 0 && statements
      ? hasMinimumPermission(statements, minRequiredResources)
      : true;

  if (minRequiredResources.length > 0 && !hasAccess) {
    if (isLeaf(result)) {
      result.component = ForbiddenPage;
    }
    result.disabled = true;
  }

  if (isTree(result)) {
    // If parent disabled, disable children.
    if (result.disabled) {
      result.routes = result.routes.map((r) => ({
        ...r,
        disabled: true,
        component: ForbiddenPage,
      }));
    } else {
      result.routes = result.routes.map((r) => disableForbiddenRoutes(r, statements));
    }
  }
  return result;
}
