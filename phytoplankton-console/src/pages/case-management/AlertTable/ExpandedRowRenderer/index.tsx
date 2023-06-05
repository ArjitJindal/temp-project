import React from 'react';
import { TableAlertItem } from '../types';
import TransactionsAndComments from './TransactionsAndComments';
import ScreeningMatchList from './ScreeningMatchList';

interface Props {
  alert: TableAlertItem;
  escalatedTransactionIds?: string[];
  selectedTransactionIds: string[];
  onTransactionSelect: (alertId: string, transactionIds: string[]) => void;
}

export default function ExpandedRowRenderer(props: Props) {
  const { alert, selectedTransactionIds, onTransactionSelect, escalatedTransactionIds } = props;

  if (alert.ruleHitMeta?.sanctionsDetails) {
    return <ScreeningMatchList alert={alert} />;
  }

  return (
    <TransactionsAndComments
      alert={alert}
      selectedTransactionIds={selectedTransactionIds}
      onTransactionSelect={onTransactionSelect}
      escalatedTransactionIds={escalatedTransactionIds}
    />
  );
}
