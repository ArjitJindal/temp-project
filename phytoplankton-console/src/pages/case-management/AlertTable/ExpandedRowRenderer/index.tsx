import React, { useState } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { SanctionsDetails, SanctionsHitStatus } from '@/apis';
import {
  AlertTabs,
  TABS_TO_HIDE_IN_TABLE,
  useAlertTabs,
} from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/helpers';
import Tabs from '@/components/library/Tabs';
import Select from '@/components/library/Select';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

interface Props {
  alert: TableAlertItem;
  isEmbedded: boolean;
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
    isEmbedded,
    selectedTransactionIds,
    selectedSanctionsHitsIds,
    onTransactionSelect,
    onSanctionsHitSelect,
    escalatedTransactionIds,
    onSanctionsHitsChangeStatus,
  } = props;

  const sanctionDetails = alert.ruleHitMeta?.sanctionsDetails ?? [];

  const [selectedItem, setSelectedItem] = useState<SanctionsDetails | undefined>(
    sanctionDetails[0],
  );

  const tabItems = useAlertTabs({
    alert: alert,
    isEmbedded: isEmbedded,
    caseUserId: alert.caseUserId,
    selectedTransactionIds: selectedTransactionIds,
    onTransactionSelect: onTransactionSelect,
    escalatedTransactionIds: escalatedTransactionIds,
    selectedSanctionsHitsIds: selectedSanctionsHitsIds,
    sanctionsSearchIdFilter: selectedItem?.searchId,
    entityTypeFilter: selectedItem?.entityType,
    paymentMethodIdFilter: selectedItem?.hitContext?.paymentMethodId,
    onSanctionsHitSelect: onSanctionsHitSelect,
    onSanctionsHitsChangeStatus: onSanctionsHitsChangeStatus,
    sanctionsDetailsFilter: selectedItem,
  });
  return (
    <Tabs
      items={tabItems.filter(({ key }) => !TABS_TO_HIDE_IN_TABLE.some((x) => x === key))}
      type="line"
      defaultActiveKey={AlertTabs.TRANSACTIONS}
      tabBarExtraContent={
        <Select
          value={
            (selectedItem?.hitContext?.paymentMethodId ?? selectedItem?.searchId) +
            ' ' +
            selectedItem?.entityType +
            ' ' +
            selectedItem?.searchId
          }
          isDisabled={sanctionDetails.length < 2}
          options={sanctionDetails.reduce((acc, detailsItem) => {
            const paymentMethodId = detailsItem.hitContext?.paymentMethodId;
            if (!paymentMethodId || !acc.some((item) => item.value.startsWith(paymentMethodId))) {
              acc.push({
                label: getOptionName(detailsItem),
                value:
                  (paymentMethodId ?? detailsItem.searchId) +
                  ' ' +
                  detailsItem.entityType +
                  ' ' +
                  detailsItem.searchId,
              });
            }
            return acc;
          }, [] as { label: string; value: string }[])}
          onChange={(value) => {
            const selectedItem = sanctionDetails.find((item) => {
              if (
                item.hitContext?.paymentMethodId === value?.split(' ')[0] &&
                item.entityType === value?.split(' ')[1] &&
                item.searchId === value?.split(' ')[2]
              ) {
                return true;
              }
              if (
                item.searchId === value?.split(' ')[0] &&
                !item.hitContext?.paymentMethodId &&
                item.entityType === value?.split(' ')[1] &&
                item.searchId === value?.split(' ')[2]
              ) {
                return true;
              }
              return false;
            });
            setSelectedItem(selectedItem);
          }}
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
  return (
    result +
    (details.hitContext?.paymentMethodId ? ` (${details.hitContext?.paymentMethodId})` : '')
  );
}
