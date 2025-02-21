import React, { useMemo, useState } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { useNavigate, useParams } from 'react-router';
import { Alert, SanctionsDetails, SanctionsHit, SanctionsHitStatus } from '@/apis';
import {
  AlertTabs,
  SanctionsHitsTableParams,
  useAlertTabs,
} from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/helpers';
import Select from '@/components/library/Select';
import PageTabs from '@/components/ui/PageTabs';
import { keepBackUrl } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import { useElementSize } from '@/utils/browser';
import { isScreeningAlert } from '@/utils/api/alerts';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';
import { statusEscalated, statusInReview } from '@/utils/case-utils';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { notEmpty } from '@/utils/array';
import { SelectionAction, SelectionInfo } from '@/components/library/Table/types';

interface Props {
  headerStickyElRef: HTMLDivElement | null;
  alert: Alert;
  caseUserId: string;
  escalatedTransactionIds?: string[];
  selectedTransactionIds?: string[];
  selectedSanctionsHitsIds?: string[];
  onTransactionSelect?: (alertId: string, transactionIds: string[]) => void;
  onSanctionsHitSelect?: (
    alertId: string,
    sanctionsHitsIds: string[],
    status: SanctionsHitStatus,
  ) => void;
  onSanctionsHitsChangeStatus?: (sanctionsHitsIds: string[], newStatus: SanctionsHitStatus) => void;
  selectionInfo: SelectionInfo;
  selectionActions: SelectionAction<SanctionsHit, SanctionsHitsTableParams>[];
}

export default function AlertDetailsTabs(props: Props) {
  const {
    headerStickyElRef,
    alert,
    caseUserId,
    selectedTransactionIds,
    selectedSanctionsHitsIds,
    onTransactionSelect,
    onSanctionsHitSelect,
    escalatedTransactionIds,
    onSanctionsHitsChangeStatus,
    selectionInfo,
    selectionActions,
  } = props;

  const { tab } = useParams<'tab'>() as { tab: string };
  const navigate = useNavigate();

  const rect = useElementSize(headerStickyElRef);
  const entityHeaderHeight = rect?.height ?? 0;

  const sanctionDetails = alert.ruleHitMeta?.sanctionsDetails ?? [];
  const [sanctionsDetailsId, setSanctionsDetailsId] = useState<string | undefined>(
    sanctionDetails[0]?.searchId,
  );
  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');

  const isCaseHavingEscalated = statusEscalated(alert.alertStatus);
  const isReviewAlerts = statusInReview(alert.alertStatus);

  const transactionSelectionActions = [
    !(isCaseHavingEscalated || isReviewAlerts) &&
      (({ selectedIds, isDisabled }) => {
        const alertId = alert.alertId;
        if (alertId == null) {
          return;
        }
        const caseId = alert.caseId;
        if (
          !escalationEnabled ||
          !caseId ||
          !alert.alertStatus ||
          isReviewAlerts ||
          isCaseHavingEscalated
        ) {
          return;
        }
        return (
          <AlertsStatusChangeButton
            ids={[alertId]}
            transactionIds={{
              [alertId]: selectedIds,
            }}
            onSaved={() => {
              navigate(makeUrl('/case-management/case/:id', { id: caseId }), { replace: true });
            }}
            status={alert.alertStatus}
            caseId={caseId}
            statusTransitions={{
              OPEN: { status: 'ESCALATED', actionLabel: 'Escalate' },
              REOPENED: { status: 'ESCALATED', actionLabel: 'Escalate' },
              CLOSED: { status: 'ESCALATED', actionLabel: 'Escalate' },
              OPEN_IN_PROGRESS: { status: 'ESCALATED', actionLabel: 'Escalate' },
              OPEN_ON_HOLD: { status: 'ESCALATED', actionLabel: 'Escalate' },
            }}
            isDisabled={isDisabled}
            haveModal={true}
          />
        );
      }),
  ].filter(notEmpty);

  const isTransactionSelectionEnabled = transactionSelectionActions.length > 0;

  const tabItems = useAlertTabs({
    alert: alert,
    caseUserId: caseUserId,
    selectedTransactionIds: selectedTransactionIds,
    onTransactionSelect: isTransactionSelectionEnabled ? onTransactionSelect : undefined,
    escalatedTransactionIds: escalatedTransactionIds,
    selectedSanctionsHitsIds: selectedSanctionsHitsIds,
    sanctionsSearchIdFilter: sanctionsDetailsId,
    onSanctionsHitSelect: onSanctionsHitSelect,
    onSanctionsHitsChangeStatus: onSanctionsHitsChangeStatus,
    transactionSelectionActions: transactionSelectionActions,
    selectionInfo: selectionInfo,
    selectionActions: selectionActions,
    fitTablesHeight: true,
  });

  const filteredTabItems = useMemo(() => {
    return tabItems.filter(({ key }) => key !== AlertTabs.COMMENTS);
  }, [tabItems]);

  return (
    <PageTabs
      sticky={entityHeaderHeight}
      items={filteredTabItems}
      type="line"
      activeKey={tab}
      onChange={(newTab) => {
        navigate(
          keepBackUrl(
            makeUrl('/case-management/alerts/:id/:tab', { id: alert.alertId, tab: newTab }),
          ),
          { replace: true },
        );
      }}
      tabBarExtraContent={
        isScreeningAlert(alert) && (
          <Select
            value={sanctionsDetailsId}
            isDisabled={sanctionDetails.length < 2}
            options={sanctionDetails.map((detailsItem) => ({
              label: getOptionName(detailsItem),
              value: detailsItem.searchId,
            }))}
            onChange={setSanctionsDetailsId}
            allowClear={false}
          />
        )
      }
    />
  );
}

/*
  Helpers
 */

function getOptionName(details: SanctionsDetails) {
  let result = details.name;
  if (details.iban) {
    result += ` (IBAN: ${details.iban})`;
  }
  if (details.entityType) {
    result += ` (${humanizeConstant(details.entityType)})`;
  }
  return result;
}
