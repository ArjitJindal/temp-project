import React, { useMemo, useState } from 'react';
import SanctionsHitsTable, { TableSearchParams } from 'src/components/SanctionsHitsTable';
import s from './index.module.less';
import {
  SanctionsDetails,
  SanctionsHit,
  SanctionsHitStatus,
  SanctionsHitListResponse,
} from '@/apis';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { getOr, map } from '@/utils/asyncResource';
import Checklist from '@/pages/case-management/AlertTable/ExpandedRowRenderer/AlertExpanded/Checklist';
import Comments from '@/pages/case-management/AlertTable/ExpandedRowRenderer/AlertExpanded/Comments';
import TransactionsTab from '@/pages/case-management/AlertTable/ExpandedRowRenderer/AlertExpanded/TransactionsTab';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { notEmpty } from '@/utils/array';
import { QueryResult } from '@/utils/queries/types';
import { useApi } from '@/api';
import { useCursorQuery, CursorPaginatedData, useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM, SANCTIONS_HITS_SEARCH } from '@/utils/queries/keys';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import Select from '@/components/library/Select';
import { humanizeConstant } from '@/utils/humanize';

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
  onSanctionsHitsChangeStatus?: (sanctionsHitsIds: string[], newStatus: SanctionsHitStatus) => void;
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
    onSanctionsHitsChangeStatus,
  } = props;

  const api = useApi();

  const alertId = alert?.alertId ?? '';
  const alertResponse = useQuery(ALERT_ITEM(alertId), async () => {
    if (!alertId) {
      throw new Error(`Unable to fetch alert, id is empty`);
    }
    return api.getAlert({ alertId });
  });

  const [openTableParams, setOpenTableParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    statuses: ['OPEN'],
  });
  const [clearedTableParams, setClearedTableParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    statuses: ['CLEARED'],
  });

  const [sanctionsDetailsId, setSanctionsDetailsId] = useState<string | undefined>(
    details[0]?.searchId,
  );
  const selectedSanctionsDetailsItem = details.filter((x) => x.searchId === sanctionsDetailsId);

  // Data requests
  const openHitsQueryResults = useSanctionHitsQuery(selectedSanctionsDetailsItem, openTableParams);
  const clearedHitsQueryResults = useSanctionHitsQuery(
    selectedSanctionsDetailsItem,
    clearedTableParams,
  );

  // Requests to count total hits count
  const openTotalHitsQueryResults = useSanctionHitsQuery(details, openTableParams);
  const clearedTotalHitsQueryResults = useSanctionHitsQuery(details, clearedTableParams);
  const openHitsCount = getOr(
    map(openTotalHitsQueryResults.data, (x) => x.count),
    null,
  );
  const clearedHitsCount = getOr(
    map(clearedTotalHitsQueryResults.data, (x) => x.count),
    null,
  );

  const tabs: TabItem[] = useMemo(
    () =>
      [
        {
          title: 'Human review' + (openHitsCount != null ? ` (${openHitsCount})` : ''),
          key: MATCH_LIST_TAB_KEY,
          children: (
            <div className={s.selectWithTable}>
              <Select
                value={sanctionsDetailsId}
                options={details.map((detailsItem) => ({
                  label: getOptionName(detailsItem),
                  value: detailsItem.searchId,
                }))}
                onChange={setSanctionsDetailsId}
                allowClear={false}
              />
              <SanctionsHitsTable
                tableRef={null}
                queryResult={openHitsQueryResults}
                isEmbedded={true}
                hideCleaningReason={true}
                selectedIds={selectedSanctionsHitsIds}
                selection={onSanctionsHitSelect != null}
                params={openTableParams}
                onChangeParams={setOpenTableParams}
                onSelect={(sanctionHitsIds) => {
                  if (!alert?.alertId) {
                    return;
                  }
                  onSanctionsHitSelect?.(alert.alertId, sanctionHitsIds, 'OPEN');
                }}
                onSanctionsHitsChangeStatus={onSanctionsHitsChangeStatus}
              />
            </div>
          ),
        },
        {
          title: 'Cleared hits' + (clearedHitsCount != null ? ` (${clearedHitsCount})` : ''),
          key: CLEARED_MATCH_LIST_TAB_KEY,
          children: (
            <div className={s.selectWithTable}>
              <Select
                value={sanctionsDetailsId}
                options={details.map((detailsItem) => ({
                  label: getOptionName(detailsItem),
                  value: detailsItem.searchId,
                }))}
                onChange={setSanctionsDetailsId}
                allowClear={false}
              />
              <SanctionsHitsTable
                tableRef={null}
                queryResult={clearedHitsQueryResults}
                isEmbedded={true}
                selection={onSanctionsHitSelect != null}
                params={clearedTableParams}
                onChangeParams={setClearedTableParams}
                selectedIds={selectedSanctionsHitsIds}
                onSelect={(sanctionHitsIds) => {
                  if (!alert?.alertId) {
                    return;
                  }
                  onSanctionsHitSelect?.(alert.alertId, sanctionHitsIds, 'CLEARED');
                }}
                onSanctionsHitsChangeStatus={onSanctionsHitsChangeStatus}
              />
            </div>
          ),
        },
        ...(alert != null && alert.alertId != null
          ? [
              alert.ruleChecklistTemplateId && {
                title: 'Checklist',
                key: CHECKLIST_TAB_KEY,
                children: <Checklist alert={alert} />,
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
              {
                title: 'Comments',
                key: COMMENTS_TAB_KEY,
                children: <Comments alertsRes={alertResponse.data} alertId={alert.alertId} />,
              },
            ]
          : []),
      ].filter(notEmpty),
    [
      openHitsCount,
      sanctionsDetailsId,
      details,
      openHitsQueryResults,
      selectedSanctionsHitsIds,
      onSanctionsHitSelect,
      openTableParams,
      onSanctionsHitsChangeStatus,
      clearedHitsCount,
      clearedHitsQueryResults,
      clearedTableParams,
      alert,
      alertResponse,
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
  const sanctionHitIds = sanctionDetails.flatMap(({ sanctionHitIds }) => sanctionHitIds ?? []);
  const filters = {
    filterHitIds: sanctionHitIds,
    filterStatus: params.statuses ?? ['OPEN' as const],
  };
  return useCursorQuery(
    SANCTIONS_HITS_SEARCH({ ...filters, ...params }),
    async (paginationParams): Promise<SanctionsHitListResponse> => {
      if (filters.filterHitIds.length === 0) {
        return {
          items: [],
          next: '',
          prev: '',
          last: '',
          hasNext: false,
          hasPrev: false,
          count: 0,
          limit: 100000,
        };
      }
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

function getOptionName(details: SanctionsDetails) {
  let result = details.name;
  if (details.iban) {
    result += ` (IBAN: ${details.iban})`;
  }
  if (details.entityType) {
    result += ` (${humanizeConstant(details.entityType)})`;
  }
  return result;
}
