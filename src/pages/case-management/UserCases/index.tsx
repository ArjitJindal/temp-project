import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Divider } from 'antd';
import { ProFormInstance } from '@ant-design/pro-form';
import moment from 'moment';
import TransactionStateSearchButton from '../../transactions/components/TransactionStateButton';
import { TableSearchParams } from '../types';
import { CasesStatusChangeForm } from '../components/CaseStatusChangeForm';
import { QueryResult } from '@/utils/queries/types';
import { Case, CaseUpdateRequest } from '@/apis';
import { useAuth0User, useUsers } from '@/utils/user-utils';
import { makeUrl } from '@/utils/routing';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import { TableColumn, TableRow } from '@/components/ui/Table/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, TableActionType } from '@/components/ui/Table';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import TagSearchButton from '@/pages/transactions/components/TagSearchButton';
import CaseStatusButtons from '@/pages/transactions/components/CaseStatusButtons';
import { useTableData } from '@/pages/case-management/UserCases/helpers';
import { TableItem } from '@/pages/case-management/UserCases/types';
import { getUserLink, getUserName } from '@/utils/api/users';
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
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import BusinessIndustryButton from '@/pages/transactions/components/BusinessIndustryButton';

interface Props {
  params: AllParams<TableSearchParams>;
  queryResult: QueryResult<PaginatedData<Case>>;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
  onUpdateCases: (caseIds: string[], updates: CaseUpdateRequest) => void;
  rules: { value: string | undefined; label: string | undefined }[];
}

export default function UserCases(props: Props) {
  const { queryResult, params, onUpdateCases, onChangeParams } = props;

  const tableQueryResult = useTableData(queryResult);

  const actionRef = useRef<TableActionType>(null);
  const formRef = useRef<ProFormInstance<TableSearchParams>>();
  const user = useAuth0User();

  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const [users, loadingUsers] = useUsers();

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
      },
      {
        title: 'Created on',
        dataIndex: 'createdTimestamp',
        valueType: 'dateRange',
        exportData: (entity) =>
          moment(entity.createdTimestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT),
        sorter: true,
        width: 150,
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
      // {
      //   title: 'Rules Hit',
      //   width: 150,
      //   render: (_, entity) => {
      //     return <span>Not implemented: 'Rules Hit'</span>;
      //   },
      // },
      {
        title: 'User Status',
        exportData: 'user.userStateDetails.state',
        width: 150,
        render: (_, entity) => {
          const userState = entity.user?.userStateDetails?.state;
          return userState && <UserStateTag userState={userState} />;
        },
      },
      {
        title: 'KYC Status',
        exportData: 'user.kycStatusDetails',
        width: 150,
        render: (_, entity) => {
          const kycStatusDetails = entity.user?.kycStatusDetails;
          return kycStatusDetails && <UserKycStatusTag kycStatusDetails={kycStatusDetails} />;
        },
      },
      {
        title: 'User Risk Level',
        exportData: 'user.riskLevel',
        width: 150,
        render: (_, entity) => {
          const riskLevel = entity.user?.riskLevel;
          return riskLevel && <RiskLevelTag level={riskLevel} />;
        },
      },
      {
        title: 'Rules Hit',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        dataIndex: 'rulesHitFilter',
        fieldProps: {
          options: props.rules,
          allowClear: true,
          mode: 'multiple',
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
        title: 'Case Status',
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
              <CasesStatusChangeForm
                caseIds={[entity.caseId]}
                newCaseStatus={entity.caseStatus === 'OPEN' ? 'CLOSED' : 'REOPENED'}
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
            title: 'Closed By',
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
          {
            title: 'Last Update Time',
            exportData: 'lastStatusChange.timestamp',
            width: 160,
            hideInSearch: true,
            valueType: 'dateTimeRange',
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
    }
    return mergedColumns;
  }, [
    user.userId,
    params.caseStatus,
    reloadTable,
    users,
    loadingUsers,
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
            <TransactionStateSearchButton
              transactionState={params.transactionState ?? []}
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
    />
  );
}
