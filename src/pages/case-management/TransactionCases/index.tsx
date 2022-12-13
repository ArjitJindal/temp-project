import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Divider } from 'antd';
import { ProFormInstance } from '@ant-design/pro-form';
import { TransactionStateButton } from '../../transactions/components/TransactionStateButton';
import { TableSearchParams } from '../types';
import { AssigneesDropdown } from '../components/AssigneesDropdown';
import { CasesStatusChangeForm } from '../components/CaseStatusChangeForm';
import { FalsePositiveTag } from '../components/FalsePositiveTag';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import { CURRENCIES_SELECT_OPTIONS } from '@/utils/currencies';
import { Case, CaseTransaction, CaseUpdateRequest, RuleAction } from '@/apis';
import { useAuth0User, useUsers } from '@/utils/user-utils';
import { makeUrl } from '@/utils/routing';
import UserLink from '@/components/UserLink';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { paymethodOptions, transactionType } from '@/utils/tags';
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
import { TableItem } from '@/pages/case-management/TransactionCases/types';
import TransactionSearchButton from '@/pages/transactions/components/TransactionSerachButton';
import { PaginatedData } from '@/utils/queries/hooks';
import { getUserName } from '@/utils/api/users';
import COUNTRIES from '@/utils/countries';
import BusinessIndustryButton from '@/pages/transactions/components/BusinessIndustryButton';

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
  queryResult: QueryResult<PaginatedData<Case>>;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
  onUpdateCases: (caseIds: string[], updates: CaseUpdateRequest) => void;
  rules: { value: string | undefined; label: string | undefined }[];
}

export default function TransactionCases(props: Props) {
  const { params, queryResult, onChangeParams, onUpdateCases } = props;
  const actionRef = useRef<TableActionType>(null);
  const formRef = useRef<ProFormInstance<TableSearchParams>>();
  const user = useAuth0User();
  const [users, loadingUsers] = useUsers();

  const tableQueryResult = useTableData(queryResult, 'TRANSACTION');
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  // todo: i18n
  const columns: TableColumn<TableItem>[] = useMemo(() => {
    const onTransactionCell = (row: TableRow<TableItem>) => ({
      rowSpan: row.transactionFirstRow ? row.transactionsRowsCount : 0,
    });

    const onCaseCell = (row: TableRow<TableItem>) => ({
      rowSpan: row.isFirstRow ? row.rowsCount : 0,
    });

    const mergedColumns: TableColumn<TableItem>[] = [
      {
        title: (
          <p>
            Case ID <br /> Priority
          </p>
        ),
        dataIndex: 'priority',
        exportData: 'caseId',
        width: 180,
        hideInSearch: true,
        copyable: true,
        ellipsis: true,
        sorter: true,
        onCell: onCaseCell,
        render: (dom, entity) => {
          return (
            <>
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
              <br />
              {entity.priority && <p>Priority: {entity.priority}</p>}
              {entity.falsePositiveDetails &&
                entity.caseId &&
                entity.falsePositiveDetails.isFalsePositive && (
                  <FalsePositiveTag
                    caseIds={[entity.caseId]}
                    onSaved={reloadTable}
                    newCaseStatus={entity.caseStatus === 'OPEN' ? 'CLOSED' : 'REOPENED'}
                    confidence={entity.falsePositiveDetails.confidenceScore}
                  />
                )}
            </>
          );
        },
      },
      {
        title: 'Case ID',
        dataIndex: 'caseId',
        hideInTable: true,
        valueType: 'text',
        width: 130,
      },
      {
        title: 'Created on',
        dataIndex: 'createdTimestamp',
        valueType: 'dateRange',
        exportData: (entity) => dayjs(entity.createdTimestamp).format(DEFAULT_DATE_TIME_FORMAT),
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
        exportData: 'transaction.transactionId',
        width: 130,
        copyable: true,
        ellipsis: true,
        hideInSearch: true,
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
        dataIndex: 'caseTransactions.type',
        exportData: 'transaction.type',
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
        exportData: 'ruleName',
        render: (_, entity) => {
          return <>{entity.ruleName}</>;
        },
      },
      {
        title: 'Rules Description',
        tooltip: 'Describes the conditions required for this rule to be hit.',
        width: 270,
        hideInSearch: true,
        exportData: 'ruleDescription',
        render: (_, entity) => {
          return <>{entity.ruleDescription}</>;
        },
      },
      {
        title: 'Rule Action',
        sorter: true,
        dataIndex: 'status',
        exportData: 'ruleAction',
        // hideInSearch: true,
        valueType: 'select',
        fieldProps: {
          options: ['FLAG', 'BLOCK', 'SUSPEND'],
          allowClear: true,
          multiple: true,
          mode: 'multiple',
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
        dataIndex: 'transactionTimestamp',
        onCell: onTransactionCell,
        exportData: (entity) =>
          dayjs(entity.transaction?.timestamp).format(DEFAULT_DATE_TIME_FORMAT),
        render: (_, entity) => {
          return <TimestampDisplay timestamp={entity.transaction?.timestamp} />;
        },
      },
      {
        title: 'Transaction State',
        width: 130,
        ellipsis: true,
        dataIndex: 'caseTransactions.transactionState',
        hideInSearch: true,
        sorter: true,
        onCell: onTransactionCell,
        exportData: 'transaction.transactionState',
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
            dataIndex: 'caseTransactions.originUserId',
            exportData: 'transaction.originUserId',
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
            sorter: true,
            dataIndex: '_originUserName',
            onCell: onTransactionCell,
            exportData: (entity): string => getUserName(entity.transaction?.originUser),
            render: (dom, entity) => {
              const userName = getUserName(entity.transaction?.originUser);
              const originUser = entity.transaction?.originUser;

              return originUser ? (
                <UserLink user={originUser}>{userName}</UserLink>
              ) : (
                <>{userName}</>
              );
            },
          },
          {
            title: 'Method',
            width: 160,
            hideInSearch: true,
            onCell: onTransactionCell,
            exportData: 'transaction.originPaymentDetails.method',
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
            dataIndex: 'caseTransactions.originAmountDetails.transactionAmount',
            exportData: 'transaction.originAmountDetails.transactionAmount',
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
            exportData: 'transaction.originAmountDetails.transactionCurrency',
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
            exportData: 'transaction.originAmountDetails.country',
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
            dataIndex: 'caseTransactions.destinationUserId',
            exportData: 'transaction.destinationUserId',
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
            sorter: true,
            dataIndex: '_destinationUserName',
            onCell: onTransactionCell,
            exportData: (entity) => getUserName(entity.transaction?.destinationUser),
            render: (dom, entity) => {
              const destinationUser = entity.transaction?.destinationUser;
              const userName = getUserName(destinationUser);
              return destinationUser ? (
                <UserLink user={destinationUser}>{userName}</UserLink>
              ) : (
                <>{userName}</>
              );
            },
          },
          {
            title: 'Method',
            width: 160,
            hideInSearch: true,
            onCell: onTransactionCell,
            exportData: 'transaction.destinationPaymentDetails.method',
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
            dataIndex: 'caseTransactions.destnationAmountDetails.transactionAmount',
            exportData: 'transaction.destinationAmountDetails.transactionAmount',
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
            exportData: 'transaction.destinationAmountDetails.transactionCurrency',
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
            exportData: 'transaction.destinationAmountDetails.country',
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
        exportData: 'transaction.tags',
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
        exportData: 'caseStatus',
        hideInSearch: true,
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
        exportData: 'caseId',
        render: (dom, entity) => {
          return (
            entity?.caseId && (
              <CasesStatusChangeForm
                caseIds={[entity.caseId]}
                newCaseStatus={
                  entity.caseStatus === 'OPEN' || entity.caseStatus === 'REOPENED'
                    ? 'CLOSED'
                    : 'REOPENED'
                }
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
        exportData: 'caseId',
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
        dataIndex: 'rulesHitFilter',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        fieldProps: {
          options: props.rules,
          allowClear: true,
          mode: 'multiple',
        },
      },
      {
        title: 'Origin Currencies',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        dataIndex: 'originCurrenciesFilter',
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
        dataIndex: 'destinationCurrenciesFilter',
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
        dataIndex: 'originMethodFilter',
        fieldProps: {
          options: paymethodOptions,
          allowClear: true,
        },
      },
      {
        title: 'Destination Method',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        dataIndex: 'destinationMethodFilter',
        fieldProps: {
          options: paymethodOptions,
          allowClear: true,
        },
      },
      {
        title: 'Amount Greater Than',
        hideInTable: true,
        width: 120,
        valueType: 'text',
        dataIndex: 'amountGreaterThanFilter',
      },
      {
        title: 'Amount Less Than',
        hideInTable: true,
        width: 120,
        valueType: 'text',
        dataIndex: 'amountLessThanFilter',
      },
      {
        title: 'Origin Country',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        dataIndex: 'originCountryFilter',
        fieldProps: {
          options: Object.keys(COUNTRIES).map((country) => ({
            label: COUNTRIES[country],
            value: country,
          })),
          allowClear: true,
          showSearch: true,
        },
      },
      {
        title: 'Destination Country',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        dataIndex: 'destinationCountryFilter',
        fieldProps: {
          options: Object.keys(COUNTRIES).map((country) => ({
            label: COUNTRIES[country],
            value: country,
          })),
          allowClear: true,
          showSearch: true,
        },
      },
    ];
    if (params.caseStatus === 'CLOSED') {
      mergedColumns.push(
        ...([
          {
            title: 'Closing reason',
            tooltip: 'Reason provided for closing a case',
            exportData: (entity) => {
              const lastChange = entity?.statusChanges?.[entity.statusChanges?.length - 1];
              return {
                closingReasons: lastChange?.reason,
                otherReason: lastChange?.otherReason,
              };
            },
            width: 300,
            hideInSearch: true,
            onCell: onCaseCell,
            render: (dom, entity) => {
              return entity.lastStatusChange ? (
                <ClosingReasonTag
                  closingReasons={entity.lastStatusChange?.reason}
                  otherReason={entity.lastStatusChange?.otherReason}
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
            exportData: (entity) => ({
              userId: entity?.lastStatusChange?.userId,
            }),
            render: (dom, entity) => {
              return entity?.lastStatusChange?.userId ? (
                <ConsoleUserAvatar
                  userId={entity?.lastStatusChange?.userId}
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
            exportData: 'lastStatusChange.timestamp',
            render: (dom, entity) => {
              return entity.statusChanges?.length ? (
                <TimestampDisplay timestamp={entity?.lastStatusChange?.timestamp} />
              ) : (
                '-'
              );
            },
          },
        ] as TableColumn<TableItem>[]),
      );
    }
    return mergedColumns;
  }, [
    params.caseStatus,
    reloadTable,
    users,
    loadingUsers,
    user.userId,
    onUpdateCases,
    props.rules,
  ]);

  return (
    <QueryResultsTable<TableItem, TableSearchParams>
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
            <TransactionStateButton
              transactionStates={params.transactionState ?? []}
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
            <TransactionSearchButton
              transactionId={params.transactionId ?? null}
              onConfirm={(transactionId) => {
                setParams((state) => ({
                  ...state,
                  transactionId: transactionId ?? undefined,
                }));
              }}
            />
            <BusinessIndustryButton
              businessIndustry={params.businessIndustryFilter ?? []}
              onConfirm={(value) => {
                setParams((state) => ({
                  ...state,
                  businessIndustryFilter: value ?? undefined,
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
