import React, { useState } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { useNavigate, useParams } from 'react-router';
import { Alert, SanctionsDetails, SanctionsHitStatus } from '@/apis';
import {
  AlertTabs,
  useAlertTabs,
} from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/helpers';
import Select from '@/components/library/Select';
import PageTabs from '@/components/ui/PageTabs';
import { keepBackUrl } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import { useElementSize } from '@/utils/browser';

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
  } = props;

  const { tab } = useParams<'tab'>() as { tab: string };
  const navigate = useNavigate();

  const rect = useElementSize(headerStickyElRef);
  const entityHeaderHeight = rect?.height ?? 0;

  const sanctionDetails = alert.ruleHitMeta?.sanctionsDetails ?? [];
  const [sanctionsDetailsId, setSanctionsDetailsId] = useState<string | undefined>(
    sanctionDetails[0]?.searchId,
  );

  const tabItems = useAlertTabs({
    alert: alert,
    caseUserId: caseUserId,
    selectedTransactionIds: selectedTransactionIds,
    onTransactionSelect: onTransactionSelect,
    escalatedTransactionIds: escalatedTransactionIds,
    selectedSanctionsHitsIds: selectedSanctionsHitsIds,
    sanctionsSearchIdFilter: sanctionsDetailsId,
    onSanctionsHitSelect: onSanctionsHitSelect,
    onSanctionsHitsChangeStatus: onSanctionsHitsChangeStatus,
  });

  return (
    <PageTabs
      sticky={entityHeaderHeight}
      items={tabItems.filter(({ key }) => key !== AlertTabs.COMMENTS)}
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
      // defaultActiveKey={AlertTabs.TRANSACTIONS}
      tabBarExtraContent={
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
