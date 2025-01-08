import React, { useState } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { SanctionsDetails, SanctionsHitStatus } from '@/apis';
import {
  AlertTabs,
  useAlertTabs,
} from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/helpers';
import Tabs from '@/components/library/Tabs';
import Select from '@/components/library/Select';

interface Props {
  alert: TableAlertItem;
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

export default function ExpandedRowRenderer(props: Props) {
  const {
    alert,
    selectedTransactionIds,
    selectedSanctionsHitsIds,
    onTransactionSelect,
    onSanctionsHitSelect,
    escalatedTransactionIds,
    onSanctionsHitsChangeStatus,
  } = props;

  const sanctionDetails = alert.ruleHitMeta?.sanctionsDetails ?? [];
  const [sanctionsDetailsId, setSanctionsDetailsId] = useState<string | undefined>(
    sanctionDetails[0]?.searchId,
  );

  const tabItems = useAlertTabs({
    alert: alert,
    caseUserId: alert.caseUserId,
    selectedTransactionIds: selectedTransactionIds,
    onTransactionSelect: onTransactionSelect,
    escalatedTransactionIds: escalatedTransactionIds,
    selectedSanctionsHitsIds: selectedSanctionsHitsIds,
    sanctionsSearchIdFilter: sanctionsDetailsId,
    onSanctionsHitSelect: onSanctionsHitSelect,
    onSanctionsHitsChangeStatus: onSanctionsHitsChangeStatus,
  });

  return (
    <Tabs
      items={tabItems.filter(({ key }) => key !== AlertTabs.ACTIVITY)}
      type="line"
      defaultActiveKey={AlertTabs.TRANSACTIONS}
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
