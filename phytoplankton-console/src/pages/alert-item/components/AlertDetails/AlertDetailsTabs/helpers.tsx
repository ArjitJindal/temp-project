import React, { useMemo, useState } from 'react';
import { firstLetterUpper, humanizeAuto } from '@flagright/lib/utils/humanize';
import { useQueryClient } from '@tanstack/react-query';
import styles from './index.module.less';
import HitsTab from './HitsTab';
import Checklist from './ChecklistTab';
import TransactionsTab from './TransactionsTab';
import CommentsTab from './CommentsTab';
import ActivityTab from './ActivityTab';
import AiForensicsTab from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/AiForensicsTab';
import { TabItem } from '@/components/library/Tabs';
import { useApi } from '@/api';
import { CursorPaginatedData, useCursorQuery, useQuery } from '@/utils/queries/hooks';
import {
  ALERT_ITEM_COMMENTS,
  CASES_ITEM,
  SANCTIONS_HITS_ALL,
  SANCTIONS_HITS_SEARCH,
} from '@/utils/queries/keys';
import { AllParams, SelectionAction, SelectionInfo } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { getOr, isSuccess, map } from '@/utils/asyncResource';
import { notEmpty } from '@/utils/array';
import {
  Alert,
  SanctionHitStatusUpdateRequest,
  SanctionsDetails,
  SanctionsDetailsEntityType,
  SanctionsHit,
  SanctionsHitListResponse,
  SanctionsHitStatus,
  TransactionTableItem,
} from '@/apis';
import { Mutation, QueryResult } from '@/utils/queries/types';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { isScreeningAlert } from '@/utils/api/alerts';
import { TransactionsTableParams } from '@/pages/transactions/components/TransactionsTable';
import UserDetails from '@/pages/users-item/UserDetails';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Linking from '@/pages/users-item/UserDetails/Linking';
import {
  useFeatureEnabled,
  useSettings,
  useFreshdeskCrmEnabled,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import InsightsCard from '@/pages/case-management-item/CaseDetails/InsightsCard';
import * as Card from '@/components/ui/Card';
import ExpectedTransactionLimits from '@/pages/users-item/UserDetails/shared/TransactionLimits';
import { CRM_ICON_MAP, useConsoleUser } from '@/pages/users-item/UserDetails/utils';
import {
  useLinkingState,
  useUserEntityFollow,
} from '@/pages/users-item/UserDetails/Linking/UserGraph';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';
import CRMRecords from '@/pages/users-item/UserDetails/CRMMonitoring/CRMRecords';
import CRMDataComponent from '@/pages/users-item/UserDetails/CRMMonitoring/CRMResponse';
import Tooltip from '@/components/library/Tooltip';

export enum AlertTabs {
  AI_FORENSICS = 'ai-forensics',
  TRANSACTIONS = 'transactions',
  CHECKLIST = 'checklist',
  COMMENTS = 'comments',
  ACTIVITY = 'activity',
  MATCH_LIST = 'match-list',
  CLEARED_MATCH_LIST = 'cleared-match-list',
  USER_DETAILS = 'user-details',
  ONTOLOGY = 'ontology',
  TRANSACTION_INSIGHTS = 'transaction-insights',
  EXPECTED_TRANSACTION_LIMITS = 'expected-transaction-limits',
  CRM = 'crm',
}

const DEFAULT_TAB_LISTS: AlertTabs[] = [
  AlertTabs.AI_FORENSICS,
  AlertTabs.TRANSACTIONS,
  AlertTabs.CHECKLIST,
  AlertTabs.COMMENTS,
  AlertTabs.USER_DETAILS,
  AlertTabs.CRM,
  AlertTabs.ONTOLOGY,
  AlertTabs.TRANSACTION_INSIGHTS,
  AlertTabs.EXPECTED_TRANSACTION_LIMITS,
  AlertTabs.ACTIVITY,
];

const SCREENING_ALERT_TAB_LISTS: AlertTabs[] = [
  AlertTabs.AI_FORENSICS,
  AlertTabs.MATCH_LIST,
  AlertTabs.CLEARED_MATCH_LIST,
  AlertTabs.CHECKLIST,
  AlertTabs.TRANSACTIONS,
  AlertTabs.COMMENTS,
  AlertTabs.USER_DETAILS,
  AlertTabs.CRM,
  AlertTabs.ONTOLOGY,
  AlertTabs.TRANSACTION_INSIGHTS,
  AlertTabs.EXPECTED_TRANSACTION_LIMITS,
  AlertTabs.ACTIVITY,
];

export const TABS_TO_HIDE_IN_TABLE: AlertTabs[] = [
  AlertTabs.AI_FORENSICS,
  AlertTabs.ACTIVITY,
  AlertTabs.USER_DETAILS,
  AlertTabs.ONTOLOGY,
  AlertTabs.TRANSACTION_INSIGHTS,
  AlertTabs.EXPECTED_TRANSACTION_LIMITS,
];

export interface SanctionsHitsTableParams {
  statuses?: SanctionsHitStatus[];
  searchIds?: string[];
  searchTerm?: string;
  fuzziness?: number;
  paymentMethodIds?: string[];
  entityType?: SanctionsDetailsEntityType;
}

export function useSanctionHitsQuery(
  params: AllParams<SanctionsHitsTableParams>,
  alertId?: string,
  enabled?: boolean,
): QueryResult<CursorPaginatedData<SanctionsHit>> {
  const api = useApi();
  const filters = {
    alertId: alertId,
    filterStatus: params.statuses ?? ['OPEN' as const],
    filterSearchId: params.searchIds,
    filterPaymentMethodId: params.paymentMethodIds,
    filterScreeningHitEntityType: params.entityType,
  };
  return useCursorQuery(
    SANCTIONS_HITS_SEARCH({ ...filters, ...params }),
    async (paginationParams): Promise<SanctionsHitListResponse> => {
      if (!filters.alertId) {
        return {
          items: [],
          next: '',
          prev: '',
          last: '',
          hasNext: false,
          hasPrev: false,
          count: 0,
          limit: 100000,
        };
      }
      const request = {
        ...filters,
        ...params,
        ...paginationParams,
      };
      return await api.searchSanctionsHits({
        ...request,
        start: request.from,
      });
    },
    {
      enabled: enabled !== false,
    },
  );
}

export function useChangeSanctionsHitsStatusMutation(): {
  changeHitsStatusMutation: Mutation<
    unknown,
    unknown,
    {
      toChange: { alertId: string; sanctionHitIds: string[] }[];
      updates: SanctionHitStatusUpdateRequest;
    }
  >;
} {
  const api = useApi();
  const queryClient = useQueryClient();

  const changeHitsStatusMutation = useMutation<
    unknown,
    unknown,
    {
      toChange: { alertId: string; sanctionHitIds: string[] }[];
      updates: SanctionHitStatusUpdateRequest;
    },
    unknown
  >(
    async (variables: {
      toChange: { alertId: string; sanctionHitIds: string[] }[];
      updates: SanctionHitStatusUpdateRequest;
    }) => {
      const hideMessage = message.loading(`Saving...`);
      const { toChange, updates } = variables;
      try {
        for (const { alertId, sanctionHitIds } of toChange) {
          await api.changeSanctionsHitsStatus({
            SanctionHitsStatusUpdateRequest: {
              alertId,
              sanctionHitIds,
              updates,
            },
          });
        }
      } finally {
        hideMessage();
      }
    },
    {
      onError: (e) => {
        message.error(`Failed to update hits! ${getErrorMessage(e)}`);
      },
      onSuccess: async (_, variables) => {
        message.success(`Done!`);
        await queryClient.invalidateQueries(SANCTIONS_HITS_ALL());
        for (const { alertId } of variables.toChange) {
          await queryClient.invalidateQueries(ALERT_ITEM_COMMENTS(alertId));
        }
      },
    },
  );

  return {
    changeHitsStatusMutation,
  };
}

type SelectedSanctionHits = {
  [alertId: string]: {
    id: string;
    status?: SanctionsHitStatus;
  }[];
};

export const updateSanctionsData = (
  formValues: SanctionHitStatusUpdateRequest & { newStatus: SanctionsHitStatus },
  selectedSanctionHits: SelectedSanctionHits,
) => {
  return {
    toChange: Object.entries(selectedSanctionHits).map(([alertId, sanctionHitIds]) => ({
      alertId,
      sanctionHitIds: sanctionHitIds.map(({ id }) => id),
    })),
    updates: {
      comment: formValues.comment,
      files: formValues.files,
      reasons: formValues.reasons,
      whitelistHits: formValues.whitelistHits,
      removeHitsFromWhitelist: formValues.removeHitsFromWhitelist,
      status: formValues.newStatus,
    },
  };
};

interface Props {
  alert: Alert;
  caseUserId: string;
  escalatedTransactionIds?: string[];
  selectedTransactionIds?: string[];
  onTransactionSelect?: (alertId: string, transactionIds: string[]) => void;
  selectedSanctionsHitsIds?: string[];
  sanctionsSearchIdFilter?: string;
  paymentMethodIdFilter?: string;
  onSanctionsHitSelect?: (
    alertId: string,
    sanctionsHitsIds: string[],
    statuses: SanctionsHitStatus,
  ) => void;
  onSanctionsHitsChangeStatus?: (sanctionsHitsIds: string[], newStatus: SanctionsHitStatus) => void;
  transactionSelectionActions?: SelectionAction<TransactionTableItem, TransactionsTableParams>[];
  selectionInfo?: SelectionInfo;
  selectionActions?: SelectionAction<SanctionsHit, SanctionsHitsTableParams>[];
  fitTablesHeight?: boolean;
  sanctionsDetailsFilter?: SanctionsDetails;
  entityTypeFilter?: SanctionsDetailsEntityType;
}

export function useAlertTabs(props: Props): TabItem[] {
  const {
    sanctionsSearchIdFilter,
    paymentMethodIdFilter,
    alert,
    caseUserId,
    selectedSanctionsHitsIds,
    onSanctionsHitSelect,
    escalatedTransactionIds,
    selectedTransactionIds,
    onTransactionSelect,
    onSanctionsHitsChangeStatus,
    transactionSelectionActions,
    selectionInfo,
    selectionActions,
    fitTablesHeight,
    sanctionsDetailsFilter,
    entityTypeFilter,
  } = props;

  const tabList = isScreeningAlert(alert) ? SCREENING_ALERT_TAB_LISTS : DEFAULT_TAB_LISTS;

  const alertId = alert?.alertId ?? '';

  const [openTableParams, setOpenTableParams] = useState<AllParams<SanctionsHitsTableParams>>({
    ...DEFAULT_PARAMS_STATE,
    statuses: ['OPEN'],
  });
  const [clearedTableParams, setClearedTableParams] = useState<AllParams<SanctionsHitsTableParams>>(
    {
      ...DEFAULT_PARAMS_STATE,
      statuses: ['CLEARED'],
    },
  );

  // Data requests
  const openHitsQueryResults = useSanctionHitsQuery(
    {
      ...openTableParams,
      searchIds: sanctionsSearchIdFilter ? [sanctionsSearchIdFilter] : undefined,
      paymentMethodIds: paymentMethodIdFilter ? [paymentMethodIdFilter] : undefined,
      entityType: entityTypeFilter,
    },
    alertId,
    tabList.includes(AlertTabs.MATCH_LIST),
  );
  const clearedHitsQueryResults = useSanctionHitsQuery(
    {
      ...clearedTableParams,
      searchIds: sanctionsSearchIdFilter ? [sanctionsSearchIdFilter] : undefined,
      paymentMethodIds: paymentMethodIdFilter ? [paymentMethodIdFilter] : undefined,
      entityType: entityTypeFilter,
    },
    alertId,
    tabList.includes(AlertTabs.CLEARED_MATCH_LIST),
  );

  const openHitsCount = getOr(
    map(openHitsQueryResults.data, (x) => x.count),
    null,
  );
  const clearedHitsCount = getOr(
    map(clearedHitsQueryResults.data, (x) => x.count),
    null,
  );

  const api = useApi();
  const settings = useSettings();
  const isCrmEnabled = useFeatureEnabled('CRM');
  const isFreshDeskCrmEnabled = useFreshdeskCrmEnabled();
  const isEntityLinkingEnabled = useFeatureEnabled('ENTITY_LINKING');
  const isAiForensicsEnabled = useFeatureEnabled('AI_FORENSICS');
  const isClickhouseEnabled = useFeatureEnabled('CLICKHOUSE_ENABLED');

  const caseQueryResult = useQuery(CASES_ITEM(alert.caseId ?? ''), () => {
    if (alert.caseId == null) {
      throw new Error(`Alert doesn't have case assigned`);
    }
    return api.getCase({ caseId: alert.caseId });
  });
  const userQueryResult = useConsoleUser(caseUserId);

  const linkingState = useLinkingState(caseUserId);
  const handleFollow = useUserEntityFollow(linkingState);

  const tabs: TabItem[] = useMemo(() => {
    return tabList
      .map((tab): TabItem | null => {
        if (tab === AlertTabs.AI_FORENSICS) {
          if (!isAiForensicsEnabled || !isClickhouseEnabled) {
            return null;
          }
          return {
            title: <AiForensicsLogo variant={'FULL'} />,
            key: tab,
            children: <AiForensicsTab alert={alert} caseUserId={caseUserId} />,
          };
        }
        if (tab === AlertTabs.TRANSACTIONS && alert.numberOfTransactionsHit > 0) {
          return {
            title: 'Transactions details',
            key: tab,
            children: (
              <TransactionsTab
                fitHeight={fitTablesHeight}
                alert={alert}
                caseUserId={caseUserId}
                selectedTransactionIds={selectedTransactionIds}
                onTransactionSelect={onTransactionSelect}
                escalatedTransactionIds={escalatedTransactionIds}
                selectionActions={transactionSelectionActions}
                sanctionsDetailsFilter={sanctionsDetailsFilter}
              />
            ),
          };
        }
        if (tab === AlertTabs.CHECKLIST) {
          if (alert.ruleChecklistTemplateId && alert.alertId) {
            return {
              title: 'Checklist',
              key: tab,
              children: <Checklist alert={alert} />,
            };
          }
        }
        if (tab === AlertTabs.COMMENTS) {
          return {
            title: 'Comments',
            key: tab,
            children: <CommentsTab alert={alert} />,
          };
        }
        if (tab === AlertTabs.ACTIVITY) {
          return {
            title: 'Activity',
            key: tab,
            children: <ActivityTab alert={alert} />,
          };
        }
        if (tab === AlertTabs.MATCH_LIST) {
          return {
            title: 'Human review' + (openHitsCount != null ? ` (${openHitsCount})` : ''),
            key: tab,
            children: (
              <HitsTab
                fitHeight={fitTablesHeight}
                alert={alert}
                params={[openTableParams, setOpenTableParams]}
                selectedSanctionsHitsIds={selectedSanctionsHitsIds}
                onSanctionsHitSelect={(sanctionsHitsIds) => {
                  if (!alert?.alertId) {
                    return;
                  }
                  onSanctionsHitSelect?.(alert.alertId, sanctionsHitsIds, 'OPEN');
                }}
                onSanctionsHitsChangeStatus={onSanctionsHitsChangeStatus}
                queryResult={openHitsQueryResults}
                selectionInfo={selectionInfo}
                selectionActions={selectionActions}
              />
            ),
          };
        }
        if (tab === AlertTabs.CLEARED_MATCH_LIST) {
          return {
            title: 'Cleared hits' + (clearedHitsCount != null ? ` (${clearedHitsCount})` : ''),
            key: tab,
            children: (
              <HitsTab
                alert={alert}
                params={[clearedTableParams, setClearedTableParams]}
                selectedSanctionsHitsIds={selectedSanctionsHitsIds}
                onSanctionsHitSelect={(sanctionsHitsIds) => {
                  if (!alert?.alertId) {
                    return;
                  }
                  onSanctionsHitSelect?.(alert.alertId, sanctionsHitsIds, 'CLEARED');
                }}
                onSanctionsHitsChangeStatus={onSanctionsHitsChangeStatus}
                queryResult={clearedHitsQueryResults}
                selectionInfo={selectionInfo}
                selectionActions={selectionActions}
              />
            ),
          };
        }
        if (tab === AlertTabs.USER_DETAILS) {
          return {
            title: `${firstLetterUpper(settings.userAlias)} details`,
            key: tab,
            children: <UserDetails userId={caseUserId} />,
          };
        }
        if (tab === AlertTabs.ONTOLOGY) {
          if (!isEntityLinkingEnabled) {
            return null;
          }
          if (!isSuccess(caseQueryResult.data) || !isSuccess(userQueryResult.data)) {
            return null;
          }
          const caseItem = caseQueryResult.data.value;
          const { subjectType = 'USER' } = caseItem;
          const isUserSubject = subjectType === 'USER';

          if (!isUserSubject) {
            return null;
          }

          return {
            title: 'Ontology',
            key: tab,
            children: (
              <Linking
                userId={caseUserId}
                scope={linkingState.scope}
                onScopeChange={linkingState.setScope}
                entityNodes={linkingState.entityNodes}
                entityEdges={linkingState.entityEdges}
                txnNodes={linkingState.txnNodes}
                txnEdges={linkingState.txnEdges}
                followed={linkingState.followed}
                onFollow={handleFollow}
                entityFilters={linkingState.entityFilters}
                setEntityFilters={linkingState.setEntityFilters}
                txnFilters={linkingState.txnFilters}
                setTxnFilters={linkingState.setTxnFilters}
              />
            ),
            captureEvents: true,
          };
        }
        if (tab === AlertTabs.TRANSACTION_INSIGHTS) {
          return {
            title: 'Transaction insights',
            key: tab,
            children: <InsightsCard userId={caseUserId} />,
            captureEvents: true,
          };
        }
        if (tab === AlertTabs.EXPECTED_TRANSACTION_LIMITS) {
          return {
            title: 'Expected transaction limits',
            key: tab,
            children: (
              <AsyncResourceRenderer resource={userQueryResult.data}>
                {(user) => (
                  <Card.Root>
                    <ExpectedTransactionLimits user={user} />
                  </Card.Root>
                )}
              </AsyncResourceRenderer>
            ),
            isClosable: false,
            isDisabled: false,
          };
        }
        if (tab === AlertTabs.CRM) {
          if (!isCrmEnabled || !settings.crmIntegrationName) {
            return null;
          }
          return {
            title: humanizeAuto(settings.crmIntegrationName),
            key: tab,
            children: caseUserId ? (
              isFreshDeskCrmEnabled ? (
                <CRMRecords userId={caseUserId} />
              ) : (
                <CRMDataComponent userId={caseUserId} />
              )
            ) : undefined,
            isClosable: false,
            isDisabled: false,
            Icon: settings.crmIntegrationName
              ? React.createElement(
                  CRM_ICON_MAP[settings.crmIntegrationName as keyof typeof CRM_ICON_MAP],
                )
              : null,
            TrailIcon: (
              <Tooltip title="Connected">
                <div className={styles.connected} />
              </Tooltip>
            ),
          };
        }
        return null;
      })
      .filter(notEmpty);
  }, [
    transactionSelectionActions,
    tabList,
    caseUserId,
    openHitsCount,
    openHitsQueryResults,
    selectedSanctionsHitsIds,
    onSanctionsHitSelect,
    openTableParams,
    onSanctionsHitsChangeStatus,
    clearedHitsCount,
    clearedHitsQueryResults,
    clearedTableParams,
    alert,
    selectedTransactionIds,
    onTransactionSelect,
    escalatedTransactionIds,
    caseQueryResult.data,
    userQueryResult.data,
    isEntityLinkingEnabled,
    selectionInfo,
    selectionActions,
    fitTablesHeight,
    sanctionsDetailsFilter,
    handleFollow,
    linkingState,
    isAiForensicsEnabled,
    isClickhouseEnabled,
    settings.userAlias,
    isCrmEnabled,
    settings.crmIntegrationName,
    isFreshDeskCrmEnabled,
  ]);

  return tabs;
}
