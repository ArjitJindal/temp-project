import React, { useMemo } from 'react';
import { firstLetterUpper, humanizeAuto } from '@flagright/lib/utils/humanize';
import styles from './index.module.less';
import HitsTab from './HitsTab';
import Checklist from './ChecklistTab';
import TransactionsTab from './TransactionsTab';
import CommentsTab from './CommentsTab';
import ActivityTab from './ActivityTab';
import AiForensicsTab from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/AiForensicsTab';
import { TabItem } from '@/components/library/Tabs';
import { useApi } from '@/api';
import type { CursorPaginatedData } from '@/utils/queries/hooks';
import { AllParams, SelectionAction, SelectionInfo } from '@/components/library/Table/types';
import { isSuccess } from '@/utils/asyncResource';
import { notEmpty } from '@/utils/array';
import {
  Alert,
  SanctionHitStatusUpdateRequest,
  SanctionsDetailsEntityType,
  SanctionsHit,
  SanctionsHitStatus,
  TransactionTableItem,
} from '@/apis';
import { QueryResult } from '@/utils/queries/types';
import { isScreeningAlert } from '@/utils/api/alerts';
import { TransactionsTableParams } from '@/pages/transactions/components/TransactionsTable';
import { useSanctionsHitsSearch } from '@/hooks/api/sanctions';
import { useCase } from '@/hooks/api/cases';
import UserDetails from '@/pages/users-item/UserDetails';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Linking from '@/pages/users-item/UserDetails/Linking';
import {
  useFeatureEnabled,
  useFreshdeskCrmEnabled,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import InsightsCard from '@/pages/case-management-item/CaseDetails/InsightsCard';
import * as Card from '@/components/ui/Card';
import ExpectedTransactionLimits from '@/pages/users-item/UserDetails/shared/TransactionLimits';
import { CRM_ICON_MAP, useConsoleUser } from '@/pages/users-item/UserDetails/utils';

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
  return useSanctionsHitsSearch(params, alertId, enabled);
}

export { useChangeSanctionsHitsStatusMutation } from '@/hooks/api/sanctions';

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
  onSanctionsHitSelect?: (
    alertId: string,
    sanctionsHitsIds: string[],
    statuses: SanctionsHitStatus,
  ) => void;
  onSanctionsHitsChangeStatus?: (sanctionsHitsIds: string[], newStatus: SanctionsHitStatus) => void;
  transactionSelectionActions?: SelectionAction<TransactionTableItem, TransactionsTableParams>[];
  isEmbedded?: boolean;
  selectionInfo?: SelectionInfo;
  selectionActions?: SelectionAction<SanctionsHit, SanctionsHitsTableParams>[];
  fitTables?: boolean;
}

export function useAlertTabs(props: Props): TabItem[] {
  const {
    alert,
    isEmbedded = false,
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
    fitTables,
  } = props;

  const tabList = isScreeningAlert(alert) ? SCREENING_ALERT_TAB_LISTS : DEFAULT_TAB_LISTS;

  const _api = useApi();
  const settings = useSettings();
  const isCrmEnabled = useFeatureEnabled('CRM');
  const isFreshDeskCrmEnabled = useFreshdeskCrmEnabled();
  const isEntityLinkingEnabled = useFeatureEnabled('ENTITY_LINKING');
  const isAiForensicsEnabled = useFeatureEnabled('AI_FORENSICS');
  const isClickhouseEnabled = useFeatureEnabled('CLICKHOUSE_ENABLED');

  const caseQueryResult = useCase(alert.caseId ?? '', { enabled: !!alert.caseId });
  const userQueryResult = useConsoleUser(caseUserId);

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
                fitHeight={fitTables}
                alert={alert}
                caseUserId={caseUserId}
                selectedTransactionIds={selectedTransactionIds}
                onTransactionSelect={onTransactionSelect}
                escalatedTransactionIds={escalatedTransactionIds}
                selectionActions={transactionSelectionActions}
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
            title: 'Human review',
            key: tab,
            children: (
              <HitsTab
                alert={alert}
                status="OPEN"
                selectedSanctionsHitsIds={selectedSanctionsHitsIds}
                onSanctionsHitSelect={(sanctionsHitsIds) => {
                  if (!alert?.alertId) {
                    return;
                  }
                  onSanctionsHitSelect?.(alert.alertId, sanctionsHitsIds, 'OPEN');
                }}
                onSanctionsHitsChangeStatus={onSanctionsHitsChangeStatus}
                selectionInfo={selectionInfo}
                selectionActions={selectionActions}
                fitHeight={fitTables}
              />
            ),
          };
        }
        if (tab === AlertTabs.CLEARED_MATCH_LIST) {
          return {
            title: 'Cleared hits',
            key: tab,
            children: (
              <HitsTab
                alert={alert}
                status="CLEARED"
                selectedSanctionsHitsIds={selectedSanctionsHitsIds}
                onSanctionsHitSelect={(sanctionsHitsIds) => {
                  if (!alert?.alertId) {
                    return;
                  }
                  onSanctionsHitSelect?.(alert.alertId, sanctionsHitsIds, 'CLEARED');
                }}
                onSanctionsHitsChangeStatus={onSanctionsHitsChangeStatus}
                selectionInfo={selectionInfo}
                selectionActions={selectionActions}
                fitHeight={fitTables}
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
            children: <Linking userId={caseUserId} />,
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
          if (!isCrmEnabled || !settings.crmIntegrationName || isEmbedded) {
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
                  { className: styles.crmIcon },
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
    selectedSanctionsHitsIds,
    onSanctionsHitSelect,
    onSanctionsHitsChangeStatus,
    alert,
    selectedTransactionIds,
    onTransactionSelect,
    escalatedTransactionIds,
    caseQueryResult.data,
    userQueryResult.data,
    isEntityLinkingEnabled,
    selectionInfo,
    selectionActions,
    fitTables,
    isAiForensicsEnabled,
    isClickhouseEnabled,
    settings.userAlias,
    isCrmEnabled,
    settings.crmIntegrationName,
    isFreshDeskCrmEnabled,
    isEmbedded,
  ]);

  return tabs;
}
