import AlertDetailsTabs from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { SanctionsHitStatus } from '@/apis';

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
  return <AlertDetailsTabs {...props} caseUserId={props.alert.caseUserId} />;
}
