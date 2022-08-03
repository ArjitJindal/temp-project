import { Button } from 'antd';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { useRef, useState } from 'react';
import style from './style.module.less';
import ExpandedRowRenderer from './ExpandedRowRenderer';
import { RuleActionStatus } from '@/pages/case-management/components/RuleActionStatus';
import { RuleAction, TransactionAmountDetails, TransactionEvent } from '@/apis';
import { useApi } from '@/api';
import Table from '@/components/ui/Table';
import { DefaultApiGetTransactionsListRequest } from '@/apis/types/ObjectParamAPI';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import ExpandIcon from '@/components/ui/Table/ExpandIcon';

interface Props {
  userId?: string;
}

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
  isFirstRow: boolean;
  isLastRow: boolean;
  rowSpan: number;
  ruleName: string | null;
  ruleDescription: string | null;
};

const createCurrencyStringFromTransactionAmount = (
  amount: TransactionAmountDetails | undefined,
) => {
  return amount ? `${amount.transactionAmount} ${amount.transactionCurrency}` : '-';
};

export const UserTransactionHistoryTable: React.FC<Props> = ({ userId }) => {
  const api = useApi();
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // Using this hack to fix sticking dropdown on scroll
  const rootRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <Table<DataItem>
        search={false}
        rowKey="rowKey"
        form={{
          labelWrap: true,
        }}
        className={style.tablePadding}
        request={async (params, sorter, filters) => {
          if (!userId) {
            throw new Error(`User id is null, unable to fetch transaction history`);
          }
          const [sortField, sortOrder] = Object.entries(sorter)[0] ?? [];
          const requestParams: DefaultApiGetTransactionsListRequest = {
            limit: params.pageSize!,
            skip: (params.current! - 1) * params.pageSize!,
            beforeTimestamp: Date.now(),
            includeEvents: true,
            sortField: sortField ?? undefined,
            sortOrder: sortOrder ?? undefined,
          };
          const directionFilter = (filters ?? {})['direction'] ?? [];
          const showIncoming = directionFilter.indexOf('incoming') !== -1;
          const showOutgoing = directionFilter.indexOf('outgoing') !== -1;

          if (showOutgoing) {
            requestParams.filterOriginUserId = userId;
          } else if (showIncoming) {
            requestParams.filterDestinationUserId = userId;
          } else {
            requestParams.filterUserId = userId;
          }

          const statusFilter = (filters ?? {})['status'] ?? [];

          if (statusFilter.indexOf('ALLOW') !== -1) {
            requestParams.filterStatus = 'ALLOW';
          } else if (statusFilter.indexOf('FLAG') !== -1) {
            requestParams.filterStatus = 'FLAG';
          } else if (statusFilter.indexOf('BLOCK') !== -1) {
            requestParams.filterStatus = 'BLOCK';
          } else if (statusFilter.indexOf('SUSPEND') !== -1) {
            requestParams.filterStatus = 'SUSPEND';
          } else if (statusFilter.indexOf('WHITELIST') !== -1) {
            requestParams.filterStatus = 'WHITELIST';
          }

          const result = await api.getTransactionsList(requestParams);

          const data: DataItem[] = result.data.reduce((acc, item, index): DataItem[] => {
            const dataItem: DataItem = {
              index,
              rowKey: item.transactionId ?? `${index}`,
              lastRowKey: `${item.transactionId}#${item.hitRules.length - 1}`,
              transactionId: item.transactionId,
              timestamp: item.timestamp,
              originAmountDetails: item.originAmountDetails,
              destinationAmountDetails: item.destinationAmountDetails,
              direction: item.originUserId === userId ? 'Outgoing' : 'Incoming',
              status: item.status,
              events: item.events ?? [],
              isFirstRow: true,
              isLastRow: true,
              ruleName: null,
              ruleDescription: null,
              rowSpan: 1,
            };
            if (item.hitRules.length === 0) {
              return [...acc, dataItem];
            }
            return [
              ...acc,
              ...item.hitRules.map(
                (rule, i): DataItem => ({
                  ...dataItem,
                  rowSpan: i === 0 ? item.hitRules.length : 0,
                  isFirstRow: i === 0,
                  isLastRow: i === item.hitRules.length - 1,
                  rowKey: `${item.transactionId}#${i}`,
                  ruleName: rule.ruleName,
                  ruleDescription: rule.ruleDescription,
                }),
              ),
            ];
          }, [] as DataItem[]);
          return {
            data,
            success: true,
            total: result.total,
          };
        }}
        getPopupContainer={(result) => {
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
              rowSpan: _.rowSpan,
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
                  <Link to={`/transactions/transactions-list/${entity.transactionId}`}>{dom}</Link>
                </div>
              );
            },
          },
          {
            title: 'Rules Hit',
            dataIndex: 'ruleName',
          },
          {
            title: 'Rules Parameters Matched',
            dataIndex: 'ruleDescription',
          },
          {
            title: 'Transaction Time',
            dataIndex: 'timestamp',
            hideInSearch: true,
            valueType: 'dateTime',
            key: 'transactionTime',
            width: 180,
            onCell: (_) => ({
              rowSpan: _.rowSpan,
            }),
            render: (_, transaction) => {
              return moment(transaction.timestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
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
            key: 'status',
            width: 120,
            onCell: (_) => ({
              rowSpan: _.rowSpan,
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
              rowSpan: _.rowSpan,
            }),
          },
          {
            title: 'Origin Amount',
            hideInSearch: true,
            render: (dom, entity) => {
              return `${createCurrencyStringFromTransactionAmount(entity.originAmountDetails)}`;
            },
            onCell: (_) => ({
              rowSpan: _.rowSpan,
            }),
          },
          {
            title: 'Destination Amount',
            hideInSearch: true,
            render: (dom, entity) => {
              return `${createCurrencyStringFromTransactionAmount(
                entity.destinationAmountDetails,
              )}`;
            },
            onCell: (_) => ({
              rowSpan: _.rowSpan,
            }),
          },
          {
            title: 'Actions',
            render: (dom, entity) => {
              return (
                <Link
                  to={makeUrl(`/case-management/:id`, {
                    id: entity.transactionId,
                  })}
                >
                  <Button size="small" type="ghost">
                    View Case
                  </Button>
                </Link>
              );
            },
            onCell: (_) => ({
              rowSpan: _.rowSpan,
            }),
          },
        ]}
        expandable={{
          showExpandColumn: false,
          expandedRowKeys: expandedRows,
          expandedRowRender: (item) => <ExpandedRowRenderer events={item.events} />,
        }}
        isEvenRow={(item) => item.index % 2 === 0}
        scroll={{ x: 1300 }}
      />
    </div>
  );
};
