import React, { useCallback, useMemo, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-table';
import moment from 'moment';
import { Link } from 'react-router-dom';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { currencies } from '@/utils/currencies';
import { getUserName } from '@/utils/api/users';
import { RequestFunctionType, Table } from '@/components/ui/Table';
import { TransactionCaseManagement, TransactionType } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import { measure } from '@/utils/time-utils';
import { useAnalytics } from '@/utils/segment/context';
import { useI18n } from '@/locales';
import '../../components/ui/colors';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import ResizableTitle from '@/utils/table-utils';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { paymentMethod, transactionType } from '@/utils/tags';
import handleResize from '@/components/ui/Table/utils';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import { makeUrl } from '@/utils/routing';

const TableList = () => {
  const [updatedColumnWidth, setUpdatedColumnWidth] = useState<{
    [key: number]: number;
  }>({});
  const api = useApi();

  const columns: ProColumns<TransactionCaseManagement>[] = useMemo(
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
        sorter: true,
        render: (_, transaction) => {
          return moment(transaction.timestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
        },
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
        sorter: true,
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
        sorter: true,
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
          options: currencies,
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
          options: currencies,
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
    ],
    [],
  );

  const mergeColumns: ProColumns<TransactionCaseManagement>[] = columns.map((col, index) => ({
    ...col,
    width: updatedColumnWidth[index] || col.width,
    onHeaderCell: (column) => ({
      width: (column as ProColumns<TransactionCaseManagement>).width,
      onResize: handleResize(index, setUpdatedColumnWidth),
    }),
  }));

  const analytics = useAnalytics();
  const request: RequestFunctionType<TransactionCaseManagement> = useCallback(
    async (params, sorter) => {
      const {
        pageSize,
        current,
        timestamp,
        transactionId,
        type,
        originCurrenciesFilter,
        destinationCurrenciesFilter,
        userId,
        originUserId,
        destinationUserId,
        originMethodFilter,
        destinationMethodFilter,
      } = params;
      const [sortField, sortOrder] = Object.entries(sorter)[0] ?? [];
      const [response, time] = await measure(() =>
        api.getTransactionsList({
          limit: pageSize!,
          skip: (current! - 1) * pageSize!,
          afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
          beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Date.now(),
          filterId: transactionId,
          filterUserId: userId,
          filterOriginUserId: originUserId,
          filterDestinationUserId: destinationUserId,
          filterOriginCurrencies: originCurrenciesFilter,
          filterDestinationCurrencies: destinationCurrenciesFilter,
          transactionType: type,
          sortField: sortField ?? undefined,
          sortOrder: sortOrder ?? undefined,
          includeUsers: true,
          filterOriginPaymentMethod: originMethodFilter,
          filterDestinationPaymentMethod: destinationMethodFilter,
        }),
      );
      analytics.event({
        title: 'Table Loaded',
        time,
      });
      return {
        data: response.data,
        success: true,
        total: response.total,
      };
    },
    [analytics, api],
  );

  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.transactions.transactions-list')}>
      <Table<TransactionCaseManagement>
        actionsHeader={[
          ({ params, setParams }) => (
            <UserSearchButton
              userId={params.params.userId ?? null}
              onConfirm={(userId) => {
                setParams((state) => ({
                  ...state,
                  params: { ...state.params, userId: userId ?? undefined },
                }));
              }}
            />
          ),
        ]}
        form={{
          labelWrap: true,
        }}
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        rowKey="transactionId"
        search={{
          labelWidth: 120,
        }}
        scroll={{ x: 1300 }}
        request={request}
        columns={mergeColumns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'transaction-list-table',
        }}
      />
    </PageWrapper>
  );
};

export default TableList;
