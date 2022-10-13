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
import { Case, CaseTransaction, RuleAction } from '@/apis';
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
import { paymentMethod, transactionType } from '@/utils/tags';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import { TableColumn, TableDataItem, TableRow } from '@/components/ui/Table/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { useQuery } from '@/utils/queries/hooks';
import { AllParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import { CASES_LIST } from '@/utils/queries/keys';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import KeyValueTag from '@/components/ui/KeyValueTag';
import TransactionState from '@/components/ui/TransactionState';

export type CaseManagementItem = Case & {
  index: number;
  rowKey: string;
  ruleName?: string | null;
  ruleDescription?: string | null;
  ruleAction?: RuleAction | null;
  transaction: CaseTransaction | null;
  transactionFirstRow: boolean;
  transactionsRowsCount: number;
};

interface Props {
  isOpenTab: boolean;
}

export default function CaseTable(props: Props) {
  const { isOpenTab } = props;
  const actionRef = useRef<TableActionType>(null);
  const formRef = useRef<ProFormInstance<TableSearchParams>>();
  const user = useAuth0User();
  const [updatedCases, setUpdatedCases] = useState<{
    [key: string]: Case;
  }>({});
  const handleCaseUpdate = useCallback(async (caseItem: Case) => {
    const transactionId = caseItem.caseId as string;
    setUpdatedCases((prev) => ({
      ...prev,
      [transactionId]: caseItem,
    }));
  }, []);
  const api = useApi();
  const handleUpdateAssignments = useCallback(
    async (caseItem: Case, assignees: string[]) => {
      const hideMessage = message.loading(`Saving...`, 0);
      const assignments = assignees.map((assigneeUserId) => ({
        assignedByUserId: user.userId,
        assigneeUserId,
        timestamp: Date.now(),
      }));
      try {
        handleCaseUpdate({
          ...caseItem,
          assignments,
        });
        await api.postCases({
          CasesUpdateRequest: {
            caseIds: [caseItem.caseId as string],
            updates: {
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
    [api, handleCaseUpdate, user.userId],
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
      userId,
      userFilterMode,
      type,
      status,
      transactionState,
      originMethodFilter,
      destinationMethodFilter,
      tagKey,
      tagValue,
    } = params;
    const [sortField, sortOrder] = sort[0] ?? [];
    const [response, time] = await measure(() =>
      api.getCaseList({
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
        filterUserId: userFilterMode === 'ALL' ? userId : undefined,
        filterOriginUserId: userFilterMode === 'ORIGIN' ? userId : undefined,
        filterDestinationUserId: userFilterMode === 'DESTINATION' ? userId : undefined,
        transactionType: type,
        sortField: sortField ?? undefined,
        sortOrder: sortOrder ?? undefined,
        includeTransactionUsers: true,
        includeTransactionEvents: false, // todo: do we still need events?
        filterOriginPaymentMethod: originMethodFilter,
        filterDestinationPaymentMethod: destinationMethodFilter,
        filterTransactionTagKey: tagKey,
        filterTransactionTagValue: tagValue,
      }),
    );
    analytics.event({
      title: 'Table Loaded',
      time,
    });
    const items: TableDataItem<CaseManagementItem>[] = response.data.map(
      (item, index): TableDataItem<CaseManagementItem> => {
        const caseTransactions = item.caseTransactions ?? [];
        const dataItem: CaseManagementItem = {
          index,
          rowKey: item.caseId ?? `${index}`,
          transaction: null,
          transactionFirstRow: true,
          transactionsRowsCount: 1,
          ...item,
        };
        if (caseTransactions.length === 0) {
          return dataItem;
        }
        return {
          item: dataItem,
          rows: caseTransactions.flatMap((transaction) => {
            if (transaction.hitRules.length === 0) {
              return [
                {
                  ...dataItem,
                  rowKey: `${item.caseId}#${transaction.transactionId}`,
                  transaction,
                },
              ];
            }
            return transaction.hitRules.map((rule, i): CaseManagementItem => {
              return {
                ...dataItem,
                rowKey: `${item.caseId}#${transaction.transactionId}#${i}`,
                transaction: transaction,
                ruleName: rule.ruleName,
                ruleDescription: rule.ruleDescription,
                ruleAction: rule.ruleAction,
                transactionsRowsCount: transaction.hitRules.length,
                transactionFirstRow: i === 0,
              };
            });
          }),
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
    const onTransactionCell = (row: TableRow<CaseManagementItem>) => ({
      rowSpan: row.transactionFirstRow ? row.transactionsRowsCount : 0,
    });

    const onCaseCell = (row: TableRow<CaseManagementItem>) => ({
      rowSpan: row.isFirstRow ? row.rowsCount : 0,
    });

    const mergedColumns: TableColumn<CaseManagementItem>[] = [
      {
        title: 'Case ID',
        width: 130,
        copyable: true,
        ellipsis: true,
        onCell: onCaseCell,
        render: (dom, entity) => {
          return (
            <Id
              id={entity.caseId}
              to={addBackUrlToRoute(
                makeUrl(`/case-management/case/:caseId`, {
                  caseId: entity.caseId,
                }),
              )}
            >
              {entity.caseId}
            </Id>
          );
        },
      },
      {
        title: 'Transaction ID',
        dataIndex: 'transactionId',
        width: 130,
        copyable: true,
        ellipsis: true,
        onCell: onTransactionCell,
        render: (dom, entity) => {
          return (
            entity.transaction && (
              <Id
                id={entity.transaction.transactionId}
                to={makeUrl(`/transactions/item/:transactionId`, {
                  transactionId: entity.transaction.transactionId,
                })}
              >
                {entity.transaction.transactionId}
              </Id>
            )
          );
        },
      },
      {
        title: 'Transaction Type',
        dataIndex: 'type',
        width: 175,
        onCell: onTransactionCell,
        valueType: 'select',
        fieldProps: {
          options: transactionType,
          allowClear: true,
        },
        render: (dom, entity) => {
          return <TransactionTypeTag transactionType={entity.transaction?.type} />;
        },
      },
      {
        title: 'Rules Hit',
        hideInSearch: true,
        width: 150,
        render: (_, entity) => {
          return <>{entity.ruleName}</>;
        },
      },
      {
        title: 'Rules Description',
        tooltip: 'Describes the conditions required for this rule to be hit.',
        width: 270,
        hideInSearch: true,
        render: (_, entity) => {
          return <>{entity.ruleDescription}</>;
        },
      },
      {
        title: 'Rule Action',
        sorter: true,
        dataIndex: 'status',
        hideInSearch: true,
        valueType: 'select',
        fieldProps: {
          options: ['FLAG', 'BLOCK', 'SUSPEND', 'WHITELIST'],
          allowClear: true,
        },
        width: 200,
        render: (dom, entity) => {
          if (entity.ruleAction == null) {
            return <></>;
          }
          return <RuleActionStatus ruleAction={entity.ruleAction} />;
        },
      },
      {
        title: 'Timestamp',
        width: 130,
        ellipsis: true,
        dataIndex: 'timestamp',
        valueType: 'dateTimeRange',
        sorter: true,
        onCell: onTransactionCell,
        render: (_, entity) => {
          return <TimestampDisplay timestamp={entity.transaction?.timestamp} />;
        },
      },
      {
        title: 'Transaction State',
        width: 130,
        ellipsis: true,
        dataIndex: 'transactionState',
        hideInSearch: true,
        sorter: true,
        onCell: onTransactionCell,
        render: (_, entity) => {
          return <TransactionState transactionState={entity.transaction?.transactionState} />;
        },
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
            onCell: onTransactionCell,
            render: (dom, entity) => {
              const transaction = entity.transaction;
              if (transaction == null) {
                return <></>;
              }
              if (!transaction.originUser) return transaction.originUserId;
              return (
                <UserLink user={transaction.originUser}>
                  {String(transaction.originUserId)}
                </UserLink>
              );
            },
          },
          {
            title: 'Origin User Name',
            tooltip: 'Origin is the Sender in a transaction',
            width: 220,
            hideInSearch: true,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              return getUserName(entity.transaction?.originUser);
            },
          },
          {
            title: 'Origin Method',
            width: 160,
            hideInSearch: true,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              return (
                <PaymentMethodTag
                  paymentMethod={entity.transaction?.originPaymentDetails?.method}
                />
              );
            },
          },
          {
            title: 'Origin Amount',
            dataIndex: 'originAmountDetails.transactionAmount',
            hideInSearch: true,
            sorter: true,
            width: 150,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              const transaction = entity.transaction;
              if (transaction == null) {
                return <></>;
              }
              if (transaction.originAmountDetails?.transactionAmount !== undefined) {
                return new Intl.NumberFormat().format(
                  transaction.originAmountDetails?.transactionAmount,
                );
              } else {
                return transaction.originAmountDetails?.transactionAmount;
              }
            },
          },
          {
            title: 'Origin Currency',
            hideInSearch: true,
            width: 140,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              return entity.transaction?.originAmountDetails?.transactionCurrency;
            },
          },
          {
            title: 'Origin Country',
            hideInSearch: true,
            width: 140,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              return <CountryDisplay isoCode={entity.transaction?.originAmountDetails?.country} />;
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
            onCell: onTransactionCell,
            render: (dom, entity) => {
              if (!entity.transaction?.destinationUser) {
                return entity.transaction?.destinationUserId;
              }
              return (
                <UserLink user={entity.transaction.destinationUser}>
                  {String(entity.transaction.destinationUserId)}
                </UserLink>
              );
            },
          },
          {
            title: 'Destination User Name',
            tooltip: 'Destination is the Receiver in a transaction',
            width: 180,
            hideInSearch: true,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              return getUserName(entity.transaction?.destinationUser);
            },
          },
          {
            title: 'Destination Method',
            width: 160,
            hideInSearch: true,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              return (
                <PaymentMethodTag
                  paymentMethod={entity.transaction?.destinationPaymentDetails?.method}
                />
              );
            },
          },
          {
            title: 'Destination Amount',
            width: 200,
            dataIndex: 'destnationAmountDetails.transactionAmount',
            hideInSearch: true,
            sorter: true,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              if (entity.transaction?.destinationAmountDetails?.transactionAmount !== undefined) {
                return new Intl.NumberFormat().format(
                  entity.transaction?.destinationAmountDetails?.transactionAmount,
                );
              } else {
                return entity.transaction?.destinationAmountDetails?.transactionAmount;
              }
            },
          },
          {
            title: 'Destination Currency',
            width: 200,
            onCell: onTransactionCell,
            hideInSearch: true,
            render: (dom, entity) => {
              return entity.transaction?.destinationAmountDetails?.transactionCurrency;
            },
          },
          {
            title: 'Destination Country',
            width: 200,
            hideInSearch: true,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              return (
                <CountryDisplay isoCode={entity.transaction?.destinationAmountDetails?.country} />
              );
            },
          },
        ],
      },
      {
        title: 'Tags',
        hideInSearch: true,
        width: 250,
        onCell: onTransactionCell,
        render: (_, entity) => {
          return (
            <>
              {entity.transaction?.tags?.map((tag) => (
                <KeyValueTag key={tag.key} tag={tag} />
              ))}
            </>
          );
        },
      },
      {
        title: 'Operations',
        hideInSearch: true,
        fixed: 'right',
        width: 120,
        onCell: onCaseCell,
        render: (dom, entity) => {
          return (
            entity?.caseId && (
              <CaseStatusChangeForm
                caseId={entity.caseId}
                newCaseStatus={isOpenTab ? 'CLOSED' : 'REOPENED'}
                onSaved={reloadTable}
              />
            )
          );
        },
      },
      {
        title: 'Assignees',
        hideInSearch: true,
        width: 250,
        ellipsis: true,
        fixed: 'right',
        onCell: onCaseCell,
        render: (dom, entity) => {
          const caseItem = updatedCases[entity.caseId as string] || entity;
          return (
            <AssigneesDropdown
              assignments={caseItem.assignments || []}
              editing={true}
              onChange={(assignees) => handleUpdateAssignments(caseItem, assignees)}
            />
          );
        },
      },
      {
        title: 'Rules Hit',
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
            onCell: onCaseCell,
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
            onCell: onCaseCell,
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
            onCell: onCaseCell,
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
  }, [api, handleUpdateAssignments, reloadTable, updatedCases, isOpenTab, users, loadingUsers]);

  return (
    <QueryResultsTable<CaseManagementItem, TableSearchParams>
      queryResults={queryResults}
      params={params}
      onChangeParams={handleChangeParams}
      actionsHeader={[
        ({ params, setParams }) => (
          <>
            <UserSearchButton
              initialMode={params.userFilterMode ?? 'ALL'}
              userId={params.userId ?? null}
              onConfirm={(userId, mode) => {
                setParams((state) => ({
                  ...state,
                  userId: userId ?? undefined,
                  userFilterMode: mode ?? 'ALL',
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
            <TagSearchButton
              initialState={{
                key: params.tagKey ?? null,
                value: params.tagValue ?? null,
              }}
              onConfirm={(value) => {
                setParams((state) => ({
                  ...state,
                  tagKey: value.key ?? undefined,
                  tagValue: value.value ?? undefined,
                }));
              }}
            />
            <Divider type="vertical" style={{ height: '32px' }} />
            <CasesStatusChangeForm
              caseIds={selectedEntities}
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
