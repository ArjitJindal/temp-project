import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Avatar, Drawer, Tooltip } from 'antd';
import moment from 'moment';
import { IRouteComponentProps, Link } from 'umi';
import { ExpandedRulesRowRender } from './components/ExpandedRulesRowRender';
import { TransactionDetails } from './components/TransactionDetails';
import { RuleActionStatus } from './components/RuleActionStatus';
import { ApiException, TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import { useUsers } from '@/utils/user-utils';
import { DATE_TIME_FORMAT } from '@/pages/transactions/transactions-list';
import AllowForm from '@/pages/case-management/components/AllowForm';
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
import PageWrapper from '@/components/PageWrapper';

const TableList = (
  props: IRouteComponentProps<{
    id?: string;
  }>,
) => {
  const [users] = useUsers();
  const actionRef = useRef<ActionType>();
  const [currentItem, setCurrentItem] = useState<AsyncResource<TransactionCaseManagement>>(init());
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
          message = `Unable to find сфыу by id "${transactionId}"`;
        } else if (e instanceof Error && e.message) {
          message = e.message;
        }
        setCurrentItem(failed(message));
      });
    return () => {
      isCanceled = true;
    };
  }, [currentTransactionId, transactionId, api]);

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
          // todo: fix style
          return (
            <Link
              to={`/case-management/${entity.transactionId}`}
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
        hideInSearch: true,
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
        hideInSearch: true,
        hideInTable: true,
      },
      {
        title: 'Origin Method',
        width: 100,
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.originPaymentDetails?.method;
        },
      },
      {
        title: 'Origin Amount',
        hideInSearch: true,
        width: 80,
        render: (dom, entity) => {
          return entity.originAmountDetails?.transactionAmount;
        },
      },
      {
        title: 'Origin Currency',
        hideInSearch: true,
        width: 80,
        render: (dom, entity) => {
          return entity.originAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Origin Country',
        hideInSearch: true,
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
        hideInSearch: true,
      },
      {
        title: 'Destination Method',
        width: 100,
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationPaymentDetails?.method;
        },
      },
      {
        title: 'Destination Amount',
        width: 80,
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.transactionAmount;
        },
      },
      {
        title: 'Destination Currency',
        width: 80,
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Destination Country',
        width: 80,
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.country;
        },
      },
      {
        title: 'Status',
        sorter: true,
        hideInSearch: true,
        width: 120,
        render: (dom, entity) => {
          const transaction = updatedTransactions[entity.transactionId as string] || entity;
          return <RuleActionStatus ruleAction={transaction.status} />;
        },
      },
      {
        title: 'Operations',
        hideInSearch: true,
        sorter: true,
        width: 120,
        render: (dom, entity) => {
          return <AllowForm transactionId={entity.transactionId as string} onSaved={reloadTable} />;
        },
      },
      {
        title: 'Assignees',
        hideInSearch: true,
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
      {
        title: 'Rules Hit',
        dataIndex: 'rulesHitFilter',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        request: async () => {
          const rules = await api.getRules();
          return rules.map((rule) => ({
            value: rule.id,
            label: `${rule.name} (${rule.id})`,
          }));
        },
        fieldProps: {
          allowClear: true,
          mode: 'multiple',
        },
      },
      {
        title: 'Rules Executed',
        dataIndex: 'rulesExecutedFilter',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        request: async () => {
          const rules = await api.getRules();
          return rules.map((rule) => ({
            value: rule.id,
            label: `${rule.name} (${rule.id})`,
          }));
        },
        fieldProps: {
          allowClear: true,
          mode: 'multiple',
        },
      },
    ],
    [api, reloadTable, updatedTransactions, users],
  );

  return (
    <PageWrapper>
      <ProTable<TransactionCaseManagement>
        form={{
          labelWrap: true,
        }}
        actionRef={actionRef}
        rowKey="transactionId"
        search={{
          labelWidth: 120,
        }}
        scroll={{ x: 1300 }}
        expandable={{ expandedRowRender: ExpandedRulesRowRender }}
        request={async (params) => {
          const {
            pageSize,
            current,
            timestamp,
            transactionId,
            rulesHitFilter,
            rulesExecutedFilter,
          } = params;
          const response = await api.getTransactionsList({
            limit: pageSize!,
            skip: (current! - 1) * pageSize!,
            afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
            beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Date.now(),
            filterId: transactionId,
            filterRulesHit: rulesHitFilter,
            filterRulesExecuted: rulesExecutedFilter,
            filterOutStatus: 'ALLOW',
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
          persistenceKey: 'case-management-list',
        }}
      />
      <Drawer
        width={700}
        visible={!isInit(currentItem)}
        onClose={() => {
          props.history.replace('/case-management/all');
        }}
        closable={false}
      >
        <AsyncResourceRenderer resource={currentItem}>
          {(transaction) => (
            <TransactionDetails
              transaction={
                (transaction.transactionId
                  ? updatedTransactions[transaction.transactionId]
                  : null) ?? transaction
              }
              onTransactionUpdate={handleTransactionUpdate}
            />
          )}
        </AsyncResourceRenderer>
      </Drawer>
    </PageWrapper>
  );
};

export default TableList;
