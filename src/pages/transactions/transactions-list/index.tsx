import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-table';
import { Drawer } from 'antd';
import moment from 'moment';
import { Link } from 'react-router-dom';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
import { RouteMatch, useNavigate, useParams } from 'react-router';
import { currencies } from '../../../utils/currencies';
import { TransactionDetails } from './components/TransactionDetails';
import { getUserName } from '@/utils/api/users';
import Table from '@/components/ui/Table';
import { ApiException, TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import {
  AsyncResource,
  failed,
  init,
  isInit,
  isSuccess,
  loading,
  success,
} from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { measure } from '@/utils/time-utils';
import { useAnalytics } from '@/utils/segment/context';
import { useI18n } from '@/locales';
import '../../../components/ui/colors';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import ResizableTitle from '@/utils/table-utils';

const TableList = (props: RouteMatch<'id'>) => {
  const actionRef = useRef<ActionType>();
  const { id: transactionId } = useParams<'id'>();
  const [currentItem, setCurrentItem] = useState<AsyncResource<TransactionCaseManagement>>(init());
  const api = useApi();

  const currentTransactionId = isSuccess(currentItem) ? currentItem.value.transactionId : null;
  useEffect(() => {
    if (transactionId == null || transactionId === 'all') {
      setCurrentItem(init());
      return function () {};
    }
    if (currentTransactionId === transactionId) {
      return function () {};
    }
    setCurrentItem(loading());
    let isCanceled = false;
    api
      .getTransaction({
        transactionId,
      })
      .then((transaction) => {
        if (isCanceled) {
          return;
        }
        setCurrentItem(success(transaction));
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        // todo: i18n
        let message = 'Unknown error';
        if (e instanceof ApiException && e.code === 404) {
          message = `Unable to find transaction by id "${transactionId}"`;
        } else if (e instanceof Error && e.message) {
          message = e.message;
        }
        setCurrentItem(failed(message));
      });
    return () => {
      isCanceled = true;
    };
  }, [currentTransactionId, transactionId, api]);

  const [columns, setColumns] = useState<ProColumns<TransactionCaseManagement>[]>(
    useMemo(
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
                to={`/transactions/transactions-list/${entity.transactionId}`}
                onClick={() => {
                  setCurrentItem(success(entity));
                }}
                style={{ color: '@fr-colors-brandBlue' }}
                replace
              >
                {entity.transactionId}
              </Link>
            );
          },
        },
        {
          title: 'Transaction Type',
          dataIndex: 'type',
          width: 100,
          ellipsis: true,
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
          width: 120,
          dataIndex: 'originUserId',
          render: (dom, entity) => {
            return entity.originUserId;
          },
        },
        {
          title: 'Origin User Name',
          width: 120,
          render: (dom, entity) => {
            return getUserName(entity.originUser);
          },
        },
        {
          title: 'Origin Method',
          width: 120,
          hideInSearch: true,
          render: (dom, entity) => {
            return entity.originPaymentDetails?.method;
          },
        },
        {
          title: 'Origin Amount',
          width: 120,
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
          width: 120,
          hideInSearch: true,
          render: (dom, entity) => {
            return entity.originAmountDetails?.transactionCurrency;
          },
        },
        {
          title: 'Origin Country',
          width: 120,
          hideInSearch: true,
          render: (dom, entity) => {
            return entity.originAmountDetails?.country;
          },
        },
        {
          title: 'Destination User ID',
          width: 120,
          dataIndex: 'destinationUserId',
          render: (dom, entity) => {
            return entity.destinationUserId;
          },
        },
        {
          title: 'Destination User Name',
          width: 120,
          render: (dom, entity) => {
            return getUserName(entity.destinationUser);
          },
        },
        {
          title: 'Destination Method',
          width: 120,
          hideInSearch: true,
          render: (dom, entity) => {
            return entity.destinationPaymentDetails?.method;
          },
        },
        {
          title: 'Destination Amount',
          dataIndex: 'destnationAmountDetails.transactionAmount',
          width: 120,
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
          width: 120,
          hideInSearch: true,
          render: (dom, entity) => {
            return entity.destinationAmountDetails?.transactionCurrency;
          },
        },
        {
          title: 'Destination Country',
          width: 120,
          hideInSearch: true,
          render: (dom, entity) => {
            return entity.destinationAmountDetails?.country;
          },
        },
        {
          title: 'Origin Currencies',
          dataIndex: 'originCurrenciesFilter',
          hideInTable: true,
          width: 120,
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
          width: 120,
          valueType: 'select',
          fieldProps: {
            options: currencies,
            allowClear: true,
            mode: 'multiple',
          },
        },
      ],
      [],
    ),
  );

  const handleResize =
    (index: number) =>
    (_: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
      const newColumns = [...columns];
      newColumns[index] = {
        ...newColumns[index],
        width: size.width,
      };
      setColumns(newColumns);
    };

  const mergeColumns: ProColumns<TransactionCaseManagement>[] = columns.map((col, index) => ({
    ...col,
    onHeaderCell: (column) => ({
      width: (column as ProColumns<TransactionCaseManagement>).width,
      onResize: handleResize(index),
    }),
  }));

  const analytics = useAnalytics();

  const i18n = useI18n();
  const navigate = useNavigate();
  return (
    <PageWrapper title={i18n('menu.transactions.transactions-list')}>
      <Table<TransactionCaseManagement>
        form={{
          labelWrap: true,
        }}
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        actionRef={actionRef}
        rowKey="transactionId"
        search={{
          labelWidth: 120,
        }}
        scroll={{ x: 1300 }}
        request={async (params, sorter) => {
          const {
            pageSize,
            current,
            timestamp,
            transactionId,
            type,
            originCurrenciesFilter,
            destinationCurrenciesFilter,
            originUserId,
            destinationUserId,
          } = params;
          const [sortField, sortOrder] = Object.entries(sorter)[0] ?? [];
          const [response, time] = await measure(() =>
            api.getTransactionsList({
              limit: pageSize!,
              skip: (current! - 1) * pageSize!,
              afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
              beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Date.now(),
              filterId: transactionId,
              filterOriginUserId: originUserId,
              filterDestinationUserId: destinationUserId,
              filterOriginCurrencies: originCurrenciesFilter,
              filterDestinationCurrencies: destinationCurrenciesFilter,
              transactionType: type,
              sortField: sortField ?? undefined,
              sortOrder: sortOrder ?? undefined,
              includeUsers: true,
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
        }}
        columns={mergeColumns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'transaction-list-table',
        }}
      />
      <Drawer
        width={700}
        visible={!isInit(currentItem)}
        onClose={() => {
          navigate('/transactions/transactions-list/all', { replace: true });
        }}
        closable={false}
      >
        <AsyncResourceRenderer resource={currentItem}>
          {(transaction) => <TransactionDetails transaction={transaction} />}
        </AsyncResourceRenderer>
      </Drawer>
    </PageWrapper>
  );
};

export default TableList;
