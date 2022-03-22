import React, { useState, useRef } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Drawer } from 'antd';
import { ExpandedRulesRowRender } from './components/ExpandedRulesRowRender';
import { TransactionDetails } from './components/TransactionDetails';
import { ImportRequestTypeEnum, TransactionCaseManagement } from '@/apis';
import { FileImportButton } from '@/components/file-import/FileImportButton';
import { useApi } from '@/api';

const TableList: React.FC = () => {
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const actionRef = useRef<ActionType>();
  const [currentRow, setCurrentRow] = useState<TransactionCaseManagement>();
  const [updatedTransactions, setUpdatedTransactions] = useState<{
    [key: string]: TransactionCaseManagement;
  }>({});
  const api = useApi();

  const columns: ProColumns<TransactionCaseManagement>[] = [
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
      dataIndex: 'timestamp',
      valueType: 'dateTime',
    },
    {
      title: 'Sender User ID',
      dataIndex: 'senderUserId',
      hideInTable: true,
    },
    {
      title: 'Sender Method',
      render: (dom, entity) => {
        return entity.senderPaymentDetails?.method;
      },
    },
    {
      title: 'Sending Amount',
      render: (dom, entity) => {
        return entity.sendingAmountDetails?.transactionAmount;
      },
    },
    {
      title: 'Sending Currency',
      render: (dom, entity) => {
        return entity.sendingAmountDetails?.transactionCurrency;
      },
    },
    {
      title: 'Sending Country',
      render: (dom, entity) => {
        return entity.sendingAmountDetails?.country;
      },
    },
    {
      title: 'Receiver User ID',
      dataIndex: 'receiverUserId',
      hideInTable: true,
    },
    {
      title: 'Receiver Method',
      render: (dom, entity) => {
        return entity.receiverPaymentDetails?.method;
      },
    },
    {
      title: 'Receiving Amount',
      render: (dom, entity) => {
        return entity.receivingAmountDetails?.transactionAmount;
      },
    },
    {
      title: 'Receiving Currency',
      render: (dom, entity) => {
        return entity.receivingAmountDetails?.transactionCurrency;
      },
    },
    {
      title: 'Receiving Country',
      render: (dom, entity) => {
        return entity.receivingAmountDetails?.country;
      },
    },
    {
      title: 'Rules hit',
      sorter: true,
      width: 80,
      render: (dom, entity) => {
        return `${entity.executedRules.filter((rule) => rule.ruleHit).length} Rule(s)`;
      },
    },
  ];

  return (
    <PageContainer>
      <ProTable<TransactionCaseManagement>
        headerTitle="Transactions"
        actionRef={actionRef}
        rowKey="transactionId"
        search={{
          labelWidth: 120,
        }}
        expandable={{ expandedRowRender: ExpandedRulesRowRender }}
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
        toolBarRender={() => [<FileImportButton type={ImportRequestTypeEnum.Transaction} />]}
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
        {currentRow?.transactionId && (
          <TransactionDetails
            transaction={updatedTransactions[currentRow.transactionId] || currentRow}
            onTransactionUpdate={(newTransaction) =>
              setUpdatedTransactions((prev) => ({
                ...prev,
                [newTransaction.transactionId!]: newTransaction,
              }))
            }
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default TableList;
