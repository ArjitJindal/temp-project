import React from 'react';
import { TableAlertItem } from '../types';
import AlertExpanded from './AlertExpanded';
import ScreeningMatchList from '@/components/ScreeningMatchList';
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
  const {
    alert,
    selectedTransactionIds,
    selectedSanctionsHitsIds,
    onTransactionSelect,
    onSanctionsHitSelect,
    escalatedTransactionIds,
    onSanctionsHitsChangeStatus,
  } = props;

  if (alert.ruleNature === 'SCREENING' && alert.ruleHitMeta?.sanctionsDetails && alert.alertId) {
    return (
      <ScreeningMatchList
        details={alert.ruleHitMeta?.sanctionsDetails ?? []}
        alert={alert}
        selectedSanctionsHitsIds={selectedSanctionsHitsIds}
        onSanctionsHitSelect={onSanctionsHitSelect}
        selectedTransactionIds={selectedTransactionIds}
        onTransactionSelect={onTransactionSelect}
        escalatedTransactionIds={escalatedTransactionIds}
        onSanctionsHitsChangeStatus={onSanctionsHitsChangeStatus}
      />
    );
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
