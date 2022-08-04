import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-table';
import { Drawer, message } from 'antd';
import moment from 'moment';
import { ProFormInstance } from '@ant-design/pro-form';
import { Link } from 'react-router-dom';
import { useNavigate, useParams } from 'react-router';
import type { ResizeCallbackData } from 'react-resizable';
import { TransactionDetails } from './components/TransactionDetails';
import { RuleActionStatus } from './components/RuleActionStatus';
import { FormValues } from './types';
import { AddToSlackButton } from './components/AddToSlackButton';
import { PaymentMethodTag } from './components/PaymentTypeTag';
import { AssigneesDropdown } from './components/AssigneesDropdown';
import { currencies } from '@/utils/currencies';
import Table from '@/components/ui/Table';
import { ApiException, TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import { getUserName } from '@/utils/api/users';
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
import { useAuth0User } from '@/utils/user-utils';

export type CaseManagementItem = TransactionCaseManagement & {
  index: number;
  transactionId?: string;
  isFirstRow: boolean;
  isLastRow: boolean;
  rowSpan: number;
  ruleName: string | null;
  ruleDescription: string | null;
  rowKey: string;
};

function TableList() {
  const { id: transactionId } = useParams<'id'>();
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance<FormValues>>();
  const user = useAuth0User();
  const [currentItem, setCurrentItem] = useState<AsyncResource<TransactionCaseManagement>>(init());
  const [updatedTransactions, setUpdatedTransactions] = useState<{
    [key: string]: TransactionCaseManagement;
  }>({});
  const [updatedColumnWidth, setUpdatedColumnWidth] = useState<{
    [key: number]: number;
  }>({});
  const [saving, setSaving] = useState(false);
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
  const handleUpdateAssignments = useCallback(
    async (transaction: TransactionCaseManagement, assignees: string[]) => {
      const hideMessage = message.loading(`Saving...`, 0);
      const assignments = assignees.map((assigneeUserId) => ({
        assignedByUserId: user.userId,
        assigneeUserId,
        timestamp: Date.now(),
      }));
      try {
        setSaving(true);
        handleTransactionUpdate({
          ...transaction,
          assignments,
        });
        await api.postTransactionsTransactionId({
          transactionId: transaction.transactionId as string,
          TransactionUpdateRequest: {
            assignments,
          },
        });
        message.success('Saved');
      } catch (e) {
        message.error('Failed to save');
      } finally {
        hideMessage();
        setSaving(false);
      }
    },
    [api, handleTransactionUpdate, user.userId],
  );
  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);
  const analytics = useAnalytics();
  // todo: i18n
  const columns: ProColumns<CaseManagementItem>[] = useMemo(
    () => [
      {
        title: 'Transaction ID',
        dataIndex: 'transactionId',
        width: 130,
        copyable: true,
        ellipsis: true,
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
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
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
      },
      {
        title: 'Rules Hit',
        width: 150,
        dataIndex: 'ruleName',
      },
      {
        title: 'Rules Description',
        tooltip: 'Describes the conditions required for this rule to be hit.',
        width: 270,
        dataIndex: 'ruleDescription',
      },
      {
        title: 'Timestamp',
        width: 130,
        ellipsis: true,
        dataIndex: 'timestamp',
        valueType: 'dateTimeRange',
        sorter: true,
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        render: (_, transaction) => {
          return moment(transaction.timestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
        },
      },
      {
        title: 'Origin (sender) User ID',
        tooltip: 'Origin users are the users initiating the transaction - sending the money',
        width: 180,
        dataIndex: 'originUserId',
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        render: (dom, entity) => {
          return entity.originUserId;
        },
      },
      {
        title: 'Origin (sender) User Name',
        tooltip: 'Origin users are the users initiating the transaction - sending the money',
        width: 180,
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        render: (dom, entity) => {
          return getUserName(entity.originUser);
        },
      },
      {
        title: 'Origin Method',
        width: 160,
        hideInSearch: true,
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
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
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
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
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        render: (dom, entity) => {
          return entity.originAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Origin Country',
        hideInSearch: true,
        width: 80,
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        render: (dom, entity) => {
          return entity.originAmountDetails?.country;
        },
      },
      {
        title: 'Destination User ID',
        dataIndex: 'destinationUserId',
        width: 150,
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        render: (dom, entity) => {
          return entity.destinationUserId;
        },
      },
      {
        title: 'Destination User Name',
        width: 180,
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        render: (dom, entity) => {
          return getUserName(entity.destinationUser);
        },
      },
      {
        title: 'Destination Method',
        width: 160,
        hideInSearch: true,
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
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
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
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
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
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
        dataIndex: 'status',
        hideInSearch: false,
        valueType: 'select',
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        fieldProps: {
          options: ['FLAG', 'BLOCK', 'SUSPEND', 'WHITELIST'],
          allowClear: true,
        },
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
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        render: (dom, entity) => {
          return <AllowForm transactionId={entity.transactionId as string} onSaved={reloadTable} />;
        },
      },
      {
        title: 'Assignees',
        hideInSearch: true,
        width: 300,
        ellipsis: true,
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        render: (dom, entity) => {
          const transaction = updatedTransactions[entity.transactionId as string] || entity;
          return (
            <AssigneesDropdown
              assignments={transaction.assignments || []}
              editing={true}
              onChange={(assignees) => handleUpdateAssignments(transaction, assignees)}
            />
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
    [api, handleUpdateAssignments, reloadTable, updatedTransactions],
  );
  const handleResize =
    (index: number) =>
    (_: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
      setUpdatedColumnWidth((prev) => ({
        ...prev,
        [index]: size.width,
      }));
    };
  const mergeColumns: ProColumns<CaseManagementItem>[] = columns.map((col, index) => ({
    ...col,
    width: updatedColumnWidth[index] || col.width,
    onHeaderCell: (column) => ({
      width: (column as ProColumns<CaseManagementItem>).width,
      onResize: handleResize(index),
    }),
  }));
  const [isLoading, setLoading] = useState(false);
  const i18n = useI18n();
  const navigate = useNavigate();
  return (
    <PageWrapper title={i18n('menu.case-management')}>
      <Table<CaseManagementItem>
        form={{
          labelWrap: true,
        }}
        onLoadingChange={(isLoading) => {
          setLoading(isLoading === true);
        }}
        isEvenRow={(item) => item.index % 2 === 0}
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        actionRef={actionRef}
        formRef={formRef}
        rowKey="rowKey"
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
            rulesHitFilter,
            rulesExecutedFilter,
            originCurrenciesFilter,
            destinationCurrenciesFilter,
            originUserId,
            destinationUserId,
            type,
            status,
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
              filterStatus: status,
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
          const data: CaseManagementItem[] = response.data.reduce(
            (acc, item, index): CaseManagementItem[] => {
              const dataItem = {
                index,
                rowKey: item.transactionId ?? `${index}`,
                isFirstRow: true,
                isLastRow: true,
                ruleName: null,
                ruleDescription: null,
                ...item,
                rowSpan: 1,
              };
              return [
                ...acc,
                ...item.hitRules.map(
                  (rule, i): CaseManagementItem => ({
                    ...dataItem,
                    rowSpan: i === 0 ? item.hitRules.length : 0,
                    isFirstRow: i === 0,
                    isLastRow: i === item.hitRules.length - 1,
                    rowKey: `${item.transactionId}#${i}`,
                    ruleName: rule.ruleName,
                    ruleDescription: rule.ruleDescription,
                  }),
                ),
              ];
            },
            [] as CaseManagementItem[],
          );

          return {
            data: data,
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
