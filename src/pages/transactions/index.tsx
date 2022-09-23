import React, { useCallback, useMemo } from 'react';
import moment from 'moment';
import { Link } from 'react-router-dom';
import StateSearchButton from './components/TransactionStateButton';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { currencies } from '@/utils/currencies';
import { getUserName } from '@/utils/api/users';
import { RequestFunctionType, RequestTable } from '@/components/RequestTable';
import { TransactionCaseManagement, TransactionType } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import { measure } from '@/utils/time-utils';
import { useAnalytics } from '@/utils/segment/context';
import { useI18n } from '@/locales';
import '../../components/ui/colors';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { paymentMethod, transactionType } from '@/utils/tags';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import { makeUrl } from '@/utils/routing';
import { TableColumn } from '@/components/ui/Table/types';

const TableList = () => {
  const api = useApi();

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
        sorter: true,
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
        sorter: true,
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

  const analytics = useAnalytics();
  const request: RequestFunctionType<TransactionCaseManagement> = useCallback(
    async (params, sorter) => {
      const {
        pageSize,
        current,
        timestamp,
        transactionId,
        type,
        transactionState,
        originCurrenciesFilter,
        destinationCurrenciesFilter,
        userId,
        userFilterMode,
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
          filterUserId: userFilterMode === 'ALL' ? userId : undefined,
          filterOriginUserId: userFilterMode === 'ORIGIN' ? userId : undefined,
          filterDestinationUserId: userFilterMode === 'DESTINATION' ? userId : undefined,
          filterOriginCurrencies: originCurrenciesFilter,
          filterDestinationCurrencies: destinationCurrenciesFilter,
          transactionType: type,
          filterTransactionState: transactionState,
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
        items: response.data,
        success: true,
        total: response.total,
      };
    },
    [analytics, api],
  );

  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.transactions.transactions-list')}>
      <RequestTable<TransactionCaseManagement>
        actionsHeader={[
          ({ params, setParams }) => (
            <>
              <UserSearchButton
                initialMode={params.params.userFilterMode ?? 'ALL'}
                userId={params.params.userId ?? null}
                onConfirm={(userId, mode) => {
                  setParams((state) => ({
                    ...state,
                    params: {
                      ...state.params,
                      userId: userId,
                      userFilterMode: mode,
                    },
                  }));
                }}
              />
              <StateSearchButton
                transactionState={params.params.transactionState ?? undefined}
                onConfirm={(value) => {
                  setParams((state) => ({
                    ...state,
                    params: { ...state.params, transactionState: value ?? undefined },
                  }));
                }}
              />
            </>
          ),
        ]}
        form={{
          labelWrap: true,
        }}
        rowKey="transactionId"
        search={{
          labelWidth: 120,
        }}
        scroll={{ x: 1300 }}
        request={request}
        columns={columns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'transaction-list-table',
        }}
      />
    </PageWrapper>
  );
};

export default TableList;
