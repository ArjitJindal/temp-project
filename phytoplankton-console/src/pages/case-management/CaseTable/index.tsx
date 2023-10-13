import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import _ from 'lodash';
import { useMutation } from '@tanstack/react-query';
import { TableSearchParams } from '../types';
import CasesStatusChangeButton from '../components/CasesStatusChangeButton';
import { ApproveSendBackButton } from '../components/ApproveSendBackButton';
import AlertTable from '../AlertTable';
import { Case, CasesAssignmentsUpdateRequest, CasesReviewAssignmentsUpdateRequest } from '@/apis';
import { QueryResult } from '@/utils/queries/types';
import { useAuth0User, useHasPermissions, useUsers } from '@/utils/user-utils';
import {
  AllParams,
  DerivedColumn,
  TableColumn,
  TableRefType,
} from '@/components/library/Table/types';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import {
  useCaseAssignmentUpdateMutation,
  useCaseReviewAssignmentUpdateMutation,
  useTableData,
} from '@/pages/case-management/CaseTable/helpers';
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
import { useCaseAlertFilters } from '@/pages/case-management/helpers';
import {
  ASSIGNMENTS,
  CASE_STATUS,
  CASEID,
  DATE,
  NUMBER,
  PRIORITY,
  RISK_LEVEL,
  USER_NAME,
} from '@/components/library/Table/standardDataTypes';
import { RiskLevel } from '@/utils/risk-levels';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import {
  canReviewCases,
  findLastStatusForInReview,
  getSingleCaseStatusCurrent,
  getSingleCaseStatusPreviousForInReview,
  isInReviewCases,
  isOnHoldOrInProgress,
  statusInProgressOrOnHold,
  statusEscalated,
  statusInReview,
} from '@/utils/case-utils';
import Id from '@/components/ui/Id';
import { denseArray } from '@/utils/lang';

interface Props {
  params: AllParams<TableSearchParams>;
  queryResult: QueryResult<PaginatedData<Case>>;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
  rules: { value: string; label: string }[];
  showAssignedToFilter?: boolean;
}

export default function CaseTable(props: Props) {
  const { queryResult, params, onChangeParams, showAssignedToFilter } = props;

  const tableQueryResult = useTableData(queryResult);
  const tableRef = useRef<TableRefType>(null);
  const user = useAuth0User();
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const [selectedCases, setSelectedCases] = useState<string[]>([]);

  const reloadTable = useCallback(() => {
    tableRef.current?.reload();
  }, []);

  const api = useApi();
  const caseReviewAssignmentUpdateMutation = useCaseReviewAssignmentUpdateMutation(tableRef);
  const caseAssignmentUpdateMutation = useCaseAssignmentUpdateMutation(tableRef);

  const casesAssignmentUpdateMutation = useMutation<unknown, Error, CasesAssignmentsUpdateRequest>(
    async ({ caseIds, assignments }) =>
      await api.patchCasesAssignment({ CasesAssignmentsUpdateRequest: { caseIds, assignments } }),
    {
      onSuccess: () => {
        reloadTable();
        message.success('Assignee updated successfully');
      },
      onError: () => {
        message.fatal('Failed to update bulk assignees');
      },
    },
  );

  const casesReviewAssignmentUpdateMutation = useMutation<
    unknown,
    Error,
    CasesReviewAssignmentsUpdateRequest
  >(
    async ({ caseIds, reviewAssignments }) =>
      await api.patchCasesReviewAssignment({
        CasesReviewAssignmentsUpdateRequest: { caseIds, reviewAssignments },
      }),
    {
      onSuccess: () => {
        reloadTable();
        message.success('Review assignee updated successfully');
      },
      onError: () => {
        message.fatal('Failed to update bulk review assignees');
      },
    },
  );

  useEffect(() => {
    reloadTable();
  }, [params.caseStatus, reloadTable]);

  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true });

  const columns: TableColumn<TableItem>[] = useMemo(() => {
    const helper = new ColumnHelper<TableItem>();
    const mergedColumns: TableColumn<TableItem>[] = [
      helper.simple<'priority'>({
        title: '',
        key: 'priority',
        type: PRIORITY,
        defaultWidth: 40,
        enableResizing: false,
        disableColumnShuffling: true,
        sorting: true,
      }),
      helper.simple<'caseId'>({
        title: 'Case ID',
        key: 'caseId',
        type: CASEID,
        sorting: true,
      }),
      helper.simple<'createdTimestamp'>({
        title: 'Created at',
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
        defaultWidth: 200,
        type: {
          render: (userId, { item: caseItem }) => {
            const { user } = caseItem;
            return (
              <div style={{ overflowWrap: 'anywhere' }}>
                <Id to={getUserLink(user)}>{userId}</Id>
              </div>
            );
          },
        },
      }),
      helper.simple<'user'>({
        title: 'User name',
        id: '_userName',
        key: 'user',
        type: USER_NAME,
        sorting: true,
      }),
      helper.simple<'caseTransactionsCount'>({
        title: 'Transactions hit',
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
        icon: <AccountCircleLineIcon />,
        type: {
          render: (value) => (value ? <UserKycStatusTag kycStatusDetails={value} /> : <></>),
        },
      }),
      ...((isRiskLevelsEnabled
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
        defaultWidth: 300,
        enableResizing: false,
        type: {
          ...ASSIGNMENTS,
          stringify: (value) => {
            return `${value?.map((x) => users[x.assigneeUserId]?.email ?? '').join(',') ?? ''}`;
          },
          render: (__, { item: entity }) => {
            const isStatusInReview = statusInReview(entity.caseStatus);
            const assignments =
              statusEscalated(entity.caseStatus) || isStatusInReview
                ? entity.reviewAssignments
                : entity.assignments;
            const otherStatuses = isOnHoldOrInProgress(entity.caseStatus!);
            return (
              <AssigneesDropdown
                assignments={assignments || []}
                editing={!(isStatusInReview || otherStatuses)}
                onChange={(assignees) => {
                  const assignments = assignees.map((assigneeUserId) => ({
                    assignedByUserId: user.userId,
                    assigneeUserId,
                    timestamp: Date.now(),
                  }));

                  if (!entity.caseId) {
                    message.fatal('Case ID is missing');
                    return;
                  }

                  if (statusEscalated(entity.caseStatus)) {
                    caseReviewAssignmentUpdateMutation.mutate({
                      caseIds: [entity.caseId],
                      reviewAssignments: assignments,
                    });
                    return;
                  } else {
                    caseAssignmentUpdateMutation.mutate({
                      caseIds: [entity.caseId],
                      assignments,
                    });
                  }
                }}
              />
            );
          },
        },
      }),
      helper.simple<'caseStatus'>({
        title: 'Case status',
        key: 'caseStatus',
        type: CASE_STATUS<TableItem>({
          reload: reloadTable,
        }),
      }),
      helper.simple<'updatedAt'>({
        title: 'Last updated',
        key: 'updatedAt',
        type: DATE,
        filtering: true,
        sorting: true,
      }),
      helper.display({
        title: 'Operations',
        enableResizing: false,
        defaultWidth: 200,
        render: (entity) => {
          if (!entity.caseId) {
            return <></>;
          }
          const isInReview = isInReviewCases({
            [entity.caseId]: entity,
          });
          const canReview = canReviewCases({ [entity.caseId]: entity }, user.userId);
          const previousStatus = findLastStatusForInReview(entity.statusChanges ?? []);

          return (
            <>
              {entity?.caseId && !statusInReview(entity.caseStatus) && (
                <CasesStatusChangeButton
                  caseIds={[entity.caseId]}
                  caseStatus={entity.caseStatus}
                  onSaved={reloadTable}
                  statusTransitions={{
                    OPEN_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                    OPEN_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                    ESCALATED_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                    ESCALATED_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                  }}
                />
              )}
              {entity?.caseId && isInReview && canReview && entity.caseStatus && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <ApproveSendBackButton
                    ids={[entity.caseId]}
                    onReload={reloadTable}
                    type="CASE"
                    previousStatus={previousStatus}
                    status={entity.caseStatus}
                    key={entity.caseId}
                  />
                </div>
              )}
            </>
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
              stringify: (value) => {
                return `${value === undefined ? '' : users[value]?.name ?? value}`;
              },
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

    return mergedColumns;
  }, [
    user.userId,
    params.caseStatus,
    reloadTable,
    users,
    loadingUsers,
    isRiskLevelsEnabled,
    caseAssignmentUpdateMutation,
    caseReviewAssignmentUpdateMutation,
  ]);

  const escalationEnabled = useFeatureEnabled('ESCALATION');
  const filterIds = denseArray([
    'caseId',
    'alertPriority',
    'caseTypesFilter',
    'rulesHitFilter',
    'userId',
    'tagKey',
    'businessIndustryFilter',
    'riskLevels',
    'ruleQueueIds',
    'ruleNature',
    showAssignedToFilter && 'assignedTo',
  ]);
  const filters = useCaseAlertFilters(filterIds);
  const exportPermissions = useHasPermissions(['case-management:export:read']);
  return (
    <QueryResultsTable<TableItem, TableSearchParams>
      innerRef={tableRef}
      tableId="case-table"
      renderExpanded={(record) => (
        <>
          {record.caseId && (
            <AlertTable
              isEmbedded={true}
              params={{
                ...DEFAULT_PARAMS_STATE,
                caseId: record.caseId,
                alertPriority: params.alertPriority,
              }}
              escalatedTransactionIds={record.caseHierarchyDetails?.childTransactionIds || []}
              expandTransactions={false}
            />
          )}
        </>
      )}
      queryResults={tableQueryResult}
      params={params}
      onChangeParams={onChangeParams}
      extraFilters={filters}
      selectionInfo={
        selectedCases.length
          ? {
              entityName: 'case',
              entityCount: selectedCases.length,
            }
          : undefined
      }
      selectionActions={[
        ({ selectedIds, selectedItems, isDisabled }) => {
          const selectedCaseStatuses = new Set(
            Object.values(selectedItems).map((item) => item.caseStatus),
          );

          if ([...selectedCaseStatuses].find((status) => statusInProgressOrOnHold(status))) {
            return;
          }

          return (
            <AssignToButton
              isDisabled={isDisabled}
              onSelect={(account) => {
                if (selectedCaseStatuses.has('ESCALATED') && selectedCaseStatuses.size === 1) {
                  casesReviewAssignmentUpdateMutation.mutate({
                    caseIds: selectedIds,
                    reviewAssignments: [
                      {
                        assignedByUserId: user.userId,
                        assigneeUserId: account.id,
                        timestamp: Date.now(),
                      },
                    ],
                  });
                } else {
                  casesAssignmentUpdateMutation.mutate({
                    caseIds: selectedIds,
                    assignments: [
                      {
                        assignedByUserId: user.userId,
                        assigneeUserId: account.id,
                        timestamp: Date.now(),
                      },
                    ],
                  });
                }
              }}
            />
          );
        },
        ({ selectedIds, isDisabled, selectedItems }) => {
          if (_.isEmpty(selectedItems)) return;

          const isInReview = isInReviewCases(selectedItems);
          const caseStatus = selectedItems[selectedIds[0]].caseStatus;
          return (
            !isInReview && (
              <CasesStatusChangeButton
                caseIds={selectedIds}
                onSaved={reloadTable}
                caseStatus={caseStatus}
                isDisabled={isDisabled}
                statusTransitions={{
                  OPEN_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                  OPEN_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                  ESCALATED_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                  ESCALATED_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                }}
              />
            )
          );
        },
        ({ selectedIds, selectedItems, isDisabled }) => {
          if (_.isEmpty(selectedItems)) return;

          const [currentCaseStatus, isSingle] = getSingleCaseStatusCurrent(selectedItems);
          const [previousCaseStatus, isSinglePrevious] =
            getSingleCaseStatusPreviousForInReview(selectedItems);
          const userCanReviewCases = canReviewCases(selectedItems, user.userId);
          const inReviewCases = isInReviewCases(selectedItems);

          return (
            inReviewCases &&
            userCanReviewCases && (
              <ApproveSendBackButton
                ids={selectedIds}
                onReload={reloadTable}
                type="CASE"
                isDisabled={isDisabled}
                status={currentCaseStatus}
                isApproveHidden={!isSingle}
                isDeclineHidden={!isSinglePrevious}
                previousStatus={previousCaseStatus}
              />
            )
          );
        },
        ({ selectedIds, selectedItems, isDisabled }) => {
          if (_.isEmpty(selectedItems)) return;

          const selectedIdsCount = selectedIds.length;
          const caseItem = selectedItems[selectedIds[0]];
          const caseClosedBefore = Boolean(
            caseItem.statusChanges?.find((statusChange) => statusChange.caseStatus === 'CLOSED'),
          );
          const isInReview = isInReviewCases(selectedItems);
          return (
            selectedIdsCount === 1 &&
            escalationEnabled &&
            !isInReview && (
              <CasesStatusChangeButton
                caseIds={selectedIds}
                caseStatus={caseItem.caseStatus}
                onSaved={reloadTable}
                isDisabled={isDisabled}
                statusTransitions={{
                  OPEN: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  REOPENED: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  ESCALATED: {
                    status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                    actionLabel: 'Send back',
                  },
                  CLOSED: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  OPEN_IN_PROGRESS: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  OPEN_ON_HOLD: { status: 'ESCALATED', actionLabel: 'Escalate' },
                  ESCALATED_IN_PROGRESS: {
                    status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                    actionLabel: 'Send back',
                  },
                  ESCALATED_ON_HOLD: {
                    status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                    actionLabel: 'Send back',
                  },
                }}
              />
            )
          );
        },
      ]}
      onSelect={(ids) => setSelectedCases(ids)}
      rowKey="caseId"
      columns={columns}
      pagination={true}
      fitHeight={true}
      fixedExpandedContainer={true}
      toolsOptions={{
        reload: true,
        download: exportPermissions,
        setting: true,
      }}
    />
  );
}
