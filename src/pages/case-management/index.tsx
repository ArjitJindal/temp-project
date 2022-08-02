import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-table';
import { Avatar, Drawer, Tooltip } from 'antd';
import moment from 'moment';
import { ProFormInstance } from '@ant-design/pro-form';
import { Link } from 'react-router-dom';
import { useNavigate, useParams } from 'react-router';
import type { ResizeCallbackData } from 'react-resizable';
import { ExpandedRulesRowRender } from './components/ExpandedRulesRowRender';
import { TransactionDetails } from './components/TransactionDetails';
import { RuleActionStatus } from './components/RuleActionStatus';
import { FormValues } from './types';
import { AddToSlackButton } from './components/AddToSlackButton';
import { PaymentMethodTag } from './components/PaymentTypeTag';
import { currencies } from '@/utils/currencies';
import Table from '@/components/ui/Table';
import { ApiException, TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import { getUserName } from '@/utils/api/users';
import { useUsers } from '@/utils/user-utils';
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
import { useAnalytics } from '@/utils/segment/context';
import { measure } from '@/utils/time-utils';
import { useI18n } from '@/locales';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import '../../components/ui/colors';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import ResizableTitle from '@/utils/table-utils';

function TableList() {
  const { id: transactionId } = useParams<'id'>();
  const [users] = useUsers();
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance<FormValues>>();
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

  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const analytics = useAnalytics();

  // todo: i18n
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
                to={`/case-management/${entity.transactionId}`}
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
          width: 150,
          ellipsis: true,
        },
        {
          title: 'Timestamp',
          width: 130,
          ellipsis: true,
          dataIndex: 'timestamp',
          valueType: 'dateTimeRange',
          sorter: true,
          render: (_, transaction) => {
            return moment(transaction.timestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
          },
        },
        {
          title: 'Rules hit',
          width: 100,
          ellipsis: true,
          hideInSearch: true,
          dataIndex: 'ruleHitCount',
          sorter: true,
          render: (_, transaction) => {
            return `${transaction.executedRules.filter((rule) => rule.ruleHit).length} rule(s)`;
          },
        },
        {
          title: 'Origin (sender) User ID',
          tooltip: 'Origin users are the users initiating the transaction - sending the money',
          width: 180,
          dataIndex: 'originUserId',
          render: (dom, entity) => {
            return entity.originUserId;
          },
        },
        {
          title: 'Origin (sender) User Name',
          tooltip: 'Origin users are the users initiating the transaction - sending the money',
          width: 180,
          render: (dom, entity) => {
            return getUserName(entity.originUser);
          },
        },
        {
          title: 'Origin Method',
          width: 160,
          hideInSearch: true,
          render: (dom, entity) => {
            return <PaymentMethodTag paymentMethod={entity.originPaymentDetails?.method} />;
          },
        },
        {
          title: 'Origin Amount',
          dataIndex: 'originAmountDetails.transactionAmount',
          hideInSearch: true,
          sorter: true,
          width: 120,
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
          hideInSearch: true,
          width: 90,
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
          dataIndex: 'destinationUserId',
          width: 150,
          render: (dom, entity) => {
            return entity.destinationUserId;
          },
        },
        {
          title: 'Destination User Name',
          width: 180,
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
          width: 120,
          dataIndex: 'destnationAmountDetails.transactionAmount',
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
          width: 90,
          hideInSearch: true,
          render: (dom, entity) => {
            return entity.destinationAmountDetails?.transactionCurrency;
          },
        },
        {
          title: 'Destination Country',
          width: 90,
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
            return (
              <AllowForm transactionId={entity.transactionId as string} onSaved={reloadTable} />
            );
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
      [api, reloadTable, updatedTransactions, users],
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
  const [isLoading, setLoading] = useState(false);
  const i18n = useI18n();
  const navigate = useNavigate();

  return (
    <PageWrapper title={i18n('menu.case-management')}>
      <Table<TransactionCaseManagement>
        form={{
          labelWrap: true,
        }}
        onLoadingChange={(isLoading) => {
          setLoading(isLoading === true);
        }}
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        actionRef={actionRef}
        formRef={formRef}
        rowKey="transactionId"
        search={{
          labelWidth: 120,
        }}
        scroll={{ x: 1300 }}
        expandable={{ expandedRowRender: ExpandedRulesRowRender }}
        request={async (params, sorter) => {
          const {
            pageSize,
            current,
            timestamp,
            transactionId,
            rulesHitFilter,
            rulesExecutedFilter,
            originCurrenciesFilter,
            destinationCurrenciesFilter,
            originUserId,
            destinationUserId,
            type,
          } = params;
          const [sortField, sortOrder] = Object.entries(sorter)[0] ?? [];
          const [response, time] = await measure(() =>
            api.getTransactionsList({
              limit: pageSize!,
              skip: (current! - 1) * pageSize!,
              afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
              beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Date.now(),
              filterId: transactionId,
              filterRulesHit: rulesHitFilter,
              filterRulesExecuted: rulesExecutedFilter,
              filterOutStatus: 'ALLOW',
              filterOriginCurrencies: originCurrenciesFilter,
              filterDestinationCurrencies: destinationCurrenciesFilter,
              filterOriginUserId: originUserId,
              filterDestinationUserId: destinationUserId,
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
        toolBarRender={() => [
          <Feature name="SLACK_ALERTS">
            <AddToSlackButton />
          </Feature>,
        ]}
        columns={mergeColumns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'case-management-list',
        }}
      />
      <Drawer
        width={700}
        visible={!isInit(currentItem)}
        onClose={() => {
          navigate('/case-management/all', { replace: true });
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
}

export default TableList;
