import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { SanctionsHitStatus } from '@/apis';
import {
  AlertTabs,
  TABS_TO_HIDE_IN_TABLE,
  useAlertTabs,
} from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/helpers';
import Tabs from '@/components/library/Tabs';
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
  return (
    <Tabs
      items={tabItems.filter(({ key }) => !TABS_TO_HIDE_IN_TABLE.some((x) => x === key))}
      type="line"
      defaultActiveKey={AlertTabs.TRANSACTIONS}
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
