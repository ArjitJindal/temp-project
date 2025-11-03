import { useEffect } from 'react';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { SanctionsHitStatus } from '@/apis';
import {
  AlertTabs,
  TABS_TO_HIDE_IN_TABLE,
  useAlertTabs,
} from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/helpers';
import Tabs from '@/components/library/Tabs';
import { useAlertUpdates, isScreeningAlert } from '@/utils/api/alerts';

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

  const tabItems = useAlertTabs({
    alert: alert,
    isEmbedded: isEmbedded,
    caseUserId: alert.caseUserId,
    selectedTransactionIds: selectedTransactionIds,
    onTransactionSelect: onTransactionSelect,
    escalatedTransactionIds: escalatedTransactionIds,
    selectedSanctionsHitsIds: selectedSanctionsHitsIds,
    onSanctionsHitSelect: onSanctionsHitSelect,
    onSanctionsHitsChangeStatus: onSanctionsHitsChangeStatus,
  });

  const defaultActiveKey = isScreeningAlert(alert) ? AlertTabs.MATCH_LIST : AlertTabs.TRANSACTIONS;

  return (
    <Tabs
      items={tabItems.filter(({ key }) => !TABS_TO_HIDE_IN_TABLE.some((x) => x === key))}
      type="line"
      defaultActiveKey={defaultActiveKey}
    />
  );
}

// Wrap alert item into Query to make cache invalidation by alert id works
export default function (props: Props) {
  const { alert } = props;
  const { updateAlertQueryData } = useAlertUpdates();

  useEffect(() => {
    updateAlertQueryData(alert.alertId, (alert) => alert);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert.alertId]);

  return <ExpandedRowRenderer {...props} />;
}
