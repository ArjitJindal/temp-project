import React, { useMemo, useState } from 'react';
import { SanctionsDetails, SanctionsHit } from '@/apis';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { success } from '@/utils/asyncResource';
import Checklist from '@/pages/case-management/AlertTable/ExpandedRowRenderer/AlertExpanded/Checklist';
import Comments from '@/pages/case-management/AlertTable/ExpandedRowRenderer/AlertExpanded/Comments';
import TransactionsTab from '@/pages/case-management/AlertTable/ExpandedRowRenderer/AlertExpanded/TransactionsTab';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { notEmpty } from '@/utils/array';
import { QueryResult } from '@/utils/queries/types';
import { useApi } from '@/api';
import { useCursorQuery, CursorPaginatedData } from '@/utils/queries/hooks';
import { SANCTIONS_HITS_SEARCH } from '@/utils/queries/keys';
import SanctionsTable, { TableSearchParams } from '@/components/SanctionsTable';
import { message } from '@/components/library/Message';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';

interface Props {
  details: SanctionsDetails[];
  alert?: TableAlertItem;
  escalatedTransactionIds?: string[];
  selectedTransactionIds?: string[];
  onTransactionSelect?: (alertId: string, transactionIds: string[]) => void;
  selectedSanctionsHitsIds?: string[];
  onSanctionsHitSelect?: (alertId: string, sanctionsHitsIds: string[]) => void;
}

export default function ScreeningMatchList(props: Props) {
  const {
    details,
    alert,
    selectedSanctionsHitsIds,
    onSanctionsHitSelect,
    escalatedTransactionIds,
    selectedTransactionIds,
    onTransactionSelect,
  } = props;

  const [tableParams, setTableParams] =
    useState<AllParams<TableSearchParams>>(DEFAULT_PARAMS_STATE);
  const hitsQueryResults = useSanctionHitsQuery(details, tableParams);

  const tabs: TabItem[] = useMemo(
    () => [
      {
        title: 'Match list',
        key: 'match_list',
        children: (
          <SanctionsTable
            tableRef={null}
            queryResult={hitsQueryResults}
            isEmbedded={true}
            selectedIds={selectedSanctionsHitsIds}
            selection={true}
            params={tableParams}
            onChangeParams={setTableParams}
            onSelect={(sanctionHitsIds) => {
              if (!alert?.alertId) {
                message.fatal('Unable to select transactions, alert id is empty');
                return;
              }
              onSanctionsHitSelect?.(alert.alertId, sanctionHitsIds);
            }}
          />
        ),
      },
      ...(alert != null && alert.alertId != null
        ? [
            alert.ruleChecklistTemplateId && {
              title: 'Checklist',
              key: 'checklist',
              children: <Checklist alert={alert} />,
            },
            {
              title: 'Comments',
              key: 'comments',
              children: <Comments alertsRes={success(alert)} alertId={alert.alertId} />,
            },
            alert.numberOfTransactionsHit > 0 && {
              title: 'Transactions details',
              key: 'transactions',
              children: (
                <TransactionsTab
                  alert={alert}
                  selectedTransactionIds={selectedTransactionIds}
                  onTransactionSelect={onTransactionSelect}
                  escalatedTransactionIds={escalatedTransactionIds}
                />
              ),
            },
          ].filter(notEmpty)
        : []),
    ],
    [
      hitsQueryResults,
      alert,
      tableParams,
      selectedSanctionsHitsIds,
      onSanctionsHitSelect,
      selectedTransactionIds,
      onTransactionSelect,
      escalatedTransactionIds,
    ],
  );

  return (
    <>
      <Tabs type="line" items={tabs} />
    </>
  );
}

/*
  Helpers
 */
function useSanctionHitsQuery(
  sanctionDetails: SanctionsDetails[],
  params: AllParams<TableSearchParams>,
): QueryResult<CursorPaginatedData<SanctionsHit>> {
  const api = useApi();
  const searchIds = sanctionDetails.map((sanctionsDetails) => sanctionsDetails.searchId);
  const filters = {
    filterSearchId: searchIds,
    filterStatus: ['OPEN' as const],
  };
  return useCursorQuery(
    SANCTIONS_HITS_SEARCH({ ...filters, ...params }),
    async (paginationParams) => {
      const request = {
        ...filters,
        ...params,
        ...paginationParams,
      };
      return await api.searchSanctionsHits({
        ...request,
        start: request.from,
      });
    },
  );
}
