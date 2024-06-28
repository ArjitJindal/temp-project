import React, { useMemo, useState } from 'react';
import { SanctionsDetails, SanctionsHit, SanctionsHitStatus } from '@/apis';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { success, getOr, map } from '@/utils/asyncResource';
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

const MATCH_LIST_TAB_KEY = 'match_list';
const CLEARED_MATCH_LIST_TAB_KEY = 'cleared_match_list';
const CHECKLIST_TAB_KEY = 'checklist';
const COMMENTS_TAB_KEY = 'comments';
const TRANSACTIONS_TAB_KEY = 'transactions';

interface Props {
  details: SanctionsDetails[];
  alert?: TableAlertItem;
  escalatedTransactionIds?: string[];
  selectedTransactionIds?: string[];
  onTransactionSelect?: (alertId: string, transactionIds: string[]) => void;
  selectedSanctionsHitsIds?: string[];
  onSanctionsHitSelect?: (
    alertId: string,
    sanctionsHitsIds: string[],
    statuses: SanctionsHitStatus,
  ) => void;
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

  const [tableParams, setTableParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    statuses: ['OPEN'],
  });
  const [clearedTableParams, setClearedTableParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    statuses: ['CLEARED'],
  });

  const hitsQueryResults = useSanctionHitsQuery(details, tableParams);
  const clearedHitsQueryResults = useSanctionHitsQuery(details, clearedTableParams);

  const hitsCount = getOr(
    map(hitsQueryResults.data, (x) => x.count),
    null,
  );
  const clearedHitsCount = getOr(
    map(clearedHitsQueryResults.data, (x) => x.count),
    null,
  );

  const tabs: TabItem[] = useMemo(
    () =>
      [
        {
          title: 'Cleared hits' + (clearedHitsCount != null ? ` (${clearedHitsCount})` : ''),
          key: CLEARED_MATCH_LIST_TAB_KEY,
          children: (
            <SanctionsTable
              tableRef={null}
              queryResult={clearedHitsQueryResults}
              isEmbedded={true}
              selection={true}
              params={clearedTableParams}
              onChangeParams={setClearedTableParams}
              selectedIds={selectedSanctionsHitsIds}
              onSelect={(sanctionHitsIds) => {
                if (!alert?.alertId) {
                  message.fatal('Unable to select transactions, alert id is empty');
                  return;
                }
                onSanctionsHitSelect?.(alert.alertId, sanctionHitsIds, 'CLEARED');
              }}
            />
          ),
        },
        {
          title: 'Human review' + (hitsCount != null ? ` (${hitsCount})` : ''),
          key: MATCH_LIST_TAB_KEY,
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
                onSanctionsHitSelect?.(alert.alertId, sanctionHitsIds, 'OPEN');
              }}
            />
          ),
        },
        ...(alert != null && alert.alertId != null
          ? [
              alert.ruleChecklistTemplateId && {
                title: 'Checklist',
                key: CHECKLIST_TAB_KEY,
                children: <Checklist alert={alert} />,
              },
              {
                title: 'Comments',
                key: COMMENTS_TAB_KEY,
                children: <Comments alertsRes={success(alert)} alertId={alert.alertId} />,
              },
              alert.numberOfTransactionsHit > 0 && {
                title: 'Transactions details',
                key: TRANSACTIONS_TAB_KEY,
                children: (
                  <TransactionsTab
                    alert={alert}
                    selectedTransactionIds={selectedTransactionIds}
                    onTransactionSelect={onTransactionSelect}
                    escalatedTransactionIds={escalatedTransactionIds}
                  />
                ),
              },
            ]
          : []),
      ].filter(notEmpty),
    [
      hitsQueryResults,
      alert,
      tableParams,
      clearedTableParams,
      setClearedTableParams,
      clearedHitsQueryResults,
      selectedSanctionsHitsIds,
      onSanctionsHitSelect,
      hitsCount,
      clearedHitsCount,
      selectedTransactionIds,
      onTransactionSelect,
      escalatedTransactionIds,
    ],
  );

  const [activeTabKey, setActiveTabKey] = useState(tabs[0].key);

  return (
    <>
      <Tabs
        type="line"
        items={tabs}
        activeKey={tabs.some((x) => x.key === activeTabKey) ? activeTabKey : tabs[0].key}
        onChange={(key) => {
          setActiveTabKey(key);
          if (!alert?.alertId) {
            message.fatal('Unable to select hits, alert id is empty');
            return;
          }
          onSanctionsHitSelect?.(
            alert.alertId,
            [],
            key === MATCH_LIST_TAB_KEY ? 'OPEN' : 'CLEARED',
          );
        }}
      />
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
    filterStatus: params.statuses ?? ['OPEN' as const],
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
