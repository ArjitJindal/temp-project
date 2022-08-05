import { Button, Pagination } from 'antd';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { useEffect, useRef, useState } from 'react';
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
import Table from '@/components/ui/Table';
import { DefaultApiGetTransactionsListRequest } from '@/apis/types/ObjectParamAPI';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import { makeUrl } from '@/utils/routing';
import ExpandIcon from '@/components/ui/Table/ExpandIcon';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isLoading,
  loading,
  map,
  success,
} from '@/utils/asyncResource';
import { getErrorMessage } from '@/utils/lang';
import { prepareTableData } from '@/pages/users/users-list/components/UserTransactionHistoryTable/helpers';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/constants';

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
        dataSource={prepareTableData(
          userId,
          getOr(
            map(responseRes, ({ data }) => data),
            [],
          ),
        )}
        onChange={(pagination, filters, sorter) => {
          setParams((params) => {
            const [sortField, sortOrder] = Object.entries(sorter)[0] ?? [];

            const directionFilter = (filters ?? {})['direction'] ?? [];
            const showIncoming = directionFilter.indexOf('incoming') !== -1;
            const showOutgoing = directionFilter.indexOf('outgoing') !== -1;

            const statusFilter = (filters ?? {})['status'] ?? [];

            const newParams: DefaultApiGetTransactionsListRequest = {
              ...params,
              skip: 0,
              sortField,
              sortOrder,
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

            return newParams;
          });
        }}
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
        loading={isLoading(responseRes)}
        options={{
          reload: false,
        }}
        pagination={false}
      />
      <Pagination
        className={style.pagination}
        size="small"
        showSizeChanger={false}
        pageSize={DEFAULT_PAGE_SIZE}
        showTitle={true}
        total={getOr(
          map(responseRes, (x) => x.total),
          0,
        )}
        current={Math.floor(params.skip / DEFAULT_PAGE_SIZE) + 1}
        onChange={(page) => {
          setParams((params) => ({ ...params, skip: DEFAULT_PAGE_SIZE * (page - 1) }));
        }}
      />
    </div>
  );
};
