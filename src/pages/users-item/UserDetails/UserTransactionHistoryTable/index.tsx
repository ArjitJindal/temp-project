import { Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import style from './style.module.less';
import { prepareTableData } from './helpers';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import * as Card from '@/components/ui/Card';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { RiskLevel, RuleAction, TransactionAmountDetails, TransactionEvent } from '@/apis';
import { useApi } from '@/api';
import { DefaultApiGetTransactionsListRequest } from '@/apis/types/ObjectParamAPI';
import { makeUrl } from '@/utils/routing';
import ExpandIcon from '@/components/ui/Table/ExpandIcon';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { useQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { USERS_ITEM_TRANSACTIONS_HISTORY } from '@/utils/queries/keys';
import TransactionStateTag from '@/components/ui/TransactionStateTag';
import Money from '@/components/ui/Money';
import { Currency } from '@/utils/currencies';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import RiskLevelTag from '@/components/library/RiskLevelTag';

export type DataItem = {
  index: number;
  status?: RuleAction;
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
  arsRiskLevel?: RiskLevel;
  arsScore?: number;
};

export function Content(props: { userId: string }) {
  const { userId } = props;
  const api = useApi();
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const isPulseEnabled = useFeatureEnabled('PULSE');

  // Using this hack to fix sticking dropdown on scroll
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [params, setParams] = useState<AllParams<DefaultApiGetTransactionsListRequest>>({
    ...DEFAULT_PARAMS_STATE,
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
      newParams.filterStatus = ['ALLOW'];
    } else if (statusFilter.indexOf('FLAG') !== -1) {
      newParams.filterStatus = ['FLAG'];
    } else if (statusFilter.indexOf('BLOCK') !== -1) {
      newParams.filterStatus = ['BLOCK'];
    } else if (statusFilter.indexOf('SUSPEND') !== -1) {
      newParams.filterStatus = ['SUSPEND'];
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
              exportData: 'transactionId',
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
            isPulseEnabled
              ? {
                  title: 'TRS score',
                  width: 130,
                  ellipsis: true,
                  dataIndex: 'arsScore.arsScore',
                  exportData: 'arsScore',
                  key: 'arsScore',
                  hideInSearch: true,
                  sorter: true,
                  render: (_, entity) => entity?.arsScore?.toFixed(2),
                  onCell: (_) => ({
                    rowSpan: _.isFirstRow ? _.rowsCount : 0,
                  }),
                  tooltip: 'Transaction Risk Score',
                }
              : {},
            isPulseEnabled
              ? {
                  title: 'TRS level',
                  width: 130,
                  ellipsis: true,
                  dataIndex: 'arsScore.arsScore',
                  exportData: 'arsRiskLevel',
                  key: 'arsRiskLevel',
                  hideInSearch: true,
                  sorter: true,
                  render: (_, entity) => {
                    return <RiskLevelTag level={entity?.arsRiskLevel} />;
                  },
                  onCell: (_) => ({
                    rowSpan: _.isFirstRow ? _.rowsCount : 0,
                  }),
                  tooltip: 'Transaction Risk Score level',
                }
              : {},
            {
              title: 'Rules Hit',
              dataIndex: 'ruleName',
              exportData: 'ruleName',
            },
            {
              title: 'Rules Description',
              tooltip: 'Describes the conditions required for this rule to be hit.',
              dataIndex: 'ruleDescription',
              exportData: 'ruleDescription',
            },
            {
              title: 'Last transaction state',
              exportData: (entity) => entity.events?.[entity.events.length - 1]?.transactionState,
              render: (_, entity) => {
                if (entity.events.length === 0) {
                  return <></>;
                }
                return (
                  <TransactionStateTag
                    transactionState={entity.events[entity.events.length - 1].transactionState}
                  />
                );
              },
            },
            {
              title: 'Transaction Time',
              dataIndex: 'timestamp',
              exportData: (entity) => dayjs(entity.timestamp).format(DEFAULT_DATE_TIME_FORMAT),
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
              exportData: 'status',
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
                return entity.status && <RuleActionStatus ruleAction={entity.status} />;
              },
            },
            {
              title: 'Transaction Direction',
              dataIndex: 'direction',
              exportData: 'direction',
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
                  exportData: 'originAmountDetails',
                  render: (dom, entity) => {
                    return (
                      <Money
                        value={entity.originAmountDetails?.transactionAmount}
                        currency={entity.originAmountDetails?.transactionCurrency as Currency}
                      />
                    );
                  },
                  onCell: (_) => ({
                    rowSpan: _.isFirstRow ? _.rowsCount : 0,
                  }),
                },
                {
                  title: 'Origin Country',
                  hideInSearch: true,
                  exportData: 'originAmountDetails.country',
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
                  title: 'Destination amount',
                  exportData: 'destinationAmountDetails',
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return (
                      <Money
                        value={entity.destinationAmountDetails?.transactionAmount}
                        currency={entity.destinationAmountDetails?.transactionCurrency as Currency}
                      />
                    );
                  },
                  onCell: (_) => ({
                    rowSpan: _.isFirstRow ? _.rowsCount : 0,
                  }),
                },
                {
                  title: 'Destination Country',
                  hideInSearch: true,
                  exportData: 'destinationAmountDetails.country',
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
  updateCollapseState?: (key: string, value: boolean) => void;
  title: string;
  collapsableKey: string;
}

export default function UserTransactionHistoryTable(props: Props) {
  const { userId, updateCollapseState, title, collapsableKey } = props;
  return (
    <Card.Root
      disabled={userId == null}
      header={{ title, collapsableKey }}
      updateCollapseState={updateCollapseState}
    >
      {userId && <Content userId={userId} />}
    </Card.Root>
  );
}
