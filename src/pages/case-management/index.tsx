import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-table';
import { message, Tabs } from 'antd';
import moment from 'moment';
import { ProFormInstance } from '@ant-design/pro-form';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router';
import StateSearchButton from '../transactions/components/TransactionStateButton';
import { TableSearchParams } from './types';
import styles from './CaseManagement.module.less';
import { AddToSlackButton } from './components/AddToSlackButton';
import { AssigneesDropdown } from './components/AssigneesDropdown';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import { currencies } from '@/utils/currencies';
import { RequestFunctionType, Table, TableActionType } from '@/components/ui/Table';
import { TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import { getUserName } from '@/utils/api/users';
import CaseStatusChangeForm from '@/pages/case-management/components/CaseStatusChangeForm';
import { AsyncResource, init, success } from '@/utils/asyncResource';
import PageWrapper from '@/components/PageWrapper';
import { useAnalytics } from '@/utils/segment/context';
import { measure } from '@/utils/time-utils';
import { useI18n } from '@/locales';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import ResizableTitle from '@/utils/table-utils';
import { useAuth0User } from '@/utils/user-utils';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { useDeepEqualEffect } from '@/utils/hooks';
import { queryAdapter } from '@/pages/case-management/helpers';
import UserLink from '@/components/UserLink';
import handleResize from '@/components/ui/Table/utils';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { TransactionType } from '@/apis/models/TransactionType';
import { paymentMethod, transactionType } from '@/utils/tags';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import TransactionStatusButton from '@/pages/transactions/components/TransactionStatusButton';

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
  const actionRef = useRef<TableActionType>(null);
  const formRef = useRef<ProFormInstance<TableSearchParams>>();
  const user = useAuth0User();
  const [, setCurrentItem] = useState<AsyncResource<TransactionCaseManagement>>(init());
  const [, setLastSearchParams] = useState<TableSearchParams>({});
  const [isOpenTab, setIsOpenTab] = useState<boolean>(true);
  const [updatedTransactions, setUpdatedTransactions] = useState<{
    [key: string]: TransactionCaseManagement;
  }>({});
  const [updatedColumnWidth, setUpdatedColumnWidth] = useState<{
    [key: number]: number;
  }>({});
  const handleTransactionUpdate = useCallback(async (newTransaction: TransactionCaseManagement) => {
    const transactionId = newTransaction.transactionId as string;
    setUpdatedTransactions((prev) => ({
      ...prev,
      [transactionId]: newTransaction,
    }));
  }, []);
  const api = useApi();
  const handleUpdateAssignments = useCallback(
    async (transaction: TransactionCaseManagement, assignees: string[]) => {
      const hideMessage = message.loading(`Saving...`, 0);
      const assignments = assignees.map((assigneeUserId) => ({
        assignedByUserId: user.userId,
        assigneeUserId,
        timestamp: Date.now(),
      }));
      try {
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
      }
    },
    [api, handleTransactionUpdate, user.userId],
  );
  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);
  const analytics = useAnalytics();
  const navigate = useNavigate();

  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));

  useDeepEqualEffect(() => {
    const form = formRef.current;
    if (form) {
      form.setFields(Object.entries(parsedParams).map(([name, value]) => ({ name, value })));
      form.submit();
    }
  }, [parsedParams]);

  const pushParamsToNavigation = useCallback(
    (params: TableSearchParams) => {
      navigate(makeUrl('/case-management', {}, queryAdapter.serializer(params)), {
        replace: true,
      });
    },
    [navigate],
  );

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
              to={`/case-management/case/${entity.transactionId}`}
              onClick={() => {
                setLastSearchParams(parsedParams);
                setCurrentItem(success(entity));
              }}
              style={{ color: '@fr-colors-brandBlue' }}
            >
              {entity.transactionId}
            </Link>
          );
        },
      },
      {
        title: 'Transaction Type',
        dataIndex: 'type',
        width: 175,
        ellipsis: true,
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        valueType: 'select',
        fieldProps: {
          options: transactionType,
          allowClear: true,
        },
        render: (dom, entity) => {
          return <TransactionTypeTag transactionType={entity.type as TransactionType} />;
        },
      },
      {
        title: 'Rules Hit',
        hideInSearch: true,
        width: 150,
        dataIndex: 'ruleName',
      },
      {
        title: 'Rules Description',
        tooltip: 'Describes the conditions required for this rule to be hit.',
        width: 270,
        hideInSearch: true,
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
          return <TimestampDisplay timestamp={transaction.timestamp} />;
        },
      },
      {
        title: 'Transaction State',
        width: 130,
        ellipsis: true,
        dataIndex: 'transactionState',
        hideInSearch: true,
        sorter: true,
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
      },
      {
        title: 'Origin',
        hideInSearch: true,
        children: [
          {
            title: 'Origin User ID',
            tooltip: 'Origin is the Sender in a transaction',
            width: 200,
            copyable: true,
            ellipsis: true,
            dataIndex: 'originUserId',
            hideInSearch: true,
            onCell: (_) => ({
              rowSpan: _.rowSpan,
            }),
            render: (dom, entity) => {
              if (!entity.originUser) return entity.originUserId;
              return <UserLink user={entity.originUser}>{String(entity.originUserId)}</UserLink>;
            },
          },
          {
            title: 'Origin User Name',
            tooltip: 'Origin is the Sender in a transaction',
            width: 220,
            hideInSearch: true,
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
            width: 150,
            onCell: (_) => ({
              rowSpan: _.rowSpan,
            }),
            render: (dom, entity) => {
              if (entity.originAmountDetails?.transactionAmount !== undefined) {
                return new Intl.NumberFormat().format(
                  entity.originAmountDetails?.transactionAmount,
                );
              } else {
                return entity.originAmountDetails?.transactionAmount;
              }
            },
          },
          {
            title: 'Origin Currency',
            hideInSearch: true,
            width: 140,
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
            width: 140,
            onCell: (_) => ({
              rowSpan: _.rowSpan,
            }),
            render: (dom, entity) => {
              return <CountryDisplay isoCode={entity.originAmountDetails?.country} />;
            },
          },
        ],
      },
      {
        title: 'Destination',
        hideInSearch: true,
        children: [
          {
            title: 'Destination User ID',
            tooltip: 'Destination is the Receiver in a transaction',
            dataIndex: 'destinationUserId',
            copyable: true,
            ellipsis: true,
            hideInSearch: true,
            width: 170,
            onCell: (_) => ({
              rowSpan: _.rowSpan,
            }),
            render: (dom, entity) => {
              if (!entity.destinationUser) return entity.destinationUserId;
              return (
                <UserLink user={entity.destinationUser}>
                  {String(entity.destinationUserId)}
                </UserLink>
              );
            },
          },
          {
            title: 'Destination User Name',
            tooltip: 'Destination is the Receiver in a transaction',
            width: 180,
            hideInSearch: true,
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
            width: 200,
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
            width: 200,
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
            width: 200,
            hideInSearch: true,
            onCell: (_) => ({
              rowSpan: _.rowSpan,
            }),
            render: (dom, entity) => {
              return <CountryDisplay isoCode={entity.destinationAmountDetails?.country} />;
            },
          },
        ],
      },
      {
        title: 'Transaction Status',
        sorter: true,
        dataIndex: 'status',
        hideInSearch: true,
        valueType: 'select',
        onCell: (_) => ({
          rowSpan: _.rowSpan,
        }),
        fieldProps: {
          options: ['FLAGGED', 'BLOCKED', 'SUSPENDED', 'WHITELISTED'],
          allowClear: true,
        },
        width: 200,
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
          return (
            <CaseStatusChangeForm
              transactionId={entity.transactionId as string}
              newCaseStatus={isOpenTab ? 'CLOSED' : 'REOPENED'}
              onSaved={reloadTable}
            />
          );
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
      {
        title: 'Origin Method',
        hideInTable: true,
        width: 120,
        dataIndex: 'originMethodFilter',
        valueType: 'select',
        fieldProps: {
          options: paymentMethod,
          allowClear: true,
        },
      },
      {
        title: 'Destination Method',
        hideInTable: true,
        width: 120,
        dataIndex: 'destinationMethodFilter',
        valueType: 'select',
        fieldProps: {
          options: paymentMethod,
          allowClear: true,
        },
      },
    ],
    [parsedParams, api, handleUpdateAssignments, reloadTable, updatedTransactions, isOpenTab],
  );

  const mergeColumns: ProColumns<CaseManagementItem>[] = columns.map((col, index) => ({
    ...col,
    width: updatedColumnWidth[index] || col.width,
    onHeaderCell: (column) => ({
      width: (column as ProColumns<CaseManagementItem>).width,
      onResize: handleResize(index, setUpdatedColumnWidth),
    }),
  }));
  const i18n = useI18n();

  const request: RequestFunctionType<CaseManagementItem, TableSearchParams> = useCallback(
    async (params, sorter) => {
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
        userId,
        type,
        status,
        transactionState,
        originMethodFilter,
        destinationMethodFilter,
      } = params;
      const [sortField, sortOrder] = Object.entries(sorter)[0] ?? [];
      pushParamsToNavigation(params);
      const [response, time] = await measure(() =>
        api.getTransactionsList({
          limit: pageSize!,
          skip: (current! - 1) * pageSize!,
          afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
          beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Date.now(),
          filterId: transactionId,
          filterRulesHit: rulesHitFilter,
          filterRulesExecuted: rulesExecutedFilter,
          filterOutStatus: isOpenTab ? 'ALLOW' : undefined,
          filterOutCaseStatus: isOpenTab ? 'CLOSED' : undefined,
          filterTransactionState: transactionState,
          filterCaseStatus: isOpenTab ? undefined : 'CLOSED',
          filterStatus: status,
          filterOriginCurrencies: originCurrenciesFilter,
          filterDestinationCurrencies: destinationCurrenciesFilter,
          filterUserId: userId,
          filterOriginUserId: originUserId,
          filterDestinationUserId: destinationUserId,
          transactionType: type,
          sortField: sortField ?? undefined,
          sortOrder: sortOrder ?? undefined,
          includeUsers: true,
          includeEvents: true,
          filterOriginPaymentMethod: originMethodFilter,
          filterDestinationPaymentMethod: destinationMethodFilter,
        }),
      );
      analytics.event({
        title: 'Table Loaded',
        time,
      });
      const data: CaseManagementItem[][] = response.data.map(
        (item, index): CaseManagementItem[] => {
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
          if (item.hitRules.length === 0) {
            return [dataItem];
          }
          return item.hitRules.map(
            (rule, i): CaseManagementItem => ({
              ...dataItem,
              rowSpan: i === 0 ? item.hitRules.length : 0,
              isFirstRow: i === 0,
              isLastRow: i === item.hitRules.length - 1,
              rowKey: `${item.transactionId}#${i}`,
              ruleName: rule.ruleName,
              ruleDescription: rule.ruleDescription,
            }),
          );
        },
      );

      return {
        data: data,
        success: true,
        total: response.total,
      };
    },
    [analytics, api, pushParamsToNavigation, isOpenTab],
  );

  return (
    <PageWrapper title={i18n('menu.case-management')}>
      <div className={styles.tab}>
        <Tabs
          type="line"
          destroyInactiveTabPane={true}
          onChange={(key) => {
            setIsOpenTab(key === 'open');
          }}
        >
          <Tabs.TabPane tab="Open" key="open">
            <Table<CaseManagementItem, TableSearchParams>
              actionsHeader={[
                ({ params, setParams }) => (
                  <>
                    <TransactionStatusButton
                      status={params.params.status ?? undefined}
                      onConfirm={(value) => {
                        setParams((state) => ({
                          ...state,
                          params: { ...state.params, status: value ?? undefined },
                        }));
                      }}
                    />
                    <UserSearchButton
                      userId={params.params.userId ?? null}
                      onConfirm={(userId) => {
                        setParams((state) => ({
                          ...state,
                          params: { ...state.params, userId: userId ?? undefined },
                        }));
                      }}
                    />
                    <StateSearchButton
                      transactionState={params.params.transactionState ?? undefined}
                      onConfirm={(value) => {
                        setParams((state) => ({
                          ...state,
                          params: { ...state.params, transactionState: value ?? undefined },
                        }));
                      }}
                    />
                  </>
                ),
              ]}
              initialParams={{
                page: parsedParams.current ?? 1,
                params: parsedParams,
                sort: {},
              }}
              form={{
                labelWrap: true,
              }}
              bordered
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
              request={request}
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
              onReset={() => {
                pushParamsToNavigation({});
              }}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Closed" key="closed">
            <Table<CaseManagementItem, TableSearchParams>
              actionsHeader={[
                ({ params, setParams }) => (
                  <>
                    <TransactionStatusButton
                      status={params.params.status ?? undefined}
                      onConfirm={(value) => {
                        setParams((state) => ({
                          ...state,
                          params: { ...state.params, status: value ?? undefined },
                        }));
                      }}
                    />
                    <UserSearchButton
                      userId={params.params.userId ?? null}
                      onConfirm={(userId) => {
                        setParams((state) => ({
                          ...state,
                          params: { ...state.params, userId: userId ?? undefined },
                        }));
                      }}
                    />
                    <StateSearchButton
                      transactionState={params.params.transactionState ?? undefined}
                      onConfirm={(value) => {
                        setParams((state) => ({
                          ...state,
                          params: { ...state.params, transactionState: value ?? undefined },
                        }));
                      }}
                    />
                  </>
                ),
              ]}
              initialParams={{
                page: parsedParams.current ?? 1,
                params: parsedParams,
                sort: {},
              }}
              form={{
                labelWrap: true,
              }}
              bordered
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
              request={request}
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
              onReset={() => {
                pushParamsToNavigation({});
              }}
            />
          </Tabs.TabPane>
        </Tabs>
      </div>
    </PageWrapper>
  );
}
export default TableList;
