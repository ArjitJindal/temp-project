import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-table';
import { Divider, message } from 'antd';
import moment from 'moment';
import { ProFormInstance } from '@ant-design/pro-form';
import { useNavigate } from 'react-router';
import StateSearchButton from '../../transactions/components/TransactionStateButton';
import { TableSearchParams } from '../types';
import { AddToSlackButton } from './AddToSlackButton';
import { AssigneesDropdown } from './AssigneesDropdown';
import { ClosingReasonTag } from './ClosingReasonTag';
import { ConsoleUserAvatar } from './ConsoleUserAvatar';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import { currencies } from '@/utils/currencies';
import { TableActionType } from '@/components/RequestTable';
import { TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import { getUserName } from '@/utils/api/users';
import {
  CasesStatusChangeForm,
  CaseStatusChangeForm,
} from '@/pages/case-management/components/CaseStatusChangeForm';
import { useAnalytics } from '@/utils/segment/context';
import { measure } from '@/utils/time-utils';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useAuth0User, useUsers } from '@/utils/user-utils';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { useDeepEqualEffect } from '@/utils/hooks';
import { queryAdapter } from '@/pages/case-management/helpers';
import UserLink from '@/components/UserLink';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { TransactionType } from '@/apis/models/TransactionType';
import { paymentMethod, transactionType } from '@/utils/tags';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import TransactionStatusButton from '@/pages/transactions/components/TransactionStatusButton';
import { TableColumn, TableDataItem, TableRow } from '@/components/ui/Table/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { useQuery } from '@/utils/queries/hooks';
import { AllParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import { CASES_LIST } from '@/utils/queries/keys';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';

export type CaseManagementItem = TransactionCaseManagement & {
  index: number;
  transactionId?: string;
  ruleName: string | null;
  ruleDescription: string | null;
  rowKey: string;
};

interface Props {
  isOpenTab: boolean;
}

export default function CaseTable(props: Props) {
  const { isOpenTab } = props;
  const actionRef = useRef<TableActionType>(null);
  const formRef = useRef<ProFormInstance<TableSearchParams>>();
  const user = useAuth0User();
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
        await api.postTransactions({
          TransactionsUpdateRequest: {
            transactionIds: [transaction.transactionId as string],
            transactionUpdates: {
              assignments,
            },
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

  const [users, loadingUsers] = useUsers();

  const pushParamsToNavigation = useCallback(
    (params: TableSearchParams) => {
      navigate(makeUrl('/case-management', {}, queryAdapter.serializer(params)), {
        replace: true,
      });
    },
    [navigate],
  );

  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));

  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    ...parsedParams,
  });

  const handleChangeParams = (params: AllParams<TableSearchParams>) => {
    pushParamsToNavigation({
      ...params,
      page: params.page,
      sort: params.sort,
    });
  };

  useDeepEqualEffect(() => {
    setParams((prevState) => ({
      ...prevState,
      ...parsedParams,
      page: parsedParams.page ?? 1,
      sort: parsedParams.sort ?? [],
    }));
  }, [parsedParams]);

  const queryResults = useQuery(CASES_LIST({ ...params, isOpenTab }), async () => {
    const {
      sort,
      page,
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
    const [sortField, sortOrder] = sort[0] ?? [];
    const [response, time] = await measure(() =>
      api.getTransactionsList({
        limit: DEFAULT_PAGE_SIZE!,
        skip: (page! - 1) * DEFAULT_PAGE_SIZE!,
        afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
        // beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Date.now(),
        beforeTimestamp: Number.MAX_SAFE_INTEGER,
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
    const items: TableDataItem<CaseManagementItem>[] = response.data.map(
      (item, index): TableDataItem<CaseManagementItem> => {
        const dataItem = {
          index,
          rowKey: item.transactionId ?? `${index}`,
          ruleName: null,
          ruleDescription: null,
          ...item,
        };
        if (item.hitRules.length === 0) {
          return dataItem;
        }
        return {
          item: dataItem,
          rows: item.hitRules.map(
            (rule, i): CaseManagementItem => ({
              ...dataItem,
              rowKey: `${item.transactionId}#${i}`,
              ruleName: rule.ruleName,
              ruleDescription: rule.ruleDescription,
            }),
          ),
        };
      },
    );

    return {
      items,
      success: true,
      total: response.total,
    };
  });

  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  // todo: i18n
  const columns: TableColumn<CaseManagementItem>[] = useMemo(() => {
    const mergedColumns: TableColumn<CaseManagementItem>[] = [
      {
        title: 'Transaction ID',
        dataIndex: 'transactionId',
        width: 130,
        copyable: true,
        ellipsis: true,
        onCell: (row) => ({
          rowSpan: row.isFirstRow ? row.rowsCount : 0,
        }),
        render: (dom, entity) => {
          return (
            <Id
              id={entity.transactionId}
              to={addBackUrlToRoute(`/case-management/case/${entity.transactionId}`)}
            >
              {entity.transactionId}
            </Id>
          );
        },
      },
      {
        title: 'Transaction Type',
        dataIndex: 'type',
        width: 175,
        onCell: (row) => ({
          rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
        onCell: (row) => ({
          rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
        onCell: (row) => ({
          rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
            }),
            render: (dom, entity) => {
              return getUserName(entity.originUser);
            },
          },
          {
            title: 'Origin Method',
            width: 160,
            hideInSearch: true,
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
            }),
            render: (dom, entity) => {
              return entity.originAmountDetails?.transactionCurrency;
            },
          },
          {
            title: 'Origin Country',
            hideInSearch: true,
            width: 140,
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
            }),
            render: (dom, entity) => {
              return getUserName(entity.destinationUser);
            },
          },
          {
            title: 'Destination Method',
            width: 160,
            hideInSearch: true,
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
            }),
            render: (dom, entity) => {
              return <CountryDisplay isoCode={entity.destinationAmountDetails?.country} />;
            },
          },
        ],
      },
      {
        title: 'Rule Action',
        sorter: true,
        dataIndex: 'status',
        hideInSearch: true,
        valueType: 'select',
        onCell: (row) => ({
          rowSpan: row.isFirstRow ? row.rowsCount : 0,
        }),
        fieldProps: {
          options: ['FLAG', 'BLOCK', 'SUSPEND', 'WHITELIST'],
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
        fixed: 'right',
        width: 120,
        onCell: (row) => ({
          rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
        width: 250,
        ellipsis: true,
        fixed: 'right',
        onCell: (row) => ({
          rowSpan: row.isFirstRow ? row.rowsCount : 0,
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
    ];
    if (!isOpenTab) {
      mergedColumns.push(
        ...([
          {
            title: 'Closing reason',
            tooltip: 'Reason provided for closing a case',
            width: 300,
            hideInSearch: true,
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
            }),
            render: (dom, entity) => {
              return entity.statusChanges?.length ? (
                <ClosingReasonTag
                  closingReasons={entity.statusChanges[entity.statusChanges.length - 1].reason}
                  otherReason={entity.statusChanges[entity.statusChanges.length - 1].otherReason}
                />
              ) : (
                '-'
              );
            },
          },
          {
            title: 'Closed By',
            width: 250,
            hideInSearch: true,
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
            }),
            render: (dom, entity) => {
              return entity.statusChanges?.length ? (
                <ConsoleUserAvatar
                  userId={entity.statusChanges[entity.statusChanges.length - 1].userId}
                  users={users}
                  loadingUsers={loadingUsers}
                />
              ) : (
                '-'
              );
            },
          },
          {
            title: 'Last Update Time',
            width: 160,
            hideInSearch: true,
            valueType: 'dateTimeRange',
            onCell: (row) => ({
              rowSpan: row.isFirstRow ? row.rowsCount : 0,
            }),
            render: (dom, entity) => {
              return entity.statusChanges?.length ? (
                <TimestampDisplay
                  timestamp={entity.statusChanges[entity.statusChanges.length - 1].timestamp}
                />
              ) : (
                '-'
              );
            },
          },
        ] as ProColumns<TableRow<CaseManagementItem>>[]),
      );
    }
    return mergedColumns;
  }, [
    api,
    handleUpdateAssignments,
    reloadTable,
    updatedTransactions,
    isOpenTab,
    users,
    loadingUsers,
  ]);

  return (
    <QueryResultsTable<CaseManagementItem, TableSearchParams>
      queryResults={queryResults}
      params={params}
      onChangeParams={handleChangeParams}
      actionsHeader={[
        ({ params, setParams }) => (
          <>
            <TransactionStatusButton
              status={params.status ?? undefined}
              onConfirm={(value) => {
                setParams((state) => ({
                  ...state,
                  status: value ?? undefined,
                }));
              }}
            />
            <UserSearchButton
              userId={params.userId ?? null}
              onConfirm={(userId) => {
                setParams((state) => ({
                  ...state,
                  userId: userId ?? undefined,
                }));
              }}
            />
            <StateSearchButton
              transactionState={params.transactionState ?? undefined}
              onConfirm={(value) => {
                setParams((state) => ({
                  ...state,
                  transactionState: value ?? undefined,
                }));
              }}
            />
            <Divider type="vertical" style={{ height: '32px' }} />
            <CasesStatusChangeForm
              transactionIds={selectedEntities}
              onSaved={reloadTable}
              newCaseStatus={isOpenTab ? 'CLOSED' : 'REOPENED'}
            />
          </>
        ),
      ]}
      form={{
        labelWrap: true,
      }}
      bordered
      isEvenRow={(item) => item.index % 2 === 0}
      actionRef={actionRef}
      formRef={formRef}
      rowKey="rowKey"
      search={{
        labelWidth: 120,
      }}
      scroll={{ x: 1300 }}
      toolBarRender={() => [
        <Feature name="SLACK_ALERTS">
          <AddToSlackButton />
        </Feature>,
      ]}
      columns={columns}
      columnsState={{
        persistenceType: 'localStorage',
        persistenceKey: 'case-management-list',
      }}
      rowSelection={{
        selectedKeys: selectedEntities,
        onChange: setSelectedEntities,
      }}
    />
  );
}
