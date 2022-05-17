import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import type { ActionType, ProColumns } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Avatar, Drawer, Tooltip } from 'antd';
import moment from 'moment';
import { ExpandedRulesRowRender } from './components/ExpandedRulesRowRender';
import { TransactionDetails } from './components/TransactionDetails';
import { RuleActionStatus } from './components/RuleActionStatus';
import { TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import { useUsers } from '@/utils/user-utils';
import { DATE_TIME_FORMAT } from '@/pages/transactions/transactions-list';
import AllowForm from '@/pages/case-management/components/AllowForm';
import GlobalWrapper from '@/components/GlobalWrapper';

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

  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

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
        title: 'Transaction Type',
        dataIndex: 'type',
        width: 100,
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
        title: 'Rules hit',
        width: 100,
        ellipsis: true,
        hideInSearch: true,
        render: (_, transaction) => {
          return `${transaction.executedRules.filter((rule) => rule.ruleHit).length} rule(s)`;
        },
      },
      {
        title: 'Origin User ID',
        width: 100,
        dataIndex: 'originUserId',
        hideInTable: true,
      },
      {
        title: 'Origin Method',
        width: 100,
        render: (dom, entity) => {
          return entity.originPaymentDetails?.method;
        },
      },
      {
        title: 'Origin Amount',
        width: 80,
        render: (dom, entity) => {
          return entity.originAmountDetails?.transactionAmount;
        },
      },
      {
        title: 'Origin Currency',
        width: 80,
        render: (dom, entity) => {
          return entity.originAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Origin Country',
        width: 80,
        render: (dom, entity) => {
          return entity.originAmountDetails?.country;
        },
      },
      {
        title: 'Destination User ID',
        width: 150,
        dataIndex: 'destinationUserId',
        hideInTable: true,
      },
      {
        title: 'Destination Method',
        width: 100,
        render: (dom, entity) => {
          return entity.destinationPaymentDetails?.method;
        },
      },
      {
        title: 'Destination Amount',
        width: 80,
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.transactionAmount;
        },
      },
      {
        title: 'Destination Currency',
        width: 80,
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Destination Country',
        width: 80,
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
        title: 'Operations',
        sorter: true,
        width: 120,
        render: (dom, entity) => {
          return <AllowForm transactionId={entity.transactionId as string} onSaved={reloadTable} />;
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
    [reloadTable, updatedTransactions, users],
  );

  return (
    <GlobalWrapper>
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
            const { pageSize, current, timestamp, transactionId } = params;
            const response = await api.getTransactionsList({
              limit: pageSize!,
              skip: (current! - 1) * pageSize!,
              filterId: transactionId,
              filterOutStatus: 'ALLOW',
              afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
              beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Date.now(),
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
    </GlobalWrapper>
  );
};

export default TableList;
