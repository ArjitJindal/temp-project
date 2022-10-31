import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Divider } from 'antd';
import { ProFormInstance } from '@ant-design/pro-form';
import StateSearchButton from '../../transactions/components/TransactionStateButton';
import { TableSearchParams } from '../types';
import { AddToSlackButton } from '../components/AddToSlackButton';
import { AssigneesDropdown } from '../components/AssigneesDropdown';
import { CasesStatusChangeForm } from '../components/CaseStatusChangeForm';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import { CURRENCIES_SELECT_OPTIONS } from '@/utils/currencies';
import { Case, CasesListResponse, CaseTransaction, CaseUpdateRequest, RuleAction } from '@/apis';
import { useApi } from '@/api';
import { getUserName } from '@/utils/api/users';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useAuth0User, useUsers } from '@/utils/user-utils';
import { makeUrl } from '@/utils/routing';
import UserLink from '@/components/UserLink';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { paymentMethod, transactionType } from '@/utils/tags';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import { TableColumn, TableRow } from '@/components/ui/Table/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, TableActionType } from '@/components/ui/Table';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import KeyValueTag from '@/components/ui/KeyValueTag';
import TransactionStateTag from '@/components/ui/TransactionStateTag';
import CaseStatusButtons from '@/pages/transactions/components/CaseStatusButtons';
import { ClosingReasonTag } from '@/pages/case-management/components/ClosingReasonTag';
import { ConsoleUserAvatar } from '@/pages/case-management/components/ConsoleUserAvatar';
import { QueryResult } from '@/utils/queries/types';
import { useTableData } from '@/pages/case-management/TransactionCases/helpers';
import CaseStatusTag from '@/components/ui/CaseStatusTag';

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
  params: AllParams<TableSearchParams>;
  queryResult: QueryResult<CasesListResponse>;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
  onUpdateCases: (caseIds: string[], updates: CaseUpdateRequest) => void;
}

export default function TransactionCases(props: Props) {
  const { params, queryResult, onChangeParams, onUpdateCases } = props;
  const actionRef = useRef<TableActionType>(null);
  const formRef = useRef<ProFormInstance<TableSearchParams>>();
  const user = useAuth0User();
  const api = useApi();
  const [users, loadingUsers] = useUsers();

  const tableQueryResult = useTableData(queryResult);
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

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
        dataIndex: 'caseId',
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
        title: 'Created on',
        dataIndex: 'createdTimestamp',
        onCell: onCaseCell,
        sorter: true,
        width: 150,
        render: (_, entity) => {
          return <TimestampDisplay timestamp={entity.createdTimestamp} />;
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
        title: 'Transaction Timestamp',
        width: 130,
        ellipsis: true,
        valueType: 'dateTimeRange',
        onCell: onTransactionCell,
        render: (_, entity) => {
          return <TimestampDisplay timestamp={entity.createdTimestamp} />;
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
          return <TransactionStateTag transactionState={entity.transaction?.transactionState} />;
        },
      },
      {
        title: 'Origin',
        hideInSearch: true,
        children: [
          {
            title: 'User ID',
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
            title: 'User Name',
            tooltip: 'Origin is the Sender in a transaction',
            width: 220,
            hideInSearch: true,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              return getUserName(entity.transaction?.originUser);
            },
          },
          {
            title: 'Method',
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
            title: 'Amount',
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
            title: 'Currency',
            hideInSearch: true,
            width: 140,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              return entity.transaction?.originAmountDetails?.transactionCurrency;
            },
          },
          {
            title: 'Country',
            hideInSearch: true,
            width: 140,
            dataIndex: 'caseTransactions.originAmountDetails.country',
            sorter: true,
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
            title: 'User ID',
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
            title: 'User Name',
            tooltip: 'Destination is the Receiver in a transaction',
            width: 180,
            hideInSearch: true,
            onCell: onTransactionCell,
            render: (dom, entity) => {
              return getUserName(entity.transaction?.destinationUser);
            },
          },
          {
            title: 'Method',
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
            title: 'Amount',
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
            title: 'Currency',
            width: 200,
            onCell: onTransactionCell,
            hideInSearch: true,
            render: (dom, entity) => {
              return entity.transaction?.destinationAmountDetails?.transactionCurrency;
            },
          },
          {
            title: 'Country',
            width: 200,
            hideInSearch: true,
            onCell: onTransactionCell,
            dataIndex: 'caseTransactions.destinationAmountDetails.country',
            sorter: true,
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
        title: 'Case Status',
        onCell: onCaseCell,
        width: 150,
        render: (_, entity) => {
          return entity.caseStatus && <CaseStatusTag caseStatus={entity.caseStatus} />;
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
              <CasesStatusChangeForm
                caseIds={[entity.caseId]}
                newCaseStatus={params.caseStatus === 'OPEN' ? 'CLOSED' : 'REOPENED'}
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
          // const caseItem = updatedCases[entity.caseId as string] || entity;
          return (
            <AssigneesDropdown
              assignments={entity.assignments || []}
              editing={true}
              onChange={(assignees) => {
                const assignments = assignees.map((assigneeUserId) => ({
                  assignedByUserId: user.userId,
                  assigneeUserId,
                  timestamp: Date.now(),
                }));
                onUpdateCases([entity.caseId as string], {
                  assignments,
                });
              }}
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
          options: CURRENCIES_SELECT_OPTIONS,
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
          options: CURRENCIES_SELECT_OPTIONS,
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
    if (params.caseStatus === 'CLOSED') {
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
        ] as TableColumn<TableRow<CaseManagementItem>>[]),
      );
    }
    return mergedColumns;
  }, [params.caseStatus, api, reloadTable, users, loadingUsers, user.userId, onUpdateCases]);

  return (
    <QueryResultsTable<CaseManagementItem, TableSearchParams>
      showResultsInfo
      queryResults={tableQueryResult}
      params={params}
      onChangeParams={onChangeParams}
      actionsHeader={[
        ({ params, setParams }) => (
          <>
            <CaseStatusButtons
              status={params.caseStatus ?? 'OPEN'}
              onChange={(newStatus) => {
                setParams((state) => ({
                  ...state,
                  caseStatus: newStatus,
                }));
              }}
            />
            <Divider type="vertical" style={{ height: '32px' }} />
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
              newCaseStatus={params.caseStatus === 'CLOSED' ? 'REOPENED' : 'CLOSED'}
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
