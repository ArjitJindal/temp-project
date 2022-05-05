import React, { useState, useRef, useCallback, useMemo } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Avatar, Drawer, Tooltip } from 'antd';
import { ExpandedRulesRowRender } from './components/ExpandedRulesRowRender';
import { TransactionDetails } from './components/TransactionDetails';
import { RuleActionStatus } from './components/RuleActionStatus';
import { TransactionCaseManagement } from '@/apis';
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

  // todo: i18n
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
        title: 'Rules hit',
        width: 100,
        ellipsis: true,
        hideInSearch: true,
        render: (_, transaction) => {
          return `${transaction.executedRules.filter(rule => rule.ruleHit).length} rule(s)`;
        },
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
        search={false}
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
