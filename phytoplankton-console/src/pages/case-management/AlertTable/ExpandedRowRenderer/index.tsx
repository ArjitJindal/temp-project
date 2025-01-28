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
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

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

function ExpandedRowRenderer(props: Props) {
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
      items={tabItems.filter(
        ({ key }) => key !== AlertTabs.ACTIVITY && key !== AlertTabs.AI_FORENSICS,
      )}
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

// Wrap alert item into Query to make cache invalidation by alert id works
export default function (props: Props) {
  const { alert, ...rest } = props;
  const alertQueryResult = useQuery(ALERT_ITEM(alert?.alertId ?? ''), () => {
    return Promise.resolve(alert);
  });

  return (
    <AsyncResourceRenderer resource={alertQueryResult.data}>
      {(alert) => <ExpandedRowRenderer alert={alert} {...rest} />}
    </AsyncResourceRenderer>
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
