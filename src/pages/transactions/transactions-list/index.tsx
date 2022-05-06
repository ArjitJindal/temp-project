import React, { useState, useRef, useMemo } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Drawer } from 'antd';
import moment from 'moment';
import { TransactionDetails } from './components/TransactionDetails';
import { TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';

// todo: move to config
export const DATE_TIME_FORMAT = 'L LTS';

const TableList: React.FC = () => {
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const actionRef = useRef<ActionType>();
  const [currentRow, setCurrentRow] = useState<TransactionCaseManagement>();
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
          return (
            <a
              onClick={() => {
                setCurrentRow(entity);
                setShowDetail(true);
              }}
            >
              {dom}
            </a>
          );
        },
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
        hideInTable: true,
        hideInSearch: true,
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
        dataIndex: 'destinationUserId',
        hideInTable: true,
        hideInSearch: true,
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
    <PageContainer>
      <ProTable<TransactionCaseManagement>
        form={{
          labelWrap: true,
        }}
        headerTitle="Transactions"
        actionRef={actionRef}
        rowKey="transactionId"
        search={false}
        scroll={{ x: 1300 }}
        request={async (params) => {
          const { pageSize, current, timestamp, transactionId } = params;
          const response = await api.getTransactionsList({
            limit: pageSize!,
            skip: (current! - 1) * pageSize!,
            afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
            beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Date.now(),
            filterId: transactionId,
          });
          return {
            data: response.data,
            success: true,
            total: response.total,
          };
        }}
        columns={columns}
      />
      <Drawer
        width={700}
        visible={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
      >
        {currentRow?.transactionId && <TransactionDetails transaction={currentRow} />}
      </Drawer>
    </PageContainer>
  );
};

export default TableList;
