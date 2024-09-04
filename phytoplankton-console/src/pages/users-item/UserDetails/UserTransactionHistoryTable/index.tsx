import { useState } from 'react';
import { ManualCaseCreationButton } from '../../ManualCaseCreationButton';
import style from './style.module.less';
import { prepareTableData } from './helpers';
import * as Card from '@/components/ui/Card';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';
import {
  Amount,
  CasesListResponse,
  RiskLevel,
  RuleAction,
  TransactionAmountDetails,
  TransactionEvent,
  TransactionState,
} from '@/apis';
import { useApi } from '@/api';
import { DefaultApiGetTransactionsListRequest } from '@/apis/types/ObjectParamAPI';
import { useCursorQuery, useQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { CASES_LIST, USERS_ITEM_TRANSACTIONS_HISTORY } from '@/utils/queries/keys';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  COUNTRY,
  DATE,
  FLOAT,
  MONEY,
  RISK_LEVEL,
  RULE_ACTION_STATUS,
  TRANSACTION_STATE,
} from '@/components/library/Table/standardDataTypes';
import { makeUrl } from '@/utils/routing';
import Id from '@/components/ui/Id';
import { getOr } from '@/utils/asyncResource';
import { dayjs } from '@/utils/dayjs';

export type DataItem = {
  index: number;
  status?: RuleAction;
  rowKey: string;
  transactionId?: string;
  timestamp?: number;
  originAmountDetails?: TransactionAmountDetails;
  destinationAmountDetails?: TransactionAmountDetails;
  direction?: 'Incoming' | 'Outgoing';
  events: Array<TransactionEvent>;
  ruleName: string | null;
  ruleDescription: string | null;
  arsRiskLevel?: RiskLevel;
  arsScore?: number;
  transactionState?: TransactionState;
};

const DEFAULT_TIMESTAMP = [dayjs().subtract(1, 'month').startOf('day'), dayjs().endOf('day')];

export function Content(props: { userId: string }) {
  const { userId } = props;
  const api = useApi();
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');

  const [params, setParams] = useState<
    AllParams<DefaultApiGetTransactionsListRequest> & { timestamp?: string[] }
  >({
    ...DEFAULT_PARAMS_STATE,
    includeEvents: true,
    timestamp: DEFAULT_TIMESTAMP.map((x) => x.format()),
  });

  const cases = useQuery(
    CASES_LIST({
      filterCaseTypes: ['MANUAL'],
      filterUserId: userId,
    }),
    async () => {
      return api.getCaseList({
        filterCaseTypes: ['MANUAL'],
        filterUserId: userId,
      });
    },
  );

  const responseRes = useCursorQuery(
    USERS_ITEM_TRANSACTIONS_HISTORY(userId, params),
    async ({ from }) => {
      const [sortField, sortOrder] = params.sort[0] ?? [];

      const directionFilter = (params ?? {})['direction'] ?? [];
      const timestamp = (params ?? {})['timestamp'] ?? [];
      const showIncoming = directionFilter.indexOf('incoming') !== -1;
      const showOutgoing = directionFilter.indexOf('outgoing') !== -1;

      const statusFilter = (params ?? {})['status'] ?? [];

      const newParams: DefaultApiGetTransactionsListRequest = {
        ...params,
        start: from,
        sortField: sortField ?? undefined,
        sortOrder: sortOrder ?? undefined,
        afterTimestamp: timestamp ? dayjs(timestamp[0]).valueOf() : 0,
        beforeTimestamp: timestamp ? dayjs(timestamp[1]).valueOf() : undefined,
        includeEvents: true,
      };

      if (showOutgoing) {
        newParams.filterOriginUserId = userId;
      } else if (showIncoming) {
        newParams.filterDestinationUserId = userId;
      } else {
        newParams.filterUserId = userId;
      }

      if (statusFilter.indexOf('ALLOW') !== -1) {
        newParams.filterStatus = ['ALLOW'];
      } else if (statusFilter.indexOf('FLAG') !== -1) {
        newParams.filterStatus = ['FLAG'];
      } else if (statusFilter.indexOf('BLOCK') !== -1) {
        newParams.filterStatus = ['BLOCK'];
      } else if (statusFilter.indexOf('SUSPEND') !== -1) {
        newParams.filterStatus = ['SUSPEND'];
      }

      return api.getTransactionsList(newParams).then((result) => ({
        next: result.next,
        prev: result.prev,
        last: result.last,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
        count: result.count,
        limit: result.limit,
        items: prepareTableData(userId, result.items ?? []),
      }));
    },
  );

  const helper = new ColumnHelper<DataItem>();

  const casesList = getOr<CasesListResponse>(cases.data, { data: [], total: 0 }); // eslint-disable-line

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <QueryResultsTable<DataItem>
      rowKey="rowKey"
      params={params}
      onChangeParams={setParams}
      queryResults={responseRes}
      columns={helper.list([
        helper.simple<'transactionId'>({
          title: 'Transaction ID',
          key: 'transactionId',
          type: {
            render: (transactionId) => {
              return (
                <div className={style.idColumn}>
                  <Id to={makeUrl(`/transactions/item/:id`, { id: transactionId ?? '' })}>
                    {transactionId}
                  </Id>
                </div>
              );
            },
          },
        }),
        ...(isRiskScoringEnabled
          ? [
              helper.simple({
                title: 'TRS score',
                key: 'arsScore',
                id: 'arsScore.arsScore',
                type: FLOAT,
                sorting: true,
                tooltip: 'Transaction Risk Score',
              }),
              helper.simple<'arsRiskLevel'>({
                title: 'TRS level',
                type: RISK_LEVEL,
                key: 'arsRiskLevel',
                tooltip: 'Transaction Risk Score level',
              }),
            ]
          : []),
        helper.simple<'ruleName'>({
          title: 'Rules hit',
          key: 'ruleName',
        }),
        helper.simple<'ruleDescription'>({
          title: 'Rules description',
          tooltip: 'Describes the conditions required for this rule to be hit.',
          key: 'ruleDescription',
        }),
        helper.simple<'transactionState'>({
          id: 'lastTransactionState',
          title: 'Last transaction state',
          key: 'transactionState',
          type: TRANSACTION_STATE,
        }),
        helper.simple<'timestamp'>({
          title: 'Transaction time',
          key: 'timestamp',
          type: {
            ...DATE,
            autoFilterDataType: {
              kind: 'dateTimeRange',
              allowClear: false,
            },
          },
          sorting: true,
          filtering: true,
        }),
        helper.simple<'status'>({
          key: 'status',
          title: 'Status',
          type: RULE_ACTION_STATUS,
          sorting: true,
          filtering: true,
        }),
        helper.simple<'direction'>({
          title: 'Transaction direction',
          key: 'direction',
          type: {
            autoFilterDataType: {
              kind: 'select',
              options: [
                { value: 'all', label: 'All' },
                { value: 'incoming', label: 'Incoming' },
                { value: 'outgoing', label: 'Outgoing' },
              ],
              mode: 'SINGLE',
              displayMode: 'select',
            },
          },
          filtering: true,
        }),
        helper.group({
          title: 'Origin',
          tooltip: 'Origin is the Sender in a transaction',
          children: helper.list([
            helper.derived<Amount>({
              id: 'originAmount',
              title: 'Origin amount',
              value: (entity): Amount | undefined => {
                if (entity.originAmountDetails == null) {
                  return undefined;
                }
                return {
                  amountValue: entity.originAmountDetails?.transactionAmount,
                  amountCurrency: entity.originAmountDetails?.transactionCurrency,
                };
              },
              type: MONEY,
            }),
            helper.simple<'originAmountDetails.country'>({
              id: 'originCountry',
              title: 'Origin country',
              key: 'originAmountDetails.country',
              type: COUNTRY,
            }),
          ]),
        }),
        helper.group({
          title: 'Destination',
          tooltip: 'Destination is the Receiver in a transaction',
          children: helper.list([
            helper.derived({
              id: 'destinationAmount',
              title: 'Destination amount',
              value: (entity): Amount | undefined => {
                if (entity.destinationAmountDetails == null) {
                  return undefined;
                }
                return {
                  amountValue: entity.destinationAmountDetails?.transactionAmount,
                  amountCurrency: entity.destinationAmountDetails?.transactionCurrency,
                };
              },
              type: MONEY,
            }),
            helper.simple<'destinationAmountDetails.country'>({
              id: 'destinationCountry',
              title: 'Destination country',
              key: 'destinationAmountDetails.country',
              type: COUNTRY,
            }),
          ]),
        }),
      ])}
      renderExpanded={(item) => <TransactionEventsTable events={item.events} />}
      fixedExpandedContainer={true}
      fitHeight={true}
      selectionActions={[
        ({ selectedIds }) => {
          return (
            casesList.total > 0 && (
              <ManualCaseCreationButton userId={userId} transactionIds={selectedIds} type="EDIT" />
            )
          );
        },
        ({ selectedIds }) => (
          <ManualCaseCreationButton userId={userId} transactionIds={selectedIds} type="CREATE" />
        ),
      ]}
      selectionInfo={
        selectedIds.length > 0
          ? {
              entityCount: selectedIds.length,
              entityName: 'transactions',
            }
          : undefined
      }
      selection={true}
      selectedIds={selectedIds}
      onSelect={setSelectedIds}
    />
  );
}

interface Props {
  userId: string | undefined;
  title?: string;
}

export default function UserTransactionHistoryTable(props: Props) {
  const { userId, title } = props;
  return (
    <Card.Root
      className={style.root}
      disabled={userId == null}
      header={title != null ? { title } : undefined}
    >
      {userId && (
        <Card.Section>
          <Content userId={userId} />
        </Card.Section>
      )}
    </Card.Root>
  );
}
