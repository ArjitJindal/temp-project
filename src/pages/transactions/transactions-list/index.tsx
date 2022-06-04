import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Drawer } from 'antd';
import moment from 'moment';
import { IRouteComponentProps, Link } from 'umi';
import { TransactionDetails } from './components/TransactionDetails';
import styles from './components/TransactionDetails.less';

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

// todo: move to config
export const DATE_TIME_FORMAT = 'L LTS';

const TableList = (
  props: IRouteComponentProps<{
    id?: string;
  }>,
) => {
  const actionRef = useRef<ActionType>();
  const [currentItem, setCurrentItem] = useState<AsyncResource<TransactionCaseManagement>>(init());
  const api = useApi();

  const transactionId = props.match.params.id;
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
              to={`/transactions/transactions-list/${entity.transactionId}`}
              onClick={() => {
                setCurrentItem(success(entity));
              }}
              replace
            >
              {dom}
            </Link>
          );
        },
      },
      {
        title: 'Transaction Type',
        dataIndex: 'type',
        width: 150,
        ellipsis: true,
      },
      {
        title: 'Timestamp',
        width: 130,
        ellipsis: true,
        dataIndex: 'timestamp',
        valueType: 'dateTimeRange',
        render: (_, transaction) => {
          return moment(transaction.timestamp).format(DATE_TIME_FORMAT);
        },
      },
      {
        title: 'Origin User ID',
        dataIndex: 'originUserId',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.originUserId;
        }
      },
      {
        title: 'Origin Method',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.originPaymentDetails?.method;
        },
      },
      {
        title: 'Origin Amount',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.originAmountDetails?.transactionAmount;
        },
      },
      {
        title: 'Origin Currency',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.originAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Origin Country',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.originAmountDetails?.country;
        },
      },
      {
        title: 'Destination User ID',
        dataIndex: 'deatinationUserId',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationUserId;
        }
      },
      {
        title: 'Destination Method',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationPaymentDetails?.method;
        },
      },
      {
        title: 'Destination Amount',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.transactionAmount;
        },
      },
      {
        title: 'Destination Currency',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Destination Country',
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.country;
        },
      },
    ],
    [],
  );

  return (
    <PageWrapper>
      <ProTable<TransactionCaseManagement>
        rowClassName={(record, index) =>
          index % 2 === 0 ? styles.tableRowLight : styles.tableRowDark
        }
        form={{
          labelWrap: true,
        }}
        headerTitle="Transactions"
        actionRef={actionRef}
        rowKey="transactionId"
        search={{
          labelWidth: 120,
        }}
        scroll={{ x: 1300 }}
        request={async (params) => {
          const { pageSize, current, timestamp, transactionId, type } = params;
          const response = await api.getTransactionsList({
            limit: pageSize!,
            skip: (current! - 1) * pageSize!,
            afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
            beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Date.now(),
            filterId: transactionId,
            transactionType: type,
          });
          return {
            data: response.data,
            success: true,
            total: response.total,
          };
        }}
        columns={columns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'transaction-list-table',
        }}
      />
      <Drawer
        width={700}
        visible={!isInit(currentItem)}
        onClose={() => {
          props.history.replace('/transactions/transactions-list/all');
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
