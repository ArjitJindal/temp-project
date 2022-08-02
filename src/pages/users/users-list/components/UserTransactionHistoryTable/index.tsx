import { Divider, Tag } from 'antd';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { useRef, useCallback, useState } from 'react';
import style from './style.module.less';
import { RuleActionStatus } from '@/pages/case-management/components/RuleActionStatus';
import { TransactionAmountDetails, TransactionCaseManagement, TransactionEvent } from '@/apis';
import { useApi } from '@/api';
import Table from '@/components/ui/Table';
import { DefaultApiGetTransactionsListRequest } from '@/apis/types/ObjectParamAPI';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import Id from '@/components/ui/Id';

interface Props {
  userId?: string;
}

const createCurrencyStringFromTransactionAmount = (
  amount: TransactionAmountDetails | undefined,
) => {
  return amount ? `${amount.transactionAmount} ${amount.transactionCurrency}` : '-';
};

function expandedRowRender(transaction: TransactionCaseManagement) {
  return (
    <Table<TransactionEvent>
      rowKey="_id"
      search={false}
      columns={[
        {
          title: 'Event ID',
          dataIndex: 'eventId',
          width: 100,
          render: (dom, event) => (event.eventId ? <Id>{event.eventId}</Id> : '-'),
        },
        {
          title: 'Transaction state',
          dataIndex: 'transactionState',
          width: 100,
        },
        {
          title: 'Event Time',
          dataIndex: 'timestamp',
          valueType: 'dateTime',
          key: 'transactionTime',
          width: 100,
          render: (_, item) => {
            return moment(item.timestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
          },
        },
        {
          title: 'Description',
          dataIndex: 'eventDescription',
          width: 100,
        },
        {
          title: 'Reason',
          dataIndex: 'reason',
          width: 100,
        },
      ]}
      dataSource={transaction.events ?? []}
      pagination={false}
      options={{
        density: false,
        setting: false,
        reload: false,
      }}
    />
  );
}

export const UserTransactionHistoryTable: React.FC<Props> = ({ userId }) => {
  const [updatedTransactions] = useState<{
    [key: string]: TransactionCaseManagement;
  }>({});
  const api = useApi();

  // Using this hack to fix sticking dropdown on scroll
  const rootRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <Table<
        TransactionCaseManagement & {
          direction: 'Incoming' | 'Outgoing';
        }
      >
        search={false}
        rowKey="transactionId"
        form={{
          labelWrap: true,
        }}
        className={style.tablePadding}
        request={async (params, sort, filters) => {
          if (!userId) {
            throw new Error(`User id is null, unable to fetch transaction history`);
          }
          const requestParams: DefaultApiGetTransactionsListRequest = {
            limit: params.pageSize!,
            skip: (params.current! - 1) * params.pageSize!,
            beforeTimestamp: Date.now(),
            includeEvents: true,
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
          return {
            data: result.data.map((x) => ({
              ...x,
              direction: x.originUserId === userId ? 'Outgoing' : 'Incoming',
            })),
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
            render: (dom, entity) => {
              return (
                <Link to={`/transactions/transactions-list/${entity.transactionId}`}>{dom}</Link>
              );
            },
          },
          {
            title: 'Transaction Time',
            dataIndex: 'timestamp',
            hideInSearch: true,
            valueType: 'dateTime',
            key: 'transactionTime',
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
            render: (dom, entity) => {
              const transaction = updatedTransactions[entity.transactionId as string] || entity;
              return <RuleActionStatus ruleAction={transaction.status} />;
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
            key: 'direction',
          },
          {
            title: 'Origin Amount',
            hideInSearch: true,
            render: (dom, entity) => {
              return `${createCurrencyStringFromTransactionAmount(entity.originAmountDetails)}`;
            },
            key: 'originAmountDetails',
          },
          {
            title: 'Destination Amount',
            hideInSearch: true,
            render: (dom, entity) => {
              return `${createCurrencyStringFromTransactionAmount(
                entity.destinationAmountDetails,
              )}`;
            },
            key: 'destinationAmountDetails',
          },
        ]}
        expandable={{ expandedRowRender }}
      />
    </div>
  );
};
