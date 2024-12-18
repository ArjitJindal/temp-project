import React, { useMemo, useState } from 'react';
import SanctionsHitsTable from 'src/components/SanctionsHitsTable';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { SanctionsHitsTableParams, useSanctionHitsQuery } from './helpers';
import { Alert, SanctionsDetails, SanctionsHitStatus } from '@/apis';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { getOr, map } from '@/utils/asyncResource';
import Checklist from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/DefaultAlertTabs/Checklist';
import Comments from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/DefaultAlertTabs/Comments';
import TransactionsTab from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/DefaultAlertTabs/TransactionsTab';
import { notEmpty } from '@/utils/array';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM } from '@/utils/queries/keys';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import Select from '@/components/library/Select';

const MATCH_LIST_TAB_KEY = 'match_list';
const CLEARED_MATCH_LIST_TAB_KEY = 'cleared_match_list';
const CHECKLIST_TAB_KEY = 'checklist';
const COMMENTS_TAB_KEY = 'comments';
const TRANSACTIONS_TAB_KEY = 'transactions';

interface Props {
  details: SanctionsDetails[];
  alert?: Alert;
  caseUserId: string;
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
    caseUserId,
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

  const [openTableParams, setOpenTableParams] = useState<AllParams<SanctionsHitsTableParams>>({
    ...DEFAULT_PARAMS_STATE,
    statuses: ['OPEN'],
  });
  const [clearedTableParams, setClearedTableParams] = useState<AllParams<SanctionsHitsTableParams>>(
    {
      ...DEFAULT_PARAMS_STATE,
      statuses: ['CLEARED'],
    },
  );

  const [sanctionsDetailsId, setSanctionsDetailsId] = useState<string | undefined>(
    details[0]?.searchId,
  );

  // Data requests
  const openHitsQueryResults = useSanctionHitsQuery(openTableParams, alertId);
  const clearedHitsQueryResults = useSanctionHitsQuery(clearedTableParams, alertId);

  const openHitsCount = getOr(
    map(openHitsQueryResults.data, (x) => x.count),
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
          title: 'Human review' + (openHitsCount != null ? ` (${openHitsCount})` : ''),
          key: MATCH_LIST_TAB_KEY,
          children: (
            <SanctionsHitsTable
              tableRef={null}
              queryResult={openHitsQueryResults}
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
              alertCreatedAt={alert?.createdTimestamp}
            />
          ),
        },
        {
          title: 'Cleared hits' + (clearedHitsCount != null ? ` (${clearedHitsCount})` : ''),
          key: CLEARED_MATCH_LIST_TAB_KEY,
          children: (
            <SanctionsHitsTable
              tableRef={null}
              queryResult={clearedHitsQueryResults}
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
              alertCreatedAt={alert?.createdTimestamp}
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
              alert.numberOfTransactionsHit > 0 && {
                title: 'Transactions details',
                key: TRANSACTIONS_TAB_KEY,
                children: (
                  <TransactionsTab
                    alert={alert}
                    caseUserId={caseUserId}
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
      caseUserId,
      openHitsCount,
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
        tabBarExtraContent={
          <Select
            value={sanctionsDetailsId}
            isDisabled={details.length < 2}
            options={details.map((detailsItem) => ({
              label: getOptionName(detailsItem),
              value: detailsItem.searchId,
            }))}
            onChange={setSanctionsDetailsId}
            allowClear={false}
          />
        }
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
