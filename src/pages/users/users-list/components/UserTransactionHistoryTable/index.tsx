import { Button } from 'antd';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import style from './style.module.less';
import ExpandedRowRenderer from './ExpandedRowRenderer';
import { RuleActionStatus } from '@/pages/case-management/components/RuleActionStatus';
import {
  RuleAction,
  TransactionAmountDetails,
  TransactionCaseManagement,
  TransactionEvent,
} from '@/apis';
import { useApi } from '@/api';
import { RequestFunctionType, Table } from '@/components/ui/Table';
import { DefaultApiGetTransactionsListRequest } from '@/apis/types/ObjectParamAPI';
import { makeUrl } from '@/utils/routing';
import ExpandIcon from '@/components/ui/Table/ExpandIcon';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import { prepareTableData } from '@/pages/users/users-list/components/UserTransactionHistoryTable/helpers';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { getErrorMessage } from '@/utils/lang';
import TimestampDisplay from '@/components/ui/TimestampDisplay';

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

  const [params, setParams] = useState<DefaultApiGetTransactionsListRequest>({
    limit: DEFAULT_PAGE_SIZE,
    skip: 0,
    includeEvents: true,
    beforeTimestamp: Date.now(),
  });
  const [responseRes, setResponseRes] = useState<
    AsyncResource<{
      total: number;
      data: Array<TransactionCaseManagement>;
    }>
  >(init());
  const request: RequestFunctionType<DataItem> = useCallback(
    async (params, sorter, filter) => {
      const [sortField, sortOrder] = Object.entries(sorter)[0] ?? [];

      const directionFilter = (params ?? {})['direction'] ?? [];
      const showIncoming = directionFilter.indexOf('incoming') !== -1;
      const showOutgoing = directionFilter.indexOf('outgoing') !== -1;

      const statusFilter = (params ?? {})['status'] ?? [];

      const newParams: DefaultApiGetTransactionsListRequest = {
        ...params,
        skip: ((params.current ?? 1) - 1) * DEFAULT_PAGE_SIZE,
        limit: DEFAULT_PAGE_SIZE,
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
        data: prepareTableData(userId, result.data),
      }));
    },
    [api, userId],
  );

  useEffect(() => {
    let isCanceled = false;
    setResponseRes((res) => loading(getOr(res, null)));
    api
      .getTransactionsList(params)
      .then((result) => {
        if (!isCanceled) {
          setResponseRes(
            success({
              total: result.total,
              data: result.data,
            }),
          );
        }
      })
      .catch((e) => {
        if (!isCanceled) {
          setResponseRes(failed(getErrorMessage(e)));
        }
      });

    return () => {
      isCanceled = true;
    };
  }, [api, params]);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <Table<DataItem>
        search={false}
        rowKey="rowKey"
        form={{
          labelWrap: true,
        }}
        className={style.tablePadding}
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
            title: 'Rules Description',
            tooltip: 'Describes the conditions required for this rule to be hit.',
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
            tooltip: 'Origin is the Sender in a transaction',
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
            tooltip: 'Destination is the Receiver in a transaction',
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
        options={{
          reload: false,
        }}
        pagination={false}
        request={request}
      />
    </div>
  );
};
