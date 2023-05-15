import React, { useCallback, useMemo, useRef } from 'react';
import _ from 'lodash';
import { TableSearchParams } from '../types';
import CasesStatusChangeButton from '../components/CasesStatusChangeButton';
import AlertTable from '../AlertTable';
import { Account, Case, CaseUpdateRequest } from '@/apis';
import { QueryResult } from '@/utils/queries/types';
import { useAuth0User, useUsers } from '@/utils/user-utils';
import { makeUrl } from '@/utils/routing';
import {
  AllParams,
  DerivedColumn,
  TableColumn,
  TableRefType,
} from '@/components/library/Table/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { useTableData } from '@/pages/case-management/CaseTable/helpers';
import { TableItem } from '@/pages/case-management/CaseTable/types';
import { getUserLink, USER_STATES } from '@/utils/api/users';
import UserKycStatusTag from '@/components/ui/UserKycStatusTag';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import UserStateTag from '@/components/ui/UserStateTag';
import { PaginatedData } from '@/utils/queries/hooks';
import { ClosingReasonTag } from '@/pages/case-management/components/ClosingReasonTag';
import { ConsoleUserAvatar } from '@/pages/case-management/components/ConsoleUserAvatar';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { humanizeConstant } from '@/utils/humanize';
import AccountCircleLineIcon from '@/components/ui/icons/Remix/user/account-circle-line.react.svg';
import CalendarLineIcon from '@/components/ui/icons/Remix/business/calendar-line.react.svg';
import AssignToButton from '@/pages/case-management/components/AssignToButton';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import { makeExtraFilters } from '@/pages/case-management/helpers';
import {
  ASSIGNMENTS,
  CASE_STATUS,
  DATE,
  DATE_TIME,
  NUMBER,
  RISK_LEVEL,
  USER_NAME,
} from '@/components/library/Table/standardDataTypes';
import { RiskLevel } from '@/utils/risk-levels';
import { ColumnHelper } from '@/components/library/Table/columnHelper';

interface Props {
  params: AllParams<TableSearchParams>;
  queryResult: QueryResult<PaginatedData<Case>>;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
  onUpdateCases: (caseIds: string[], updates: CaseUpdateRequest) => void;
  rules: { value: string; label: string }[];
}

export default function CaseTable(props: Props) {
  const { queryResult, params, onUpdateCases, onChangeParams } = props;

  const tableQueryResult = useTableData(queryResult);
  const tableRef = useRef<TableRefType>(null);
  const user = useAuth0User();
  const isPulseEnabled = useFeatureEnabled('PULSE');

  const reloadTable = useCallback(() => {
    tableRef.current?.reload();
  }, []);

  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true });

  const columns: TableColumn<TableItem>[] = useMemo(() => {
    const helper = new ColumnHelper<TableItem>();
    const mergedColumns: TableColumn<TableItem>[] = [
      helper.simple<'caseId'>({
        title: 'Case ID',
        subtitle: 'Priority',
        key: 'caseId',
        type: {
          render: (_value, { item: entity }) => {
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
                {entity.priority && <p>Priority: {entity.priority}</p>}
              </>
            );
          },
        },
        sorting: true,
      }),
      helper.simple<'createdTimestamp'>({
        title: 'Created on',
        key: 'createdTimestamp',
        type: DATE,
        sorting: true,
        filtering: true,
        showFilterByDefault: true,
        icon: <CalendarLineIcon />,
      }),
      helper.simple<'userId'>({
        title: 'User ID',
        key: 'userId',
        type: {
          render: (userId, { item: caseItem }) => {
            return userId ? <Id to={getUserLink(caseItem.user)}>{userId}</Id> : <>{'-'}</>;
          },
        },
      }),
      helper.simple<'user'>({
        title: 'User Name',
        id: '_userName',
        key: 'user',
        type: USER_NAME,
        sorting: true,
      }),
      helper.simple<'caseTransactionsCount'>({
        title: 'Transactions Hit',
        type: NUMBER,
        key: 'caseTransactionsCount',
        sorting: true,
      }),
      helper.simple<'user.userStateDetails.state'>({
        title: 'User status',
        key: 'user.userStateDetails.state',
        id: 'userStates',
        filtering: true,
        icon: <AccountCircleLineIcon />,
        type: {
          render: (value) => (value ? <UserStateTag userState={value} /> : <></>),
          autoFilterDataType: {
            kind: 'select',
            options: USER_STATES.map((state) => ({
              label: humanizeConstant(state),
              value: state,
            })),
            mode: 'MULTIPLE',
            displayMode: 'list',
          },
        },
      }),
      helper.simple<'user.kycStatusDetails'>({
        title: 'KYC status',
        key: 'user.kycStatusDetails',
        id: 'kycStatuses',
        filtering: true,
        icon: <AccountCircleLineIcon />,
        type: {
          render: (value) => (value ? <UserKycStatusTag kycStatusDetails={value} /> : <></>),
          autoFilterDataType: {
            kind: 'select',
            options: USER_STATES.map((state) => ({
              label: humanizeConstant(state),
              value: state,
            })),
            mode: 'MULTIPLE',
            displayMode: 'list',
          },
        },
      }),
      ...((isPulseEnabled
        ? [
            helper.derived<RiskLevel>({
              param: 'riskLevels',
              value: (entity): RiskLevel | undefined =>
                entity?.caseUsers?.originUserRiskLevel ??
                entity?.caseUsers?.destinationUserRiskLevel,
              type: RISK_LEVEL,
              title: 'User risk level',
            } as DerivedColumn<TableItem, RiskLevel>),
          ]
        : []) as TableColumn<TableItem>[]),
      helper.simple<'assignments'>({
        title: 'Assignees',
        key: 'assignments',
        id: '_assignmentName',
        type: {
          ...ASSIGNMENTS,
          render: (assignments, { item: entity }) => {
            return (
              <AssigneesDropdown
                assignments={assignments || []}
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
        sorting: true,
      }),
      helper.simple<'caseStatus'>({
        title: 'Case status',
        key: 'caseStatus',
        type: CASE_STATUS(),
      }),
      helper.display({
        title: 'Operations',
        defaultWidth: 100,
        render: (entity) => {
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
      }),
    ];
    if (params.caseStatus === 'CLOSED') {
      mergedColumns.push(
        ...[
          helper.simple<'lastStatusChangeReasons'>({
            title: 'Closing reason',
            tooltip: 'Reason provided for closing a case',
            key: 'lastStatusChangeReasons',
            type: {
              render: (lastStatusChangeReasons) => {
                return lastStatusChangeReasons ? (
                  <ClosingReasonTag
                    closingReasons={lastStatusChangeReasons.reasons}
                    otherReason={lastStatusChangeReasons.otherReason}
                  />
                ) : (
                  <>-</>
                );
              },
              stringify: (lastStatusChangeReasons) => {
                return [
                  ...(lastStatusChangeReasons?.reasons ?? []),
                  lastStatusChangeReasons?.otherReason,
                ]
                  .filter((x) => !!x)
                  .join('; ');
              },
            },
          }),
          helper.simple<'lastStatusChange.userId'>({
            title: 'Closed by',
            key: 'lastStatusChange.userId',
            type: {
              render: (userId, _) => {
                return userId ? (
                  <ConsoleUserAvatar userId={userId} users={users} loadingUsers={loadingUsers} />
                ) : (
                  <>-</>
                );
              },
            },
          }),
        ],
      );
    }
    mergedColumns.push(
      ...[
        helper.simple<'lastStatusChange.timestamp'>({
          title: 'Last update time',
          key: 'lastStatusChange.timestamp',
          type: DATE_TIME,
          filtering: true,
          sorting: true,
        }),
      ],
    );

    return mergedColumns;
  }, [
    user.userId,
    params.caseStatus,
    reloadTable,
    users,
    loadingUsers,
    onUpdateCases,
    isPulseEnabled,
  ]);

  const api = useApi();

  const handleAssignTo = (account: Account, ids: string[]) => {
    const hideLoading = message.loading('Assigning cases');
    api
      .postCases({
        CasesUpdateRequest: {
          caseIds: ids,
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
  const escalationEnabled = useFeatureEnabled('ESCALATION');
  return (
    <QueryResultsTable<TableItem, TableSearchParams>
      innerRef={tableRef}
      tableId="case-table"
      renderExpanded={(record) => (
        <>
          {record.caseId && (
            <AlertTable
              isEmbedded={true}
              params={{ ...params, caseId: record.caseId }}
              escalatedTransactionIds={record.caseHierarchyDetails?.childTransactionIds || []}
              onChangeParams={onChangeParams}
            />
          )}
        </>
      )}
      queryResults={tableQueryResult}
      params={params}
      onChangeParams={onChangeParams}
      extraFilters={makeExtraFilters(isPulseEnabled, props.rules, false)}
      selectionActions={[
        ({ selectedIds }) => <AssignToButton ids={selectedIds} onSelect={handleAssignTo} />,
        ({ selectedIds, params }) => (
          <CasesStatusChangeButton
            caseIds={selectedIds}
            onSaved={reloadTable}
            caseStatus={params.caseStatus}
          />
        ),
        ({ selectedIds, selectedItems }) => {
          if (_.isEmpty(selectedItems)) return;

          const selectedIdsCount = selectedIds.length;
          const caseItem = selectedItems[selectedIds[0]];
          const caseClosedBefore = Boolean(
            caseItem.statusChanges?.find((statusChange) => statusChange.caseStatus === 'CLOSED'),
          );

          return (
            selectedIdsCount === 1 &&
            escalationEnabled && (
              <CasesStatusChangeButton
                caseIds={selectedIds}
                caseStatus={caseItem.caseStatus}
                onSaved={reloadTable}
                statusTransitions={{
                  OPEN: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  REOPENED: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  ESCALATED: {
                    status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                    actionLabel: 'Send back',
                  },
                  CLOSED: { status: 'ESCALATED', actionLabel: 'Escalate' },
                }}
              />
            )
          );
        },
      ]}
      rowKey="caseId"
      columns={columns}
      pagination={true}
      fitHeight={true}
      fixedExpandedContainer={true}
    />
  );
}
