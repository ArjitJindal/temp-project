import React, { useState, useRef, useMemo } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Drawer } from 'antd';
import { TransactionDetails } from './components/TransactionDetails';
import styles from './components/TransactionDetails.less';

import { TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';

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
        valueType: 'dateTime',
      },
      {
        title: 'Origin User ID',
        dataIndex: 'originUserId',
        hideInTable: true,
      },
      {
        title: 'Origin Method',
        render: (dom, entity) => {
          return entity.originPaymentDetails?.method;
        },
      },
      {
        title: 'Origin Amount',
        render: (dom, entity) => {
          return entity.originAmountDetails?.transactionAmount;
        },
      },
      {
        title: 'Origin Currency',
        render: (dom, entity) => {
          return entity.originAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Origin Country',
        render: (dom, entity) => {
          return entity.originAmountDetails?.country;
        },
      },
      {
        title: 'Destination User ID',
        dataIndex: 'destinationUserId',
        hideInTable: true,
      },
      {
        title: 'Destination Method',
        render: (dom, entity) => {
          return entity.destinationPaymentDetails?.method;
        },
      },
      {
        title: 'Destination Amount',
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.transactionAmount;
        },
      },
      {
        title: 'Destination Currency',
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Destination Country',
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
          const response = await api.getTransactionsList({
            limit: params.pageSize!,
            skip: (params.current! - 1) * params.pageSize!,
            beforeTimestamp: Date.now(),
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
