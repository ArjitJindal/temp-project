import { useMemo } from 'react';
import RulesItemPage from 'src/pages/rules/rules-item';
import RulesLibraryItemPage from 'src/pages/rules/rules-library-item';
import WorkflowsItemPage from 'src/pages/workflows/workflows-item-page';
import { Resource } from '@flagright/lib/utils';
import { PermissionStatements } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import ForbiddenPage from '@/pages/403';
import Page404 from '@/pages/404';
import AccountsPage from '@/pages/accounts';
import AlertItemPage from '@/pages/alert-item';
import AuditLogPage from '@/pages/auditlog';
import Clueso from '@/pages/auth/clueso';
import CaseManagementPage from '@/pages/case-management';
import CaseManagementItemPage from '@/pages/case-management-item';
import DashboardAnalysisPage from '@/pages/dashboard/analysis';
import CreatedListsPage from '@/pages/lists';
import ListsItemPage from '@/pages/lists-item';
import { QASamplePage } from '@/pages/qa-sample-item';
import { QASamplesTable } from '@/pages/qa-samples';
import ReportsList from '@/pages/reports';
import RiskLevelsConfigurePage from '@/pages/risk-levels/configure';
import RiskAlgorithmTable from '@/pages/risk-levels/risk-algorithms';
import RiskFactorPage from '@/pages/risk-levels/risk-factors';
import RiskFactorItemPage from '@/pages/risk-levels/risk-factors/RiskItem';
import { SimulationHistoryPage as RiskFactorsSimulationHistoryPage } from '@/pages/risk-levels/RiskFactorsSimulation/SimulationHistoryPage';
import { SimulationHistoryResultPage } from '@/pages/risk-levels/RiskFactorsSimulation/SimulationHistoryPage/SimulationHistoryResultPage';
import RulesPage from '@/pages/rules';
import { RuleInstancePage } from '@/pages/rules/rule-instance-page';
import SimulationHistoryPage from '@/pages/rules/simulation-history';
import SimulationHistoryItemPage from '@/pages/rules/simulation-history-item';
import SanctionsPage from '@/pages/sanctions';
import SettingsPage from '@/pages/settings';
import TransactionsListPage from '@/pages/transactions';
import TransactionsItemPage from '@/pages/transactions-item';
import UsersItemPage from '@/pages/users-item';
import UsersUsersListPage from '@/pages/users/users-list';
import WorkflowsPage from '@/pages/workflows/workflows-page';
import WorkflowsCreatePage from '@/pages/workflows/workflows-create-page';
import { isLeaf, isTree, RouteItem } from '@/services/routing/types';
import {
  isAtLeastAdmin,
  useAuth0User,
  useHasResources,
  hasMinimumPermission,
} from '@/utils/user-utils';
import { useSafeLocalStorageState } from '@/utils/hooks';
import AccountsRolesItemPage from '@/pages/accounts/RolesV2/AccountsRolesItemPage';
import { useResources } from '@/components/AppWrapper/Providers/StatementsProvider';
import RiskLevelsVersionHistoryPage from '@/pages/risk-levels/configure/RiskLevelsVersionHistory';
import RiskVersionHistoryItem from '@/pages/risk-levels/configure/RiskVersionHistoryItem';

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
        position: 'top',
        minRequiredResources: ['read:::rules/library/*'],
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
            path: '/reports/:reportId',
            name: 'reports-item',
            component: ReportsList,
          },
        ],
      },
      (isRiskLevelsEnabled || isRiskScoringEnabled) && {
        path: '/risk-levels',
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
                  component: RiskLevelsVersionHistoryPage,
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
              ]
            : []),
          {
            name: 'risk-algorithms',
            path: '/risk-levels/risk-algorithms',
            component: RiskAlgorithmTable,
            minRequiredResources: ['read:::risk-scoring/risk-algorithms/*'] as Resource[],
          },
          ...(isRiskScoringEnabled
            ? [
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
        minRequiredResources: ['read:::sanctions/search/*'],
        routes: isSanctionsEnabled
          ? [
              {
                path: '/screening',
                redirect:
                  lastActiveSanctionsTab === 'search'
                    ? '/screening/manual-screening'
                    : '/screening/manual-screening-history',
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
