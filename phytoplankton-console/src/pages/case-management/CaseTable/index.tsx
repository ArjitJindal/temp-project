import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { isEmpty } from 'lodash';
import { firstLetterUpper, humanizeConstant } from '@flagright/lib/utils/humanize';
import { TableSearchParams } from '../types';
import CasesStatusChangeButton from '../components/CasesStatusChangeButton';
import { ApproveSendBackButton } from '../components/ApproveSendBackButton';
import AlertTable from '../AlertTable';
import { getSlaColumnsForExport } from '../helpers';
import SlaStatus from '../components/SlaStatus';
import {
  Case,
  CasesAssignmentsUpdateRequest,
  CasesReviewAssignmentsUpdateRequest,
  Comment,
} from '@/apis';
import { QueryResult } from '@/utils/queries/types';
import { useAuth0User, useHasPermissions, useUsers } from '@/utils/user-utils';
import {
  AllParams,
  DerivedColumn,
  TableColumn,
  TableRefType,
} from '@/components/library/Table/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import {
  useCaseAssignmentUpdateMutation,
  useCaseReviewAssignmentUpdateMutation,
  useTableData,
} from '@/pages/case-management/CaseTable/helpers';
import { TableItem } from '@/pages/case-management/CaseTable/types';
import { getUserLink } from '@/utils/api/users';
import UserKycStatusTag from '@/components/library/Tag/UserKycStatusTag';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import UserStateTag from '@/components/library/Tag/UserStateTag';
import { PaginatedData, useQuery } from '@/utils/queries/hooks';
import ClosingReasonTag from '@/components/library/Tag/ClosingReasonTag';
import { ConsoleUserAvatar } from '@/pages/case-management/components/ConsoleUserAvatar';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import AccountCircleLineIcon from '@/components/ui/icons/Remix/user/account-circle-line.react.svg';
import CalendarLineIcon from '@/components/ui/icons/Remix/business/calendar-line.react.svg';
import AssignToButton from '@/pages/case-management/components/AssignToButton';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import { useCaseAlertFilters } from '@/pages/case-management/helpers';
import {
  ASSIGNMENTS,
  CASE_STATUS,
  CASE_USER_NAME,
  CASEID,
  DATE,
  NUMBER,
  PRIORITY,
  RISK_LEVEL,
  STATUS_CHANGE_PATH,
} from '@/components/library/Table/standardDataTypes';
import { RiskLevel } from '@/utils/risk-levels';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import {
  canAssignToUser,
  canMutateEscalatedCases,
  canReviewCases,
  casesCommentsGenerator,
  createAssignments,
  findLastStatusForInReview,
  getAssignmentsToShow,
  getNextStatusFromInReview,
  getSingleCaseStatusCurrent,
  getSingleCaseStatusPreviousForInReview,
  isEscalatedCases,
  isInReviewCases,
  statusEscalated,
  statusEscalatedL2,
  statusInReview,
} from '@/utils/case-utils';
import Id from '@/components/ui/Id';
import { denseArray, neverReturn } from '@/utils/lang';
import { USER_STATES } from '@/apis/models-custom/UserState';
import { useDeepEqualEffect } from '@/utils/hooks';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';
import { getOr } from '@/utils/asyncResource';
import { SLA_POLICY_LIST } from '@/utils/queries/keys';

interface Props<FirstModalProps, SecondModalProps> {
  params: AllParams<TableSearchParams>;
  queryResult: QueryResult<PaginatedData<Case>>;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
  rules: { value: string; label: string }[];
  showAssignedToFilter?: boolean;
  updateFirstModalState: (newState: FirstModalProps) => void;
  setFirstModalVisibility: (visibility: boolean) => void;
  updateSecondModalState: (newState: SecondModalProps) => void;
  setSecondModalVisibility: (visibility: boolean) => void;
}

export default function CaseTable<FirstModalProps, SecondModalProps>(
  props: Props<FirstModalProps, SecondModalProps>,
) {
  const {
    queryResult,
    params,
    onChangeParams,
    showAssignedToFilter,
    updateFirstModalState,
    setFirstModalVisibility,
    updateSecondModalState,
    setSecondModalVisibility,
  } = props;

  const settings = useSettings();
  const tableQueryResult = useTableData(queryResult);
  const tableRef = useRef<TableRefType>(null);
  const user = useAuth0User();
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const isInReview =
    params.caseStatus == null ||
    params.caseStatus.length === 0 ||
    params.caseStatus.includes('IN_REVIEW') ||
    false;
  const isMultiLevelEscalationEnabled = useFeatureEnabled('MULTI_LEVEL_ESCALATION');

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

  useDeepEqualEffect(() => {
    reloadTable();
  }, [params.caseStatus, reloadTable]);

  const [users, loadingUsers] = useUsers({ includeBlockedUsers: true });

  const userAccount = users[user.userId];

  const slaEnabled = useFeatureEnabled('PNB');

  const slaPoliciesQueryResult = useQuery(SLA_POLICY_LIST(), async () => {
    return await api.getSlaPolicies({
      pageSize: 100,
    });
  });
  const slaPolicies = getOr(slaPoliciesQueryResult.data, {
    items: [],
    total: 0,
  });
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
        headerTitle: 'Priority',
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
        title: `${firstLetterUpper(settings.userAlias)} ID`,
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
          stringify(value, item) {
            return `${item.user?.userId ?? '-'}`;
          },
          link: (value, item) => getUserLink(item.user) ?? '',
        },
      }),
      helper.simple<'user'>({
        title: `${firstLetterUpper(settings.userAlias)} name`,
        id: '_userName',
        key: 'user',
        type: CASE_USER_NAME,
        sorting: true,
      }),
      helper.simple<'caseTransactionsCount'>({
        title: 'Transactions hit',
        type: NUMBER,
        key: 'caseTransactionsCount',
        sorting: true,
      }),
      helper.simple<'user.userStateDetails.state'>({
        title: `${firstLetterUpper(settings.userAlias)} status`,
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
          render: (value) => (value ? <UserKycStatusTag kycStatusDetails={value} /> : <>-</>),
          stringify: (value) => value?.status ?? '',
        },
      }),
      ...((isRiskLevelsEnabled
        ? [
            helper.derived<RiskLevel>({
              param: 'riskLevels',
              value: (entity): RiskLevel | undefined => entity?.userRiskLevel,
              type: RISK_LEVEL,
              title: `${firstLetterUpper(settings.userAlias)} risk level`,
            } as DerivedColumn<TableItem, RiskLevel>),
          ]
        : []) as TableColumn<TableItem>[]),
      helper.simple<'assignments'>({
        title: 'Assigned to',
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
            return (
              <AssigneesDropdown
                assignments={getAssignmentsToShow(entity) ?? []}
                editing={!(entity.caseStatus === 'CLOSED')}
                customFilter={(account) =>
                  canAssignToUser(
                    entity.caseStatus ?? 'OPEN',
                    account,
                    isMultiLevelEscalationEnabled,
                  )
                }
                onChange={(assignees) => {
                  const [assignments, isReview] = createAssignments(
                    entity.caseStatus ?? 'OPEN',
                    assignees,
                    isMultiLevelEscalationEnabled,
                    user.userId,
                  );

                  if (!entity.caseId) {
                    message.fatal('Case ID is missing');
                    return;
                  }

                  if (isReview) {
                    caseReviewAssignmentUpdateMutation.mutate({
                      caseIds: [entity.caseId],
                      reviewAssignments: assignments,
                    });
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
      helper.derived({
        title: 'Assigned to role',
        id: '_assigneeRole',
        value: (item) =>
          statusEscalated(item.caseStatus) || statusInReview(item.caseStatus)
            ? item.reviewAssignments
            : item.assignments,
        type: {
          ...ASSIGNMENTS,
          stringify: (value) => {
            return `${value?.map((x) => users[x.assigneeUserId]?.role ?? '').join(',') ?? ''}`;
          },
        },
        hideInTable: true,
        exporting: true,
      }) as TableColumn<TableItem>,
      helper.simple<'caseStatus'>({
        title: 'Case status',
        key: 'caseStatus',
        type: CASE_STATUS<TableItem>({
          reload: reloadTable,
        }),
      }),
      helper.simple<'statusChanges'>({
        title: 'Status changes',
        key: 'statusChanges',
        type: STATUS_CHANGE_PATH('CASE'),
        hideInTable: true,
        exporting: true,
      }),
      helper.simple<'updatedAt'>({
        title: 'Last updated',
        key: 'updatedAt',
        type: DATE,
        filtering: true,
        sorting: true,
      }),
      ...((slaEnabled
        ? [
            helper.display({
              title: 'SLA status',
              render: (entity) => {
                return <SlaStatus slaPolicyDetails={entity.slaPolicyDetails} />;
              },
            }),
            ...getSlaColumnsForExport(helper, slaPolicies.items ?? []),
          ]
        : []) as TableColumn<TableItem>[]),
      ...((isInReview
        ? [
            helper.simple<'proposedAction'>({
              title: 'Proposed action',
              tooltip: 'Proposed action for the case',
              key: 'proposedAction',
              type: {
                render: (caseStatus) => {
                  return caseStatus ? (
                    <>
                      {
                        <CaseStatusTag
                          caseStatus={getNextStatusFromInReview(caseStatus ?? 'OPEN')}
                          isProposedAction={true}
                        />
                      }
                    </>
                  ) : (
                    <>-</>
                  );
                },
              },
            }),
            helper.simple<'lastStatusChange.userId'>({
              title: 'Proposed by',
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
          ]
        : []) as TableColumn<TableItem>[]),
      helper.display({
        title: 'Operations',
        enableResizing: false,
        defaultWidth: 210,
        render: (entity) => {
          if (!entity.caseId) {
            return <>-</>;
          }
          const isInReview = isInReviewCases({
            [entity.caseId]: entity,
          });
          const canReview = canReviewCases({ [entity.caseId]: entity }, user.userId);
          const previousStatus = findLastStatusForInReview(entity.statusChanges ?? []);
          const isEscalated = statusEscalated(entity.caseStatus);
          const isEscalatedL2 = statusEscalatedL2(entity.caseStatus);
          const caseUser = entity.user ?? undefined;
          const canMutateCases = canMutateEscalatedCases(
            { [entity.caseId]: entity },
            user.userId,
            isMultiLevelEscalationEnabled,
          );
          return (
            <>
              {entity?.caseId && !statusInReview(entity.caseStatus) && !isEscalated && (
                <CasesStatusChangeButton
                  caseIds={[entity.caseId]}
                  caseStatus={entity.caseStatus}
                  onSaved={reloadTable}
                  statusTransitions={{
                    OPEN_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                    OPEN_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                  }}
                  updateModalState={(modalState) => {
                    updateFirstModalState(modalState as FirstModalProps);
                  }}
                  setModalVisibility={setFirstModalVisibility}
                  haveModal={false}
                  user={caseUser}
                />
              )}
              {entity?.caseId &&
                !statusInReview(entity.caseStatus) &&
                isEscalated &&
                !isEscalatedL2 &&
                canMutateCases && (
                  <CasesStatusChangeButton
                    caseIds={[entity.caseId]}
                    caseStatus={entity.caseStatus}
                    onSaved={reloadTable}
                    statusTransitions={{
                      ESCALATED_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                      ESCALATED_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                    }}
                    updateModalState={(modalState) => {
                      updateFirstModalState(modalState as FirstModalProps);
                    }}
                    setModalVisibility={setFirstModalVisibility}
                    haveModal={false}
                    user={caseUser}
                  />
                )}
              {entity?.caseId &&
                !statusInReview(entity.caseStatus) &&
                isEscalatedL2 &&
                canMutateCases &&
                userAccount?.escalationLevel === 'L2' && (
                  <CasesStatusChangeButton
                    caseIds={[entity.caseId]}
                    caseStatus={entity.caseStatus}
                    onSaved={reloadTable}
                    statusTransitions={{
                      ESCALATED_L2: { actionLabel: 'Close', status: 'CLOSED' },
                    }}
                    updateModalState={(modalState) => {
                      updateFirstModalState(modalState as FirstModalProps);
                    }}
                    setModalVisibility={setFirstModalVisibility}
                    haveModal={false}
                    user={caseUser}
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
    if (
      params.caseStatus == null ||
      params.caseStatus.length === 0 ||
      params.caseStatus.some((x) => x !== 'OPEN')
    ) {
      mergedColumns.push(
        helper.derived<TableItem['lastStatusChangeReasons']>({
          title: 'Reason',
          id: 'readon',
          value: (value) => {
            const { lastStatusChangeReasons, caseStatus } = value;
            if (
              caseStatus == null ||
              caseStatus === 'OPEN' ||
              caseStatus === 'OPEN_IN_PROGRESS' ||
              caseStatus === 'OPEN_ON_HOLD' ||
              caseStatus === 'REOPENED'
            ) {
              return null;
            }
            if (
              caseStatus === 'CLOSED' ||
              statusEscalated(caseStatus) ||
              statusEscalatedL2(caseStatus) ||
              statusInReview(caseStatus)
            ) {
              return lastStatusChangeReasons ?? null;
            }
            return neverReturn(caseStatus, lastStatusChangeReasons);
          },
          type: {
            render: (lastStatusChangeReasons): JSX.Element => {
              return lastStatusChangeReasons ? (
                <>
                  {lastStatusChangeReasons.reasons.map((closingReason, index) => (
                    <ClosingReasonTag key={index}>{closingReason}</ClosingReasonTag>
                  ))}
                  {lastStatusChangeReasons.otherReason && (
                    <div>
                      <span>Other Reasons: </span>
                      {lastStatusChangeReasons.otherReason}
                    </div>
                  )}
                </>
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
        }) as TableColumn<TableItem>,
        helper.simple<'lastStatusChange.userId'>({
          title: 'Status changed by',
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
      );
    }

    mergedColumns.push(
      helper.simple<'comments'>({
        hideInTable: true,
        key: 'comments',
        title: 'Status change comments',
        filtering: false,
        exporting: true,
        type: {
          stringify: (comments: Comment[] | undefined, item: TableItem) =>
            casesCommentsGenerator(
              comments ?? [],
              item.alerts ?? [],
              users,
              'STATUS_CHANGE',
            ).trim(),
        },
      }),
    );

    mergedColumns.push(
      helper.simple<'comments'>({
        hideInTable: true,
        key: 'comments',
        title: 'Comments',
        filtering: false,
        exporting: true,
        type: {
          stringify: (comments: Comment[] | undefined, item: TableItem) =>
            casesCommentsGenerator(comments ?? [], item.alerts ?? [], users).trim(),
        },
      }),
    );

    return mergedColumns;
  }, [
    isRiskLevelsEnabled,
    reloadTable,
    slaEnabled,
    slaPolicies.items,
    isInReview,
    params.caseStatus,
    users,
    user.userId,
    caseReviewAssignmentUpdateMutation,
    caseAssignmentUpdateMutation,
    loadingUsers,
    isMultiLevelEscalationEnabled,
    updateFirstModalState,
    setFirstModalVisibility,
    userAccount?.escalationLevel,
    settings.userAlias,
  ]);

  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
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
    showAssignedToFilter && 'roleAssignedTo',
    'caseStatus',
    'caseSla',
  ]);
  const filters = useCaseAlertFilters(filterIds);
  const exportPermissions = useHasPermissions(['case-management:export:read']);
  return (
    <QueryResultsTable<TableItem, TableSearchParams>
      innerRef={tableRef}
      tableId="case-table"
      expandedRowId={params.caseId}
      renderExpanded={(record) => (
        <>
          {record.caseId && (
            <AlertTable<SecondModalProps>
              isEmbedded={true}
              params={{
                ...DEFAULT_PARAMS_STATE,
                caseId: record.caseId,
                alertPriority: params.alertPriority,
              }}
              escalatedTransactionIds={record.caseHierarchyDetails?.childTransactionIds || []}
              expandTransactions={false}
              updateModalState={updateSecondModalState}
              setModalVisibility={setSecondModalVisibility}
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

          // this is for multi-level escalation (PNB)
          // if any of the selected cases have a different escalation level, then we don't allow the assignment
          if (isMultiLevelEscalationEnabled) {
            // ensure cases are all escalated and of the same level
            const someEscalated = [...selectedCaseStatuses].some(
              (status) => statusEscalated(status) || statusEscalatedL2(status),
            );
            if (!someEscalated) {
              return;
            }
            if (selectedCaseStatuses.size > 1) {
              return;
            }

            // get the escalation level from selectedCaseStatuses[0]
            const isL2Escalated = statusEscalatedL2(selectedCaseStatuses[0]);
            const escalationLevel = isL2Escalated ? 'L2' : 'L1';

            return (
              <AssignToButton
                isDisabled={isDisabled}
                userFilter={(account) => account?.escalationLevel === escalationLevel}
                onSelect={(account) => {
                  casesReviewAssignmentUpdateMutation.mutate({
                    caseIds: selectedIds,
                    reviewAssignments: [
                      {
                        assignedByUserId: user.userId,
                        assigneeUserId: account.id,
                        timestamp: Date.now(),
                        escalationLevel: escalationLevel,
                      },
                    ],
                  });
                }}
              />
            );
          }

          // ensure cases are all in the same status
          if (selectedCaseStatuses.size > 1) {
            return;
          }
          const caseStatus = selectedCaseStatuses[0];

          return (
            <AssignToButton
              isDisabled={isDisabled}
              onSelect={(account) => {
                const [assignments, isReview] = createAssignments(
                  caseStatus,
                  [account.id],
                  isMultiLevelEscalationEnabled,
                  user.userId,
                );

                if (isReview) {
                  casesReviewAssignmentUpdateMutation.mutate({
                    caseIds: selectedIds,
                    reviewAssignments: assignments,
                  });
                } else {
                  casesAssignmentUpdateMutation.mutate({
                    caseIds: selectedIds,
                    assignments,
                  });
                }
              }}
            />
          );
        },
        ({ selectedIds, isDisabled, selectedItems }) => {
          if (isEmpty(selectedItems)) {
            return;
          }

          const isInReview = isInReviewCases(selectedItems);
          const caseStatus = selectedItems[selectedIds[0]].caseStatus;
          const caseUser = selectedItems[selectedIds[0]].user ?? undefined;
          const isEscalated = isEscalatedCases(selectedItems);
          return (
            !isInReview &&
            !isEscalated && (
              <CasesStatusChangeButton
                caseIds={selectedIds}
                onSaved={reloadTable}
                caseStatus={caseStatus}
                isDisabled={isDisabled}
                statusTransitions={{
                  OPEN_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                  OPEN_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                }}
                updateModalState={(modalState) => {
                  updateFirstModalState(modalState as FirstModalProps);
                }}
                user={caseUser}
                setModalVisibility={setFirstModalVisibility}
                haveModal={false}
              />
            )
          );
        },
        ({ selectedIds, isDisabled, selectedItems }) => {
          if (isEmpty(selectedItems)) {
            return;
          }

          const isInReview = isInReviewCases(selectedItems);
          const caseStatus = selectedItems[selectedIds[0]].caseStatus;
          const caseUser = selectedItems[selectedIds[0]].user ?? undefined;
          const isEscalated = isEscalatedCases(selectedItems);
          const canMutateCases = canMutateEscalatedCases(
            selectedItems,
            user.userId,
            isMultiLevelEscalationEnabled,
          );
          return (
            !isInReview &&
            isEscalated &&
            canMutateCases && (
              <CasesStatusChangeButton
                caseIds={selectedIds}
                onSaved={reloadTable}
                caseStatus={caseStatus}
                isDisabled={isDisabled}
                statusTransitions={{
                  ESCALATED_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                  ESCALATED_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                }}
                updateModalState={(modalState) => {
                  updateFirstModalState(modalState as FirstModalProps);
                }}
                user={caseUser}
                setModalVisibility={setFirstModalVisibility}
                haveModal={false}
              />
            )
          );
        },
        ({ selectedIds, selectedItems, isDisabled }) => {
          if (isEmpty(selectedItems)) {
            return;
          }

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
          if (
            !isMultiLevelEscalationEnabled ||
            !escalationEnabled ||
            selectedIds.length !== 1 ||
            !selectedItems ||
            isEmpty(selectedItems)
          ) {
            return;
          }

          const canMutateCases = canMutateEscalatedCases(
            selectedItems,
            user.userId,
            isMultiLevelEscalationEnabled,
          );

          const caseItem = selectedItems[selectedIds[0]];

          if (
            statusEscalatedL2(caseItem.caseStatus) ||
            !statusEscalated(caseItem.caseStatus) ||
            !canMutateCases
          ) {
            return;
          }
          const caseUser = selectedItems[selectedIds[0]].user ?? undefined;

          return (
            <CasesStatusChangeButton
              caseIds={selectedIds}
              caseStatus={caseItem.caseStatus}
              onSaved={reloadTable}
              isDisabled={isDisabled}
              statusTransitions={{
                ESCALATED: { status: 'ESCALATED_L2', actionLabel: 'Escalate L2' },
                ESCALATED_IN_PROGRESS: { status: 'ESCALATED_L2', actionLabel: 'Escalate L2' },
                ESCALATED_ON_HOLD: { status: 'ESCALATED_L2', actionLabel: 'Escalate L2' },
              }}
              updateModalState={(modalState) => {
                updateFirstModalState(modalState as FirstModalProps);
              }}
              user={caseUser}
              setModalVisibility={setFirstModalVisibility}
              haveModal={false}
            />
          );
        },
        ({ selectedIds, selectedItems, isDisabled }) => {
          if (isEmpty(selectedItems)) {
            return;
          }

          const selectedIdsCount = selectedIds.length;
          const caseItem = selectedItems[selectedIds[0]];
          const canMutateCases =
            canMutateEscalatedCases(selectedItems, user.userId, isMultiLevelEscalationEnabled) &&
            userAccount?.escalationLevel === 'L2';
          const isInReview = isInReviewCases(selectedItems);
          const isCaseHavingEscalated = isEscalatedCases(selectedItems);
          const isCaseStatusEscalatedL2 = statusEscalatedL2(caseItem.caseStatus);
          const caseUser = selectedItems[selectedIds[0]].user ?? undefined;
          return (
            selectedIdsCount === 1 &&
            escalationEnabled &&
            isMultiLevelEscalationEnabled &&
            canMutateCases &&
            !isInReview &&
            !isCaseHavingEscalated &&
            isCaseStatusEscalatedL2 && (
              <CasesStatusChangeButton
                caseIds={selectedIds}
                caseStatus={caseItem.caseStatus}
                onSaved={reloadTable}
                isDisabled={isDisabled}
                statusTransitions={{
                  ESCALATED_L2: { status: 'ESCALATED_L2', actionLabel: 'Send back' },
                  ESCALATED_L2_IN_PROGRESS: { status: 'ESCALATED_L2', actionLabel: 'Send back' },
                  ESCALATED_L2_ON_HOLD: { status: 'ESCALATED_L2', actionLabel: 'Send back' },
                }}
                updateModalState={(modalState) => {
                  updateFirstModalState(modalState as FirstModalProps);
                }}
                setModalVisibility={setFirstModalVisibility}
                haveModal={false}
                user={caseUser}
              />
            )
          );
        },
        ({ selectedIds, selectedItems, isDisabled }) => {
          if (isEmpty(selectedItems)) {
            return;
          }

          const selectedIdsCount = selectedIds.length;
          const caseItem = selectedItems[selectedIds[0]];
          const caseClosedBefore = Boolean(
            caseItem.statusChanges?.find((statusChange) => statusChange.caseStatus === 'CLOSED'),
          );
          const isInReview = isInReviewCases(selectedItems);
          const isCaseHavingEscalated = isEscalatedCases(selectedItems);
          const caseUser = selectedItems[selectedIds[0]].user ?? undefined;
          return (
            selectedIdsCount === 1 &&
            escalationEnabled &&
            !isInReview &&
            !isCaseHavingEscalated && (
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
                }}
                updateModalState={(modalState) => {
                  updateFirstModalState(modalState as FirstModalProps);
                }}
                setModalVisibility={setFirstModalVisibility}
                haveModal={false}
                user={caseUser}
              />
            )
          );
        },
        ({ selectedIds, selectedItems, isDisabled }) => {
          if (isEmpty(selectedItems)) {
            return;
          }

          const selectedIdsCount = selectedIds.length;
          const caseItem = selectedItems[selectedIds[0]];
          const caseClosedBefore = Boolean(
            caseItem.statusChanges?.find((statusChange) => statusChange.caseStatus === 'CLOSED'),
          );

          const canMutateCases = canMutateEscalatedCases(
            selectedItems,
            user.userId,
            isMultiLevelEscalationEnabled,
          );
          const isInReview = isInReviewCases(selectedItems);
          const isCaseHavingEscalated = isEscalatedCases(selectedItems);
          const caseUser = selectedItems[selectedIds[0]].user ?? undefined;
          return (
            selectedIdsCount === 1 &&
            escalationEnabled &&
            !isInReview &&
            canMutateCases &&
            isCaseHavingEscalated && (
              <CasesStatusChangeButton
                caseIds={selectedIds}
                caseStatus={caseItem.caseStatus}
                onSaved={reloadTable}
                isDisabled={isDisabled}
                statusTransitions={{
                  ESCALATED: {
                    status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                    actionLabel: 'Send back',
                  },
                  ESCALATED_IN_PROGRESS: {
                    status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                    actionLabel: 'Send back',
                  },
                  ESCALATED_ON_HOLD: {
                    status: caseClosedBefore ? 'REOPENED' : 'OPEN',
                    actionLabel: 'Send back',
                  },
                  ESCALATED_L2: {
                    status: 'ESCALATED',
                    actionLabel: 'Send back',
                  },
                  ESCALATED_L2_IN_PROGRESS: {
                    status: 'ESCALATED',
                    actionLabel: 'Send back',
                  },
                  ESCALATED_L2_ON_HOLD: {
                    status: 'ESCALATED',
                    actionLabel: 'Send back',
                  },
                }}
                updateModalState={(modalState) => {
                  updateFirstModalState(modalState as FirstModalProps);
                }}
                setModalVisibility={setFirstModalVisibility}
                haveModal={false}
                user={caseUser}
              />
            )
          );
        },
      ]}
      selectedIds={selectedCases}
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
