import React, { useMemo, useState } from 'react';
import AlertDetailsTabs from './AlertDetailsTabs';
import {
  updateSanctionsData,
  useChangeSanctionsHitsStatusMutation,
} from './AlertDetailsTabs/helpers';
import { Alert, SanctionsHitStatus } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

import { notEmpty } from '@/utils/array';
import SanctionsHitStatusChangeModal from '@/pages/case-management/AlertTable/SanctionsHitStatusChangeModal';
import { adaptMutationVariables } from '@/utils/queries/mutations/helpers';
import Button from '@/components/library/Button';
import { useCaseDetails } from '@/utils/api/cases';

interface Props {
  alertItem: Alert;
  headerStickyElRef: HTMLDivElement | null;
}

function AlertDetails(props: Props) {
  const { alertItem, headerStickyElRef } = props;

  const { caseId } = alertItem;
  const caseQueryResults = useCaseDetails(caseId);
  const { changeHitsStatusMutation } = useChangeSanctionsHitsStatusMutation();
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [selectedSanctionHits, setSelectedSanctionHits] = useState<{
    [alertId: string]: {
      id: string;
      status?: SanctionsHitStatus;
    }[];
  }>({});
  const [isStatusChangeModalVisible, setStatusChangeModalVisible] = useState(false);
  const [statusChangeModalState, setStatusChangeModalState] = useState<SanctionsHitStatus | null>(
    null,
  );
  const resetSelection = () => {
    setSelectedTransactions([]);
    setSelectedSanctionHits({});
  };
  const selectedSanctionHitsIds = useMemo(() => {
    return Object.values(selectedSanctionHits)
      .flatMap((v) => v.map((x) => x.id))
      .filter(notEmpty);
  }, [selectedSanctionHits]);
  const getSelectionInfo = () => {
    const selectedTxns = [
      ...new Set(
        Object.entries(selectedTransactions)
          .filter(([_, txns]) => txns.length > 0)
          .flatMap(([, txns]) => txns),
      ),
    ];
    const selectedSanctionsHits = [
      ...new Set(
        Object.entries(selectedSanctionHits)
          .filter(([_, ids]) => ids.length > 0)
          .flatMap(([, ids]) => ids),
      ),
    ];
    if (selectedTransactions.length > 0) {
      return {
        entityName: 'transaction',
        entityCount: selectedTxns.length,
      };
    }
    if (selectedSanctionsHits.length > 0) {
      return {
        entityName: 'hit',
        entityCount: selectedSanctionsHits.length,
      };
    }
    return {
      entityName: 'item',
      entityCount: 0,
    };
  };
  const selectionActions = [
    ({ isDisabled }) => {
      if (selectedSanctionHitsIds.length === 0) {
        return;
      }

      const selectedHits = Object.values(selectedSanctionHits).flat();
      const isAllOpen = selectedHits.every((hit) => hit.status === 'OPEN');
      const isAllCleared = selectedHits.every((hit) => hit.status === 'CLEARED');

      return (
        <>
          {isAllOpen && (
            <Button
              onClick={() => {
                setStatusChangeModalState('CLEARED');
                setStatusChangeModalVisible(true);
              }}
              isDisabled={isDisabled}
            >
              Clear
            </Button>
          )}
          {isAllCleared && (
            <Button
              onClick={() => {
                setStatusChangeModalState('OPEN');
                setStatusChangeModalVisible(true);
              }}
              isDisabled={isDisabled}
            >
              Re-open
            </Button>
          )}
        </>
      );
    },
  ];
  return (
    <AsyncResourceRenderer resource={caseQueryResults.data}>
      {(caseItem) => (
        <>
          <AlertDetailsTabs
            selectionInfo={getSelectionInfo()}
            alert={alertItem}
            headerStickyElRef={headerStickyElRef}
            caseUserId={
              caseItem.caseUsers?.origin?.userId ?? caseItem.caseUsers?.destination?.userId ?? ''
            }
            selectedTransactionIds={selectedTransactions}
            onTransactionSelect={(_alertId, transactionIds) => {
              setSelectedTransactions(transactionIds);
            }}
            escalatedTransactionIds={caseItem.caseHierarchyDetails?.childTransactionIds ?? []}
            selectedSanctionsHitsIds={selectedSanctionHitsIds}
            onSanctionsHitSelect={(alertId, sanctionsHitsIds, status) => {
              resetSelection();
              setSelectedSanctionHits((prevState) => ({
                ...prevState,
                [alertId]: sanctionsHitsIds.map((id) => ({ id, status })),
              }));
            }}
            onSanctionsHitsChangeStatus={(sanctionsHitsIds, newStatus) => {
              if (alertItem.alertId != null) {
                setSelectedSanctionHits({
                  [alertItem.alertId]: sanctionsHitsIds.map((id) => ({
                    id,
                  })),
                });
                setStatusChangeModalVisible(true);
                setStatusChangeModalState(newStatus);
              }
            }}
            selectionActions={selectionActions}
          />
          <SanctionsHitStatusChangeModal
            entityIds={selectedSanctionHitsIds}
            isVisible={isStatusChangeModalVisible}
            onClose={() => setStatusChangeModalVisible(false)}
            newStatus={statusChangeModalState ?? 'CLEARED'}
            updateMutation={adaptMutationVariables(changeHitsStatusMutation, (formValues) =>
              updateSanctionsData(formValues, selectedSanctionHits),
            )}
          />
        </>
      )}
    </AsyncResourceRenderer>
  );
}

export default AlertDetails;
