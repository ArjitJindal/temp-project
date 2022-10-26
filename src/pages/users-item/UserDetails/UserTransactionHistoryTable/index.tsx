import { Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import style from './style.module.less';
import { prepareTableData } from './helpers';
import * as Card from '@/components/ui/Card';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { RuleAction, TransactionAmountDetails, TransactionEvent } from '@/apis';
import { useApi } from '@/api';
import { DefaultApiGetTransactionsListRequest } from '@/apis/types/ObjectParamAPI';
import { makeUrl } from '@/utils/routing';
import ExpandIcon from '@/components/ui/Table/ExpandIcon';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { useQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { USERS_ITEM_TRANSACTIONS_HISTORY } from '@/utils/queries/keys';
import TransactionState from '@/components/ui/TransactionState';

export type DataItem = {
  index: number;
  status: RuleAction;
  rowKey: string;
  lastRowKey: string;
  transactionId?: string;
  timestamp?: number;
  originAmountDetails?: TransactionAmountDetails;
  destinationAmountDetails?: TransactionAmountDetails;
  direction?: 'Incoming' | 'Outgoing';
  events: Array<TransactionEvent>;
  ruleName: string | null;
  ruleDescription: string | null;
};

const createCurrencyStringFromTransactionAmount = (
  amount: TransactionAmountDetails | undefined,
) => {
  return amount ? `${amount.transactionAmount} ${amount.transactionCurrency}` : '-';
};

export function Content(props: { userId: string }) {
  const { userId } = props;
  const api = useApi();
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // Using this hack to fix sticking dropdown on scroll
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [params, setParams] = useState<AllParams<DefaultApiGetTransactionsListRequest>>({
    ...DEFAULT_PARAMS_STATE,
    limit: -1,
    skip: -1,
    includeEvents: true,
    beforeTimestamp: Date.now(),
  });

  const responseRes = useQuery(USERS_ITEM_TRANSACTIONS_HISTORY(userId, params), async () => {
    const [sortField, sortOrder] = params.sort[0] ?? [];

    const directionFilter = (params ?? {})['direction'] ?? [];
    const showIncoming = directionFilter.indexOf('incoming') !== -1;
    const showOutgoing = directionFilter.indexOf('outgoing') !== -1;

    const statusFilter = (params ?? {})['status'] ?? [];

    const newParams: DefaultApiGetTransactionsListRequest = {
      ...params,
      skip: ((params.page ?? 1) - 1) * params.pageSize,
      limit: params.pageSize,
      beforeTimestamp: Date.now(),
      sortField: sortField ?? undefined,
      sortOrder: sortOrder ?? undefined,
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
      newParams.filterStatus = 'ALLOW';
    } else if (statusFilter.indexOf('FLAG') !== -1) {
      newParams.filterStatus = 'FLAG';
    } else if (statusFilter.indexOf('BLOCK') !== -1) {
      newParams.filterStatus = 'BLOCK';
    } else if (statusFilter.indexOf('SUSPEND') !== -1) {
      newParams.filterStatus = 'SUSPEND';
    } else if (statusFilter.indexOf('WHITELIST') !== -1) {
      newParams.filterStatus = 'WHITELIST';
    }

    return api.getTransactionsList(newParams).then((result) => ({
      total: result.total,
      items: prepareTableData(userId, result.data),
    }));
  });

  return (
    <>
      <div ref={rootRef} style={{ position: 'relative' }} className={style.expandedRow}>
        <QueryResultsTable
          search={false}
          rowKey="rowKey"
          form={{
            labelWrap: true,
          }}
          className={style.tablePadding}
          params={params}
          onChangeParams={setParams}
          queryResults={responseRes}
          getPopupContainer={() => {
            if (rootRef.current) {
              return rootRef.current;
            }
            return document.body;
          }}
          columns={[
            {
              title: 'Transaction ID',
              dataIndex: 'transactionId',
              hideInSearch: true,
              key: 'transactionId',
              onCell: (_) => ({
                rowSpan: _.isFirstRow ? _.rowsCount : 0,
              }),
              render: (dom, entity) => {
                const { lastRowKey } = entity;
                const isExpanded = expandedRows.indexOf(lastRowKey) !== -1;
                return (
                  <div className={style.idColumn}>
                    <ExpandIcon
                      onClick={() => {
                        setExpandedRows((keys) =>
                          isExpanded ? keys.filter((x) => x !== lastRowKey) : [lastRowKey],
                        );
                      }}
                      isExpanded={isExpanded}
                    />
                    <Link to={makeUrl(`/transactions/item/:id`, { id: entity.transactionId })}>
                      {dom}
                    </Link>
                  </div>
                );
              },
            },
            {
              title: 'Rules Hit',
              dataIndex: 'ruleName',
            },
            {
              title: 'Rules Description',
              tooltip: 'Describes the conditions required for this rule to be hit.',
              dataIndex: 'ruleDescription',
            },
            {
              title: 'Last transaction state',
              render: (_, entity) => {
                return (
                  <TransactionState
                    transactionState={entity.events[entity.events.length - 1].transactionState}
                  />
                );
              },
            },
            {
              title: 'Transaction Time',
              dataIndex: 'timestamp',
              hideInSearch: true,
              valueType: 'dateTime',
              key: 'transactionTime',
              width: 180,
              onCell: (_) => ({
                rowSpan: _.isFirstRow ? _.rowsCount : 0,
              }),
              render: (_, transaction) => {
                return <TimestampDisplay timestamp={transaction.timestamp} />;
              },
            },
            {
              title: 'Status',
              dataIndex: 'status',
              sorter: true,
              filters: true,
              onFilter: false,
              filterMultiple: false,
              hideInSearch: true,
              valueType: 'select',
              valueEnum: {
                all: {
                  text: 'All',
                },
                ALLOW: {
                  text: 'ALLOW',
                },
                FLAG: {
                  text: 'FLAG',
                },
                BLOCK: {
                  text: 'BLOCK',
                },
                WHITELIST: {
                  text: 'WHITELIST',
                },
                SUSPEND: {
                  text: 'SUSPEND',
                },
              },
              key: 'ruleAction',
              width: 120,
              onCell: (_) => ({
                rowSpan: _.isFirstRow ? _.rowsCount : 0,
              }),
              render: (dom, entity) => {
                return <RuleActionStatus ruleAction={entity.status} />;
              },
            },
            {
              title: 'Transaction Direction',
              dataIndex: 'direction',
              filters: true,
              onFilter: false,
              filterMultiple: false,
              hideInSearch: true,
              valueType: 'select',
              valueEnum: {
                all: {
                  text: 'All',
                },
                incoming: {
                  text: 'Incoming',
                },
                outgoing: {
                  text: 'Outgoing',
                },
              },
              onCell: (_) => ({
                rowSpan: _.isFirstRow ? _.rowsCount : 0,
              }),
            },
            {
              title: 'Origin',
              hideInSearch: true,
              tooltip: 'Origin is the Sender in a transaction',
              children: [
                {
                  title: 'Origin Amount',
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return `${createCurrencyStringFromTransactionAmount(
                      entity.originAmountDetails,
                    )}`;
                  },
                  onCell: (_) => ({
                    rowSpan: _.isFirstRow ? _.rowsCount : 0,
                  }),
                },
                {
                  title: 'Origin Country',
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return entity.originAmountDetails?.country;
                  },
                  onCell: (_) => ({
                    rowSpan: _.isFirstRow ? _.rowsCount : 0,
                  }),
                },
              ],
            },
            {
              title: 'Destination',
              hideInSearch: true,
              tooltip: 'Destination is the Receiver in a transaction',
              children: [
                {
                  title: 'Destination Amount',
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return `${createCurrencyStringFromTransactionAmount(
                      entity.destinationAmountDetails,
                    )}`;
                  },
                  onCell: (_) => ({
                    rowSpan: _.isFirstRow ? _.rowsCount : 0,
                  }),
                },
                {
                  title: 'Destination Country',
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return entity.destinationAmountDetails?.country;
                  },
                  onCell: (_) => ({
                    rowSpan: _.isFirstRow ? _.rowsCount : 0,
                  }),
                },
              ],
            },
          ]}
          expandable={{
            showExpandColumn: false,
            expandedRowKeys: expandedRows,
            expandedRowRender: (item) => <TransactionEventsTable events={item.events} />,
          }}
          isEvenRow={(item) => item.index % 2 === 0}
          scroll={{ x: 1300 }}
          options={{
            reload: false,
          }}
        />
      </div>
    </>
  );
}

interface Props {
  userId: string | undefined;
  collapsedByDefault?: boolean;
}

export default function UserTransactionHistoryTable(props: Props) {
  const { userId, collapsedByDefault } = props;
  return (
    <Card.Root
      disabled={userId == null}
      header={{
        title: 'Transaction History',
        collapsedByDefault,
      }}
    >
      {userId && <Content userId={userId} />}
    </Card.Root>
  );
}
