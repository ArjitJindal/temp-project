import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ProFormInstance } from '@ant-design/pro-form';
import { TableSearchParams } from '../types';
import CasesStatusChangeButton from '../components/CasesStatusChangeButton';
import GavelIcon from './gavel.react.svg';
import { Account, Case, CaseUpdateRequest } from '@/apis';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { QueryResult } from '@/utils/queries/types';
import { useAuth0User, useUsers } from '@/utils/user-utils';
import { makeUrl } from '@/utils/routing';
import { TableColumn, TableRow } from '@/components/ui/Table/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, TableActionType } from '@/components/ui/Table';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import StatusButtons from '@/pages/transactions/components/StatusButtons';
import { useTableData } from '@/pages/case-management/CaseTable/helpers';
import { TableItem } from '@/pages/case-management/CaseTable/types';
import { getUserLink, getUserName, KYC_STATUSES, USER_STATES } from '@/utils/api/users';
import UserKycStatusTag from '@/components/ui/UserKycStatusTag';
import RiskLevelTag from '@/components/ui/RiskLevelTag';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import UserStateTag from '@/components/ui/UserStateTag';
import CaseStatusTag from '@/components/ui/CaseStatusTag';
import UserLink from '@/components/UserLink';
import { PaginatedData } from '@/utils/queries/hooks';
import { ClosingReasonTag } from '@/pages/case-management/components/ClosingReasonTag';
import { ConsoleUserAvatar } from '@/pages/case-management/components/ConsoleUserAvatar';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { humanizeConstant } from '@/utils/humanize';
import AccountCircleLineIcon from '@/components/ui/icons/Remix/user/account-circle-line.react.svg';
import CalendarLineIcon from '@/components/ui/icons/Remix/business/calendar-line.react.svg';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import ScopeSelector from '@/pages/case-management/components/ScopeSelector';
import AssignToButton from '@/pages/case-management/components/AssignToButton';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import { SimpleAlertTable } from '@/pages/case-management/AlertTable';
import { extraFilters } from '@/pages/case-management/helpers';

interface Props {
  params: AllParams<TableSearchParams>;
  queryResult: QueryResult<PaginatedData<Case>>;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
  onUpdateCases: (caseIds: string[], updates: CaseUpdateRequest) => void;
  rules: { value: string | undefined; label: string | undefined }[];
}

export default function CaseTable(props: Props) {
  const { queryResult, params, onUpdateCases, onChangeParams } = props;

  const tableQueryResult = useTableData(queryResult);

  const actionRef = useRef<TableActionType>(null);
  const formRef = useRef<ProFormInstance<TableSearchParams>>();
  const user = useAuth0User();
  const isPulseEnabled = useFeatureEnabled('PULSE');

  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true });

  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  // todo: i18n
  const columns: TableColumn<TableItem>[] = useMemo(() => {
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
        width: 130,
        copyable: true,
        ellipsis: true,
        hideInSearch: true,
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
            </>
          );
        },
      },
      {
        title: 'Case ID',
        dataIndex: 'caseId',
        exportData: 'caseId',
        hideInTable: true,
        valueType: 'text',
        width: 130,
        fieldProps: {
          icon: <StackLineIcon />,
          showFilterByDefault: true,
        },
      },
      {
        title: 'Created on',
        dataIndex: 'createdTimestamp',
        valueType: 'dateRange',
        exportData: (entity) => dayjs(entity.createdTimestamp).format(DEFAULT_DATE_TIME_FORMAT),
        sorter: true,
        width: 150,
        fieldProps: {
          icon: <CalendarLineIcon />,
          showFilterByDefault: true,
        },
        render: (_, entity) => {
          return <TimestampDisplay timestamp={entity.createdTimestamp} />;
        },
      },
      {
        title: 'User ID',
        exportData: 'userId',
        width: 150,
        hideInSearch: true,
        render: (_, entity) => {
          const { userId, user } = entity;
          return userId ? <Id to={getUserLink(user)}>{userId}</Id> : '-';
        },
      },
      {
        title: 'User Name',
        exportData: (entity): string => getUserName(entity.user),
        width: 150,
        sorter: true,
        hideInSearch: true,
        dataIndex: '_userName',
        render: (_, entity) => {
          const userName = getUserName(entity.user);
          return entity.user ? <UserLink user={entity.user}>{userName}</UserLink> : <>{userName}</>;
        },
      },
      {
        title: 'Transactions Hit',
        exportData: (entity): number => entity.caseTransactionsIds?.length ?? 0,
        width: 150,
        sorter: true,
        hideInSearch: true,
        dataIndex: '_transactionsHit',
        render: (_, entity) => {
          return <>{entity.caseTransactionsIds?.length ?? 0}</>;
        },
      },
      {
        title: 'User status',
        exportData: 'user.userStateDetails.state',
        width: 150,
        render: (_, entity) => {
          const userState = entity.user?.userStateDetails?.state;
          return userState && <UserStateTag userState={userState} />;
        },
        fieldProps: {
          options: USER_STATES.map((state) => ({
            label: humanizeConstant(state),
            value: state,
          })),
          allowClear: true,
          mode: 'multiple',
          displayMode: 'list',
          icon: <AccountCircleLineIcon />,
        },
        valueType: 'select',
        dataIndex: 'userStates',
      },
      {
        title: 'KYC status',
        exportData: 'user.kycStatusDetails',
        width: 150,
        render: (_, entity) => {
          const kycStatusDetails = entity.user?.kycStatusDetails;
          return kycStatusDetails && <UserKycStatusTag kycStatusDetails={kycStatusDetails} />;
        },
        fieldProps: {
          options: KYC_STATUSES.map((status) => ({
            label: humanizeConstant(status),
            value: status,
          })),
          allowClear: true,
          mode: 'multiple',
          displayMode: 'list',
          icon: <AccountCircleLineIcon />,
        },
        valueType: 'select',
        dataIndex: 'kycStatuses',
      },
      ...(isPulseEnabled
        ? [
            {
              title: 'User risk level',
              exportData: (entity) => {
                const riskLevel =
                  entity?.caseUsers?.originUserRiskLevel ??
                  entity?.caseUsers?.destinationUserRiskLevel;
                return riskLevel ?? '-';
              },
              width: 150,
              render: (_, entity) => {
                const riskLevel =
                  entity?.caseUsers?.originUserRiskLevel ??
                  entity?.caseUsers?.destinationUserRiskLevel;

                return riskLevel ? <RiskLevelTag level={riskLevel} /> : '-';
              },
              valueType: 'select',
              dataIndex: 'riskLevels',
              hideInSearch: true,
            } as TableColumn<TableItem>,
          ]
        : []),
      {
        title: 'Rules',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        dataIndex: 'rulesHitFilter',
        fieldProps: {
          options: props.rules,
          allowClear: true,
          mode: 'multiple',
          icon: <GavelIcon />,
          showFilterByDefault: true,
        },
      },
      {
        title: 'Assignees',
        exportData: 'assignments',
        hideInSearch: true,
        width: 250,
        ellipsis: true,
        fixed: 'right',
        onCell: onCaseCell,
        render: (dom, entity) => {
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
        title: 'Case status',
        exportData: 'caseStatus',
        hideInSearch: true,
        width: 150,
        render: (_, entity) => {
          return entity.caseStatus && <CaseStatusTag caseStatus={entity.caseStatus} />;
        },
      },
      {
        title: 'Operations',
        hideInSearch: true,
        exportData: false,
        fixed: 'right',
        width: 120,
        onCell: onCaseCell,
        render: (dom, entity) => {
          return (
            entity?.caseId && (
              <CasesStatusChangeButton
                caseIds={[entity.caseId]}
                caseStatus={entity.caseStatus}
                onSaved={reloadTable}
              />
            )
          );
        },
      },
    ];
    if (params.caseStatus === 'CLOSED') {
      mergedColumns.push(
        ...([
          {
            title: 'Closing reason',
            tooltip: 'Reason provided for closing a case',
            exportData: 'lastStatusChangeReasons', // todo: is this enough
            width: 300,
            hideInSearch: true,
            onCell: onCaseCell,
            render: (dom, entity) => {
              const lastStatusChangeReasons = entity.lastStatusChangeReasons;
              return lastStatusChangeReasons ? (
                <ClosingReasonTag
                  closingReasons={lastStatusChangeReasons.reasons}
                  otherReason={lastStatusChangeReasons.otherReason}
                />
              ) : (
                '-'
              );
            },
          },
          {
            title: 'Closed by',
            exportData: 'lastStatusChange.userId',
            width: 250,
            hideInSearch: true,
            onCell: onCaseCell,
            render: (dom, entity) => {
              return entity.lastStatusChange ? (
                <ConsoleUserAvatar
                  userId={entity.lastStatusChange.userId}
                  users={users}
                  loadingUsers={loadingUsers}
                />
              ) : (
                '-'
              );
            },
          },
        ] as TableColumn<TableItem>[]),
      );
    }

    mergedColumns.push(
      ...([
        {
          title: 'Last update time',
          exportData: 'lastStatusChange.timestamp',
          width: 160,
          hideInSearch: false,
          valueType: 'dateTimeRange',
          dataIndex: 'lastStatusChange.timestamp',
          sorter: true,
          onCell: onCaseCell,
          render: (dom, entity) => {
            return entity.lastStatusChange ? (
              <TimestampDisplay timestamp={entity.lastStatusChange.timestamp} />
            ) : (
              '-'
            );
          },
        },
      ] as TableColumn<TableItem>[]),
    );

    return mergedColumns;
  }, [
    user.userId,
    params.caseStatus,
    reloadTable,
    users,
    loadingUsers,
    onUpdateCases,
    props.rules,
    isPulseEnabled,
  ]);

  const api = useApi();

  const handleAssignTo = (account: Account) => {
    const hideLoading = message.loading('Assigning cases');
    api
      .postCases({
        CasesUpdateRequest: {
          caseIds: selectedEntities,
          updates: {
            assignments: [
              {
                assigneeUserId: account.id,
                assignedByUserId: user.userId,
                timestamp: Date.now(),
              },
            ],
          },
        },
      })
      .then(() => {
        message.success('Done!');
        reloadTable();
      })
      .catch(() => {
        message.success('Unable to reassign cases!');
      })
      .finally(() => {
        hideLoading();
      });
  };
  return (
    <QueryResultsTable<TableItem, TableSearchParams>
      expandable={{
        expandedRowRender: (record) => record.caseId && <SimpleAlertTable caseId={record.caseId} />,
      }}
      tableId="user-cases"
      queryResults={tableQueryResult}
      params={params}
      onChangeParams={onChangeParams}
      extraFilters={extraFilters(isPulseEnabled)}
      actionsHeader={[
        ({ params, setParams }) => <ScopeSelector params={params} onChangeParams={setParams} />,
      ]}
      actionsHeaderRight={[
        ({ params, setParams }) => (
          <>
            <AssignToButton ids={selectedEntities} onSelect={handleAssignTo} />
            <CasesStatusChangeButton
              caseIds={selectedEntities}
              onSaved={reloadTable}
              caseStatus={params.caseStatus}
            />
            <StatusButtons
              status={params.caseStatus ?? 'OPEN'}
              onChange={(newStatus) => {
                setParams((state) => ({
                  ...state,
                  caseStatus: newStatus,
                }));
              }}
              suffix="cases"
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
      rowKey="caseId"
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
      autoAdjustHeight
    />
  );
}
