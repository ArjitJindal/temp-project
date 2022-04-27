import React, { useState, useRef, useCallback, useMemo } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Avatar, Drawer, Tooltip } from 'antd';
import { ExpandedRulesRowRender } from './components/ExpandedRulesRowRender';
import { TransactionDetails } from './components/TransactionDetails';
import { RuleActionStatus } from './components/RuleActionStatus';
import { TransactionCaseManagement } from '@/apis';
import { FileImportButton } from '@/components/file-import/FileImportButton';
import { useApi } from '@/api';
import { useUsers } from '@/utils/user-utils';

const TableList: React.FC = () => {
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [users] = useUsers();
  const actionRef = useRef<ActionType>();
  const [currentRow, setCurrentRow] = useState<TransactionCaseManagement>();
  const [updatedTransactions, setUpdatedTransactions] = useState<{
    [key: string]: TransactionCaseManagement;
  }>({});
  const handleTransactionUpdate = useCallback(async (newTransaction: TransactionCaseManagement) => {
    const transactionId = newTransaction.transactionId as string;
    setUpdatedTransactions((prev) => ({
      ...prev,
      [transactionId]: newTransaction,
    }));
  }, []);
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
        title: 'Status',
        sorter: true,
        width: 120,
        render: (dom, entity) => {
          const transaction = updatedTransactions[entity.transactionId as string] || entity;
          return <RuleActionStatus ruleAction={transaction.status} />;
        },
      },
      {
        title: 'Assignees',
        width: 100,
        ellipsis: true,
        render: (dom, entity) => {
          const transaction = updatedTransactions[entity.transactionId as string] || entity;
          return (
            <Avatar.Group maxCount={3}>
              {transaction.assignments?.map((assignment) => (
                <Tooltip
                  key={assignment.assigneeUserId}
                  title={users[assignment.assigneeUserId]?.name}
                >
                  <Avatar size="small" src={users[assignment.assigneeUserId]?.picture} />
                </Tooltip>
              ))}
            </Avatar.Group>
          );
        },
      },
    ],
    [updatedTransactions, users],
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
        search={{
          labelWidth: 120,
        }}
        scroll={{ x: 1300 }}
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
        toolBarRender={() => [<FileImportButton type="TRANSACTION" />]}
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
            onTransactionUpdate={handleTransactionUpdate}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default TableList;
