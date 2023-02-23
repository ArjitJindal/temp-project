import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CaseTransaction } from '@/apis';
import { TableColumn, TableData } from '@/components/ui/Table/types';
import { makeUrl } from '@/utils/routing';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { QueryResult } from '@/utils/queries/types';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import TransactionStateTag from '@/components/ui/TransactionStateTag';
import { getUserName } from '@/utils/api/users';
import UserLink from '@/components/UserLink';
import UserCountryDisplay from '@/components/ui/UserCountryDisplay';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { CommonParams } from '@/components/ui/Table';

export interface TransactionsTableParams extends CommonParams {}

type Props = {
  params: TransactionsTableParams;
  onChangeParams: (newParams: TransactionsTableParams) => void;
  queryResult: QueryResult<TableData<CaseTransaction>>;
};

export default function TransactionsTable(props: Props) {
  const { queryResult, params, onChangeParams } = props;

  const columns: TableColumn<CaseTransaction>[] = useMemo(
    () => [
      {
        title: 'Basic details',
        children: [
          {
            title: 'Transaction ID',
            dataIndex: 'transactionId',
            exportData: 'transactionId',
            width: 130,
            copyable: true,
            ellipsis: true,
            render: (dom, entity) => {
              return (
                <Link to={makeUrl(`/transactions/item/:id`, { id: entity.transactionId })}>
                  {entity.transactionId}
                </Link>
              );
            },
          },
          {
            title: 'Type',
            dataIndex: 'type',
            exportData: 'type',
            valueType: 'select',
            render: (dom, entity) => {
              return <TransactionTypeTag transactionType={entity.type} />;
            },
          },

          {
            title: 'Timestamp',
            dataIndex: 'timestamp',
            exportData: (entity) => dayjs(entity.timestamp).format(DEFAULT_DATE_TIME_FORMAT),
            render: (_, transaction) => {
              return dayjs(transaction.timestamp).format(DEFAULT_DATE_TIME_FORMAT);
            },
          },
          // {
          //   title: 'Status',
          //   render: (_, entity) => {
          //     return <>N/A</>;
          //   },
          // },
          {
            title: 'Last state',
            subtitle: 'Direction',
            dataIndex: 'transactionState',
            exportData: 'transactionState',
            render: (_, entity) => {
              return <TransactionStateTag transactionState={entity.transactionState} />;
            },
          },
        ],
      },
      {
        title: 'Origin details',
        children: [
          {
            title: 'Username',
            subtitle: 'User ID',
            render: (_, entity) => (
              <>
                {getUserName(entity.originUser)}
                {entity.originUser && (
                  <>
                    <br />
                    <UserLink user={entity.originUser}>{entity.originUser.userId}</UserLink>
                  </>
                )}
              </>
            ),
          },
          {
            title: 'Country',
            render: (_, entity) => <UserCountryDisplay user={entity.originUser} />,
          },
          {
            title: 'Payment method',
            render: (_, entity) => (
              <PaymentMethodTag paymentMethod={entity.originPaymentDetails?.method} />
            ),
          },
        ],
      },
    ],
    [],
  );

  return (
    <QueryResultsTable<CaseTransaction>
      headerSubtitle="Case transactions"
      disableScrolling={true}
      tableId={'alert-transactions-list'}
      params={params}
      onChangeParams={onChangeParams}
      showResultsInfo
      form={{
        labelWrap: true,
      }}
      rowKey="transactionId"
      queryResults={queryResult}
      columns={columns}
      columnsState={{
        persistenceType: 'localStorage',
        persistenceKey: 'transaction-list-table',
      }}
    />
  );
}
