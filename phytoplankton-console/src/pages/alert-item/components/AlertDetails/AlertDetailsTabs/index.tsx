import React from 'react';
import DefaultAlertTabs from './DefaultAlertTabs';
import ScreeningMatchList from '@/components/ScreeningMatchList';
import { Alert, SanctionsHitStatus } from '@/apis';

interface Props {
  alert: Alert;
  caseUserId: string;
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

export default function AlertDetailsTabs(props: Props) {
  const {
    alert,
    caseUserId,
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
        alert={alert}
        caseUserId={caseUserId}
        selectedTransactionIds={selectedTransactionIds}
        onTransactionSelect={onTransactionSelect}
        details={alert.ruleHitMeta?.sanctionsDetails ?? []}
        escalatedTransactionIds={escalatedTransactionIds}
        selectedSanctionsHitsIds={selectedSanctionsHitsIds}
        onSanctionsHitSelect={onSanctionsHitSelect}
        onSanctionsHitsChangeStatus={onSanctionsHitsChangeStatus}
      />
    );
  }

  return (
    <DefaultAlertTabs
      alert={alert}
      caseUserId={caseUserId}
      selectedTransactionIds={selectedTransactionIds}
      onTransactionSelect={onTransactionSelect}
      escalatedTransactionIds={escalatedTransactionIds}
    />
  );
}
