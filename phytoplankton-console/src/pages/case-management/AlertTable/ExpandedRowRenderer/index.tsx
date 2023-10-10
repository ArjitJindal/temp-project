import React from 'react';
import { TableAlertItem } from '../types';
import AlertExpanded from './AlertExpanded';
import ScreeningMatchList from '@/components/ScreeningMatchList';

interface Props {
  alert: TableAlertItem;
  escalatedTransactionIds?: string[];
  selectedTransactionIds?: string[];
  onTransactionSelect?: (alertId: string, transactionIds: string[]) => void;
}

export default function ExpandedRowRenderer(props: Props) {
  const { alert, selectedTransactionIds, onTransactionSelect, escalatedTransactionIds } = props;

  if (alert.ruleNature === 'SCREENING' && alert.ruleHitMeta?.sanctionsDetails && alert.alertId) {
    return <ScreeningMatchList details={alert.ruleHitMeta?.sanctionsDetails ?? []} alert={alert} />;
  }

  return (
    <AlertExpanded
      alert={alert}
      selectedTransactionIds={selectedTransactionIds}
      onTransactionSelect={onTransactionSelect}
      escalatedTransactionIds={escalatedTransactionIds}
    />
  );
}
