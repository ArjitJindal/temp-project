import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import moment from 'moment/moment';
import { TransactionCaseManagement, TransactionState, TransactionType } from '@/apis';
import { TableColumn, TableData } from '@/components/ui/Table/types';
import { makeUrl } from '@/utils/routing';
import { paymentMethod, transactionType } from '@/utils/tags';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import { getUserName } from '@/utils/api/users';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { CURRENCIES_SELECT_OPTIONS } from '@/utils/currencies';
import KeyValueTag from '@/components/ui/KeyValueTag';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { QueryResult } from '@/utils/queries/types';
import { ActionRenderer, AllParams, CommonParams } from '@/components/ui/Table';
import { Mode } from '@/pages/transactions/components/UserSearchPopup/types';

export interface TransactionsTableParams extends CommonParams {
  current?: string;
  timestamp?: string;
  transactionId?: string;
  type?: string;
  transactionState?: TransactionState;
  originCurrenciesFilter?: string[];
  destinationCurrenciesFilter?: string[];
  userId?: string;
  userFilterMode?: Mode;
  tagKey?: string;
  tagValue?: string;
  originMethodFilter?: string;
  destinationMethodFilter?: string;
}

type Props = {
  actionsHeader?: ActionRenderer<TransactionsTableParams>[];
  queryResult: QueryResult<TableData<TransactionCaseManagement>>;
  params?: TransactionsTableParams;
  onChangeParams?: (newState: AllParams<TransactionsTableParams>) => void;
  hideSearchForm?: boolean;
  disableSorting?: boolean;
};

export default function TransactionsTable(props: Props) {
  const { queryResult, params, hideSearchForm, disableSorting, actionsHeader, onChangeParams } =
    props;

  const columns: TableColumn<TransactionCaseManagement>[] = useMemo(
    () => [
      {
        title: 'Transaction ID',
        dataIndex: 'transactionId',
        width: 130,
        copyable: true,
        ellipsis: true,
        render: (dom, entity) => {
          // todo: fix style
          return (
            <Link
              to={makeUrl(`/transactions/item/:id`, { id: entity.transactionId })}
              style={{ color: '@fr-colors-brandBlue' }}
            >
              {entity.transactionId}
            </Link>
          );
        },
      },
      {
        title: 'Transaction Type',
        dataIndex: 'type',
        width: 175,
        ellipsis: true,
        valueType: 'select',
        fieldProps: {
          options: transactionType,
          allowClear: true,
        },
        render: (dom, entity) => {
          return <TransactionTypeTag transactionType={entity.type as TransactionType} />;
        },
      },
      {
        title: 'Timestamp',
        width: 180,
        ellipsis: true,
        dataIndex: 'timestamp',
        valueType: 'dateTimeRange',
        sorter: !disableSorting,
        render: (_, transaction) => {
          return moment(transaction.timestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
        },
      },
      {
        title: 'Transaction State',
        width: 130,
        ellipsis: true,
        dataIndex: 'transactionState',
        hideInSearch: true,
        sorter: !disableSorting,
      },
      {
        title: 'Origin User ID',
        tooltip: 'Origin is the Sender in a transaction',
        width: 200,
        dataIndex: 'originUserId',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.originUserId;
        },
      },
      {
        title: 'Origin User Name',
        tooltip: 'Origin is the Sender in a transaction',
        width: 220,
        hideInSearch: true,
        render: (dom, entity) => {
          return getUserName(entity.originUser);
        },
      },
      {
        title: 'Origin Method',
        width: 180,
        hideInSearch: true,
        render: (dom, entity) => {
          return <PaymentMethodTag paymentMethod={entity.originPaymentDetails?.method} />;
        },
      },
      {
        title: 'Origin Amount',
        width: 150,
        dataIndex: 'originAmountDetails.transactionAmount',
        hideInSearch: true,
        sorter: !disableSorting,
        render: (dom, entity) => {
          if (entity.originAmountDetails?.transactionAmount !== undefined) {
            return new Intl.NumberFormat().format(entity.originAmountDetails?.transactionAmount);
          } else {
            return entity.originAmountDetails?.transactionAmount;
          }
        },
      },
      {
        title: 'Origin Currency',
        width: 140,
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.originAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Origin Country',
        width: 140,
        hideInSearch: true,
        render: (dom, entity) => {
          return <CountryDisplay isoCode={entity.originAmountDetails?.country} />;
        },
      },
      {
        title: 'Destination User ID',
        tooltip: 'Destination is the Receiver in a transaction',
        width: 170,
        dataIndex: 'destinationUserId',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationUserId;
        },
      },
      {
        title: 'Destination User Name',
        tooltip: 'Destination is the Receiver in a transaction',
        width: 180,
        hideInSearch: true,
        render: (dom, entity) => {
          return getUserName(entity.destinationUser);
        },
      },
      {
        title: 'Destination Method',
        width: 160,
        hideInSearch: true,
        render: (dom, entity) => {
          return <PaymentMethodTag paymentMethod={entity.destinationPaymentDetails?.method} />;
        },
      },
      {
        title: 'Destination Amount',
        dataIndex: 'destnationAmountDetails.transactionAmount',
        width: 200,
        hideInSearch: true,
        sorter: !disableSorting,
        render: (dom, entity) => {
          if (entity.destinationAmountDetails?.transactionAmount !== undefined) {
            return new Intl.NumberFormat().format(
              entity.destinationAmountDetails?.transactionAmount,
            );
          } else {
            return entity.destinationAmountDetails?.transactionAmount;
          }
        },
      },
      {
        title: 'Destination Currency',
        width: 200,
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Destination Country',
        width: 200,
        hideInSearch: true,
        render: (dom, entity) => {
          return <CountryDisplay isoCode={entity.destinationAmountDetails?.country} />;
        },
      },
      {
        title: 'Origin Currencies',
        dataIndex: 'originCurrenciesFilter',
        hideInTable: true,
        width: 170,
        valueType: 'select',
        fieldProps: {
          options: CURRENCIES_SELECT_OPTIONS,
          allowClear: true,
          mode: 'multiple',
        },
      },
      {
        title: 'Destination Currencies',
        dataIndex: 'destinationCurrenciesFilter',
        hideInTable: true,
        width: 200,
        valueType: 'select',
        fieldProps: {
          options: CURRENCIES_SELECT_OPTIONS,
          allowClear: true,
          mode: 'multiple',
        },
      },
      {
        title: 'Origin Method',
        hideInTable: true,
        width: 120,
        dataIndex: 'originMethodFilter',
        valueType: 'select',
        fieldProps: {
          options: paymentMethod,
          allowClear: true,
        },
      },
      {
        title: 'Destination Method',
        hideInTable: true,
        width: 120,
        dataIndex: 'destinationMethodFilter',
        valueType: 'select',
        fieldProps: {
          options: paymentMethod,
          allowClear: true,
        },
      },
      {
        title: 'Tags',
        hideInSearch: true,
        width: 150,
        onCell: (row) => ({
          rowSpan: row.isFirstRow ? row.rowsCount : 0,
        }),
        render: (_, entity) => {
          return (
            <>
              {entity.tags?.map((tag) => (
                <KeyValueTag key={tag.key} tag={tag} />
              ))}
            </>
          );
        },
      },
    ],
    [disableSorting],
  );

  return (
    <QueryResultsTable<TransactionCaseManagement, TransactionsTableParams>
      params={params}
      onChangeParams={onChangeParams}
      actionsHeader={actionsHeader}
      disableInternalPadding={hideSearchForm}
      showResultsInfo
      form={{
        labelWrap: true,
      }}
      rowKey="transactionId"
      search={
        hideSearchForm
          ? false
          : {
              labelWidth: 120,
            }
      }
      scroll={{ x: 1300 }}
      queryResults={queryResult}
      columns={columns}
      columnsState={{
        persistenceType: 'localStorage',
        persistenceKey: 'transaction-list-table',
      }}
    />
  );
}
