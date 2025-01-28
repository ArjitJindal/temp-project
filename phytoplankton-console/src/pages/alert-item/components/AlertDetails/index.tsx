import React, { useState } from 'react';
import AlertDetailsTabs from './AlertDetailsTabs';
import { Alert, Case } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { CASES_ITEM } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useApi } from '@/api';

interface Props {
  alertItem: Alert;
  headerStickyElRef: HTMLDivElement | null;
}

function AlertDetails(props: Props) {
  const { alertItem, headerStickyElRef } = props;

  const api = useApi();

  const { caseId } = alertItem;
  const caseQueryResults = useQuery(CASES_ITEM(caseId ?? ''), (): Promise<Case> => {
    if (caseId == null) {
      throw new Error(`Alert case id could not be empty`);
    }
    return api.getCase({ caseId });
  });

  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);

  return (
    <AsyncResourceRenderer resource={caseQueryResults.data}>
      {(caseItem) => (
        <AlertDetailsTabs
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
        />
      )}
    </AsyncResourceRenderer>
  );
}

export default AlertDetails;
