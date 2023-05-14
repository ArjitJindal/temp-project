import { TableAlertItem } from '../types';
import TransactionsAndComments from './TransactionsAndComments';
import ScreeningMatchList from './ScreeningMatchList';

interface Props {
  alert: TableAlertItem;
  escalatedTransactionIds?: string[];
  onTransactionSelect: (alertId: string, transactionIds: string[]) => void;
}

export default function ExpandedRowRenderer(props: Props) {
  const { alert, onTransactionSelect, escalatedTransactionIds } = props;

  if (alert.ruleHitMeta?.sanctionsDetails) {
    return <ScreeningMatchList alert={alert} />;
  }

  return (
    <TransactionsAndComments
      alert={alert}
      onTransactionSelect={onTransactionSelect}
      escalatedTransactionIds={escalatedTransactionIds}
    />
  );
}
