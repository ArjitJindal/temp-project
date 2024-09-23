import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router';
import SanctionsHitStatusChangeModal from 'src/pages/case-management/AlertTable/SanctionsHitStatusChangeModal';
import { AssigneesDropdown } from '../components/AssigneesDropdown';
import { ApproveSendBackButton } from '../components/ApproveSendBackButton';
import { useAlertQuery } from '../common';
import { useAlertQaAssignmentUpdateMutation } from '../QA/Table';
import { ConsoleUserAvatar } from '../components/ConsoleUserAvatar';
import CreateCaseConfirmModal from './CreateCaseConfirmModal';
import { FalsePositiveTag } from './FalsePositiveTag';
import SlaStatus from './SlaStatus';
import { getSlaColumnsForExport } from './helpers';
import {
  AlertsAssignmentsUpdateRequest,
  AlertsReviewAssignmentsUpdateRequest,
  Assignment,
  ChecklistStatus,
  SanctionHitStatusUpdateRequest,
  SanctionsHitStatus,
} from '@/apis';
import { useApi } from '@/api';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import {
  AllParams,
  SelectionAction,
  TableColumn,
  TableData,
  TableDataSimpleItem,
  TableRefType,
} from '@/components/library/Table/types';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import BrainIcon from '@/components/ui/icons/brain-icon-colored.react.svg';
import { QueryResult } from '@/utils/queries/types';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { getAlertUrl, makeUrl } from '@/utils/routing';
import ExpandedRowRenderer from '@/pages/case-management/AlertTable/ExpandedRowRenderer';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';
import AssignToButton from '@/pages/case-management/components/AssignToButton';
import { useAuth0User, useHasPermissions, useUsers } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { TableSearchParams } from '@/pages/case-management/types';
import { queryAdapter, useCaseAlertFilters } from '@/pages/case-management/helpers';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  ALERT_USER_ID,
  ASSIGNMENTS,
  CASE_STATUS,
  CASEID,
  DATE,
  PRIORITY,
  RULE_ACTION_STATUS,
  RULE_NATURE,
  STATUS_CHANGE_PATH,
} from '@/components/library/Table/standardDataTypes';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { SarButton as SarButton } from '@/components/Sar';
import {
  canReviewCases,
  commentsToString,
  findLastStatusForInReview,
  getNextStatusFromInReview,
  getSingleCaseStatusCurrent,
  getSingleCaseStatusPreviousForInReview,
  isInReviewCases,
  isOnHoldOrInProgressOrEscalated,
  statusEscalated,
  statusInProgressOrOnHold,
  statusInReview,
} from '@/utils/case-utils';
import { CASE_STATUSS } from '@/apis/models-custom/CaseStatus';
import QaStatusChangeModal from '@/pages/case-management/AlertTable/QaStatusChangeModal';
import { useQaEnabled, useQaMode } from '@/utils/qa-mode';
import Button from '@/components/library/Button';
import InvestigativeCoPilotModal from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal';
import { getOr } from '@/utils/asyncResource';
import RuleQueueTag from '@/components/library/Tag/RuleQueueTag';
import { denseArray, getErrorMessage } from '@/utils/lang';
import { useRuleQueues } from '@/components/rules/util';
import { notEmpty } from '@/utils/array';
import { adaptMutationVariables } from '@/utils/queries/mutations/helpers';
import { ALERT_ITEM_COMMENTS, SANCTIONS_HITS_ALL, SLA_POLICY_LIST } from '@/utils/queries/keys';
import { useMutation } from '@/utils/queries/mutations/hooks';
import ClosingReasonTag from '@/components/library/Tag/ClosingReasonTag';
import { useQuery } from '@/utils/queries/hooks';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';

export type AlertTableParams = AllParams<TableSearchParams> & {
  filterQaStatus?: Array<ChecklistStatus | "NOT_QA'd" | undefined>;
};

const getSelectedCaseIdsForAlerts = (selectedItems: Record<string, TableAlertItem>) => {
  const selectedCaseIds = [
    ...new Set(
      Object.values(selectedItems)
        .map(({ caseId }) => caseId)
        .filter((x): x is string => typeof x === 'string'),
    ),
  ];

  return selectedCaseIds;
};

const isAllAlertsOfStatus = (
  selectedItems: Record<string, TableAlertItem>,
  status: string,
): boolean => {
  return Object.values(selectedItems).every((item) => item.alertStatus === status);
};

interface Props {
  params: AlertTableParams;
  onChangeParams?: (newState: AlertTableParams) => void;
  isEmbedded?: boolean;
  showUserFilters?: boolean;
  caseId?: string;
  escalatedTransactionIds?: string[];
  expandTransactions?: boolean;
  showAssignedToFilter?: boolean;
  expandedAlertId?: string;
}

export default function AlertTable(props: Props) {
  const {
    caseId,
    params: externalParams,
    onChangeParams,
    isEmbedded = false,
    showUserFilters = false,
    expandTransactions = true,
    showAssignedToFilter,
    expandedAlertId,
  } = props;
  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
  const sarEnabled = useFeatureEnabled('SAR');
  const slaEnabled = useFeatureEnabled('ALERT_SLA');
  const [qaMode] = useQaMode();
  const qaEnabled = useQaEnabled();
  const api = useApi();
  const queryClient = useQueryClient();
  const user = useAuth0User();
  const [users, loadingUsers] = useUsers({ includeRootUsers: true, includeBlockedUsers: true });

  const [selectedTxns, setSelectedTxns] = useState<{ [alertId: string]: string[] }>({});
  const [selectedSanctionHits, setSelectedSanctionHits] = useState<{
    [alertId: string]: {
      id: string;
      status?: SanctionsHitStatus;
    }[];
  }>({});
  const [isStatusChangeModalVisible, setStatusChangeModalVisible] = useState(false);
  const [statusChangeModalState, setStatusChangeModalState] = useState<SanctionsHitStatus | null>(
    null,
  );

  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);

  const [internalParams, setInternalParams] = useState<AlertTableParams | null>(null);
  const params = useMemo(() => {
    return internalParams ?? externalParams;
  }, [externalParams, internalParams]);
  const selectedTransactionIds = useMemo(() => {
    return Object.values(selectedTxns)
      .flatMap((v) => v)
      .filter(Boolean);
  }, [selectedTxns]);
  const selectedSanctionHitsIds = useMemo(() => {
    return Object.values(selectedSanctionHits)
      .flatMap((v) => v.map((x) => x.id))
      .filter(notEmpty);
  }, [selectedSanctionHits]);
  const selectedSanctionHitsStatuses = useMemo(() => {
    return Object.values(selectedSanctionHits)
      .flatMap((v) => v.map((x) => x.status))
      .filter(notEmpty);
  }, [selectedSanctionHits]);
  const navigate = useNavigate();
  const location = useLocation();

  const assignmentsToMutationAlerts = useMutation<unknown, Error, AlertsAssignmentsUpdateRequest>(
    async ({ alertIds, assignments }) => {
      await api.alertsAssignment({
        AlertsAssignmentsUpdateRequest: {
          alertIds,
          assignments,
        },
      });
    },
    {
      onSuccess: () => {
        message.success('Assignees updated successfully');
        reloadTable();
      },
      onError: (error) => {
        message.fatal(`Unable to assign alert: ${error.message}`);
      },
    },
  );

  const reviewAssignmentsToMutationAlerts = useMutation<
    unknown,
    Error,
    AlertsReviewAssignmentsUpdateRequest
  >(
    async ({ alertIds, reviewAssignments }) => {
      await api.alertsReviewAssignment({
        AlertsReviewAssignmentsUpdateRequest: {
          alertIds,
          reviewAssignments,
        },
      });
    },
    {
      onSuccess: () => {
        message.success('Review assignees updated successfully');
        reloadTable();
      },
      onError: (error) => {
        message.fatal(`Unable to assign alert: ${error.message}`);
      },
    },
  );

  const changeStatusMutation = useMutation<
    unknown,
    unknown,
    {
      alertId: string;
      sanctionHitIds: string[];
      updates: SanctionHitStatusUpdateRequest;
    },
    unknown
  >(
    async (variables: {
      alertId: string;
      sanctionHitIds: string[];
      updates: SanctionHitStatusUpdateRequest;
    }) => {
      const { alertId, sanctionHitIds, updates } = variables;
      const hideMessage = message.loading(`Saving...`);
      try {
        await api.changeSanctionsHitsStatus({
          SanctionHitsStatusUpdateRequest: {
            alertId,
            sanctionHitIds,
            updates,
          },
        });
      } finally {
        hideMessage();
      }
    },
    {
      onError: (e) => {
        message.error(`Failed to update hits! ${getErrorMessage(e)}`);
      },
      onSuccess: async (_, variables) => {
        message.success(`Done!`);
        await queryClient.invalidateQueries(SANCTIONS_HITS_ALL());
        await queryClient.invalidateQueries(ALERT_ITEM_COMMENTS(variables.alertId));
        setSelectedSanctionHits({});
      },
    },
  );

  const isFalsePositiveEnabled = useFeatureEnabled('FALSE_POSITIVE_CHECK');

  const queryResults: QueryResult<TableData<TableAlertItem>> = useAlertQuery(params);

  const actionRef = useRef<TableRefType>(null);

  const qaAssigneesUpdateMutation = useAlertQaAssignmentUpdateMutation(actionRef);

  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const slaPoliciesQueryResult = useQuery(SLA_POLICY_LIST(), async () => {
    return await api.getSlaPolicies({
      pageSize: 100,
    });
  });
  const slaPolicies = getOr(slaPoliciesQueryResult.data, {
    items: [],
    total: 0,
  });
  const handleAlertAssignments = useCallback(
    (updateRequest: AlertsAssignmentsUpdateRequest) => {
      const { alertIds, assignments } = updateRequest;

      assignmentsToMutationAlerts.mutate({
        alertIds,
        assignments,
      });
    },
    [assignmentsToMutationAlerts],
  );

  const handleAlertsReviewAssignments = useCallback(
    (updateRequest: AlertsReviewAssignmentsUpdateRequest) => {
      const { alertIds, reviewAssignments } = updateRequest;

      reviewAssignmentsToMutationAlerts.mutate({
        alertIds,
        reviewAssignments,
      });
    },
    [reviewAssignmentsToMutationAlerts],
  );

  const icpFeatureEnabled = useFeatureEnabled('AI_FORENSICS');
  const icpEnabled = icpFeatureEnabled || user.role === 'root'; // TODO remove this after testing

  const ruleQueues = useRuleQueues();

  const showClosingReason =
    params.caseStatus?.includes('CLOSED') || params.alertStatus?.includes('CLOSED') || false;
  const isInReview = params.caseStatus?.includes('IN_REVIEW') || false;

  const columns = useMemo(() => {
    const mergedColumns = (
      showUserColumns: boolean,
      handleAlertsAssignments: (updateRequest: AlertsAssignmentsUpdateRequest) => void,
      handleAlertsReviewAssignments: (updateRequest: AlertsReviewAssignmentsUpdateRequest) => void,
      handleInvestigateAlert:
        | ((alertInfo: { alertId: string; caseId: string }) => void)
        | undefined,
      userId: string,
      reload: () => void,
      falsePositiveEnabled: boolean,
      selectedTxns: {
        [alertId: string]: string[];
      },
      qaEnabled: boolean,
    ): TableColumn<TableAlertItem>[] => {
      const helper = new ColumnHelper<TableAlertItem>();
      return helper.list([
        helper.simple<'priority'>({
          title: '',
          headerTitle: 'Priority',
          key: 'priority',
          type: PRIORITY,
          disableColumnShuffling: true,
          defaultWidth: 40,
          enableResizing: false,
          sorting: true,
        }),
        helper.simple<'alertId'>({
          title: 'Alert ID',
          key: 'alertId',
          icon: <StackLineIcon />,
          showFilterByDefault: true,
          filtering: true,
          type: {
            render: (alertId, { item: entity }) => {
              const falsePositiveDetails = entity?.ruleHitMeta?.falsePositiveDetails;
              if (caseId !== undefined) {
                return <div>{alertId}</div>;
              }
              return (
                <>
                  <Id
                    to={
                      entity?.caseId != null && alertId != null
                        ? addBackUrlToRoute(getAlertUrl(entity.caseId, alertId))
                        : '#'
                    }
                    testName="alert-id"
                  >
                    {alertId}
                  </Id>
                  {falsePositiveDetails &&
                    falsePositiveDetails.isFalsePositive &&
                    falsePositiveEnabled && (
                      <FalsePositiveTag
                        caseIds={[entity.caseId].filter(notEmpty)}
                        confidence={falsePositiveDetails.confidenceScore}
                        newCaseStatus={'CLOSED'}
                        onSaved={reload}
                        rounded
                      />
                    )}
                </>
              );
            },
            stringify(value, item) {
              return item.alertId ?? '';
            },
            link: (value, item) => {
              return item?.caseId && value ? getAlertUrl(item.caseId, value) : undefined;
            },
          },
        }),
        helper.simple<'caseId'>({
          title: 'Case ID',
          key: 'caseId',
          type: CASEID,
        }),
        helper.simple<'createdTimestamp'>({
          title: 'Created at',
          key: 'createdTimestamp',
          showFilterByDefault: true,
          sorting: true,
          type: DATE,
        }),
        helper.simple<'age'>({
          title: 'Alert age',
          key: 'age',
          sorting: true,
        }),
        helper.simple<'numberOfTransactionsHit'>({
          title: '#TX',
          key: 'numberOfTransactionsHit',
          sorting: true,
        }),
        ...(showUserColumns
          ? [
              helper.simple<'caseUserId'>({
                title: 'User id',
                key: 'caseUserId',
                type: ALERT_USER_ID,
              }),

              helper.simple<'caseUserName'>({
                title: 'User name',
                key: 'caseUserName',
              }),
            ]
          : []),
        helper.simple<'ruleName'>({
          title: 'Rule name',
          key: 'ruleName',
        }),
        helper.simple<'ruleDescription'>({
          title: 'Rule description',
          key: 'ruleDescription',
        }),
        helper.simple<'ruleAction'>({
          title: 'Rule action',
          key: 'ruleAction',
          type: RULE_ACTION_STATUS,
        }),
        helper.simple<'ruleNature'>({
          title: 'Rule nature',
          key: 'ruleNature',
          type: RULE_NATURE,
        }),
        ...(slaEnabled
          ? [
              helper.display({
                title: 'SLA status',
                render: (entity) => {
                  return <SlaStatus slaPolicyDetails={entity.slaPolicyDetails} />;
                },
              }),
              ...getSlaColumnsForExport(helper, slaPolicies.items ?? []),
            ]
          : []),
        helper.simple<'alertStatus'>({
          title: 'Alert status',
          key: 'alertStatus',
          type: CASE_STATUS<TableAlertItem>({
            statusesToShow: CASE_STATUSS,
            reload,
          }),
        }),

        helper.simple<'statusChanges'>({
          title: 'Status changes',
          key: 'statusChanges',
          type: STATUS_CHANGE_PATH('ALERT'),
          hideInTable: true,
          exporting: true,
        }),
        ...(showClosingReason
          ? [
              helper.simple<'lastStatusChangeReasons'>({
                title: 'Closing reason',
                tooltip: 'Reason provided for closing an alert',
                key: 'lastStatusChangeReasons',
                type: {
                  render: (lastStatusChangeReasons) => {
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
              }),
            ]
          : []),
        ...(qaEnabled
          ? [
              helper.simple<'ruleQaStatus'>({
                title: 'QA status',
                key: 'ruleQaStatus',
                type: {
                  render: (status, { item: alert }) => {
                    const alertStatus = alert.alertStatus;
                    if (alertStatus === 'CLOSED') {
                      if (status === 'PASSED') {
                        return <>QA pass</>;
                      }
                      if (status === 'FAILED') {
                        return <>QA fail</>;
                      }
                      return <>Not QA'd</>;
                    }
                    return <>-</>;
                  },
                },
              }),
            ]
          : []),
        helper.simple<'caseCreatedTimestamp'>({
          title: 'Case created at',
          key: 'caseCreatedTimestamp',
          type: DATE,
          sorting: true,
        }),
        helper.simple<'updatedAt'>({
          title: 'Last updated',
          key: 'updatedAt',
          type: DATE,
          filtering: true,
          sorting: true,
        }),

        helper.derived({
          title: 'Assigned to',
          id: '_assigneeName',
          sorting: true,
          defaultWidth: 300,
          enableResizing: false,
          value: (item) =>
            statusEscalated(item.alertStatus) || statusInReview(item.alertStatus)
              ? item.reviewAssignments
              : item.assignments,
          type: {
            ...ASSIGNMENTS,
            stringify: (value) => {
              return `${value?.map((x) => users[x.assigneeUserId]?.email ?? '').join(',') ?? ''}`;
            },
            render: (assignments, { item: entity }) => {
              const otherStatuses = isOnHoldOrInProgressOrEscalated(entity?.alertStatus);
              return (
                <AssigneesDropdown
                  assignments={assignments || []}
                  editing={
                    !(
                      statusInReview(entity.alertStatus) ||
                      otherStatuses ||
                      entity.alertStatus === 'CLOSED' ||
                      qaMode
                    )
                  }
                  onChange={(assignees) => {
                    const assignments: Assignment[] = assignees.map((assignee) => ({
                      assigneeUserId: assignee,
                      assignedByUserId: userId,
                      timestamp: Date.now(),
                    }));

                    const alertId = entity?.alertId;

                    if (alertId == null) {
                      message.fatal('Alert ID is null');
                      return;
                    }

                    if (statusEscalated(entity.alertStatus)) {
                      handleAlertsReviewAssignments({
                        alertIds: [alertId],
                        reviewAssignments: assignments,
                      });
                    } else {
                      handleAlertsAssignments({
                        alertIds: [alertId],
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
            statusEscalated(item.alertStatus) || statusInReview(item.alertStatus)
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
        }),
        ...(qaMode
          ? [
              helper.simple<'assignments'>({
                title: 'QA assigned to',
                key: 'assignments',
                id: '_assignmentName',
                defaultWidth: 300,
                enableResizing: false,
                type: {
                  ...ASSIGNMENTS,
                  render: (__, { item: entity }) => {
                    const assignments = entity.qaAssignment || [];
                    return (
                      <AssigneesDropdown
                        assignments={assignments}
                        editing={!entity.ruleQaStatus}
                        onChange={(assignees) => {
                          if (entity.alertId) {
                            qaAssigneesUpdateMutation.mutate({
                              alertId: entity.alertId,
                              AlertQaAssignmentsUpdateRequest: {
                                assignments: assignees.map((assigneeUserId) => ({
                                  assignedByUserId: user.userId,
                                  assigneeUserId,
                                  timestamp: Date.now(),
                                })),
                              },
                            });
                          } else {
                            message.fatal('Alert ID is missing');
                            return;
                          }
                        }}
                      />
                    );
                  },
                },
              }),
            ]
          : []),

        helper.simple<'ruleQueueId'>({
          title: 'Queue',
          key: 'ruleQueueId',
          type: {
            render: (ruleQueueId) => {
              return <RuleQueueTag queueId={ruleQueueId} />;
            },
            stringify: (value) => {
              return ruleQueues.find((queue) => queue.id === value)?.name ?? 'default';
            },
          },
        }),
        ...(caseId
          ? [
              helper.simple<'creationReason'>({
                title: 'Creation reason',
                key: 'creationReason',
                type: {
                  render: (value) => {
                    return <>{value?.reasons.join(', ') ?? '-'}</>;
                  },
                },
                defaultWidth: 200,
              }),
            ]
          : []),
        ...((isInReview
          ? [
              helper.simple<'alertStatus'>({
                title: 'Proposed action',
                tooltip: 'Proposed action for the case',
                key: 'alertStatus',
                type: {
                  render: (alertStatus) => {
                    return alertStatus ? (
                      <>
                        {
                          <CaseStatusTag
                            caseStatus={getNextStatusFromInReview(alertStatus ?? 'OPEN')}
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
              helper.simple<'lastStatusChangeReasons'>({
                title: 'Proposed reason',
                tooltip: 'Reason proposed for closing the case',
                key: 'lastStatusChangeReasons',
                type: {
                  render: (lastStatusChangeReasons) => {
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
                      <ConsoleUserAvatar
                        userId={userId}
                        users={users}
                        loadingUsers={loadingUsers}
                      />
                    ) : (
                      <>-</>
                    );
                  },
                },
              }),
            ]
          : []) as TableColumn<TableAlertItem>[]),
        helper.display({
          title: 'Operations',
          enableResizing: false,
          defaultWidth: 330,
          render: (entity) => {
            if (!entity.alertId || !entity.caseId) {
              return <></>;
            }

            const isInReview = isInReviewCases({ [entity.alertId]: entity }, true);

            const canReview = canReviewCases({ [entity.alertId]: entity }, userId);
            const previousStatus = findLastStatusForInReview(entity.statusChanges ?? []);

            return (
              <div style={{ display: 'flex', gap: '8px' }}>
                {entity?.caseId && !statusInReview(entity.alertStatus) && (
                  <AlertsStatusChangeButton
                    caseId={entity.caseId}
                    ids={[entity.alertId]}
                    status={entity.alertStatus}
                    onSaved={reload}
                    statusTransitions={{
                      OPEN_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                      OPEN_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                      ESCALATED_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                      ESCALATED_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                    }}
                    transactionIds={selectedTxns}
                  />
                )}
                {entity?.caseId && isInReview && canReview && entity.alertStatus && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <ApproveSendBackButton
                      ids={[entity.alertId]}
                      onReload={reload}
                      type="ALERT"
                      previousStatus={previousStatus}
                      status={entity.alertStatus}
                      key={entity.alertId}
                      selectedCaseId={entity.caseId}
                    />
                  </div>
                )}
                {handleInvestigateAlert && (
                  <Link
                    to={makeUrl(
                      location.pathname,
                      undefined,
                      queryAdapter.serializer({
                        ...params,
                        forensicsFor: {
                          alertId: entity.alertId,
                          caseId: entity.caseId,
                        },
                        expandedAlertId: entity.alertId,
                      }),
                    )}
                  >
                    <Button
                      testName={'investigate-button'}
                      type="TETRIARY"
                      onClick={() => {
                        if (entity.alertId != null && entity.caseId != null) {
                          handleInvestigateAlert({
                            alertId: entity.alertId,
                            caseId: entity.caseId,
                          });
                        }
                      }}
                    >
                      <BrainIcon style={{ width: '16px', cursor: 'pointer' }} /> Forensics
                    </Button>
                  </Link>
                )}
              </div>
            );
          },
        }),
        helper.simple<'comments'>({
          title: 'Comments',
          key: 'comments',
          hideInTable: true,
          filtering: false,
          type: {
            stringify: (value) => commentsToString(value ?? [], users).trim(),
          },
        }),
      ]);
    };
    const col = mergedColumns(
      showUserFilters,
      handleAlertAssignments,
      handleAlertsReviewAssignments,
      icpEnabled
        ? (alertInfo) => {
            const updatedParams = {
              ...params,
              forensicsFor: {
                alertId: alertInfo.alertId,
                caseId: alertInfo.caseId,
              },
            };
            setInternalParams(updatedParams);
            navigate(
              makeUrl(location.pathname, undefined, {
                ...queryAdapter.serializer(updatedParams),
                expandedAlertId,
              }),
            );
          }
        : undefined,
      user.userId,
      reloadTable,
      isFalsePositiveEnabled,
      selectedTxns,
      qaEnabled,
    );
    return col;
  }, [
    location.pathname,
    users,
    showUserFilters,
    handleAlertAssignments,
    handleAlertsReviewAssignments,
    user.userId,
    reloadTable,
    isFalsePositiveEnabled,
    selectedTxns,
    icpEnabled,
    caseId,
    qaEnabled,
    ruleQueues,
    qaMode,
    qaAssigneesUpdateMutation,
    params,
    navigate,
    expandedAlertId,
    showClosingReason,
    slaEnabled,
    slaPolicies,
    isInReview,
    loadingUsers,
  ]);
  const [isAutoExpand, setIsAutoExpand] = useState(false);
  useEffect(() => {
    const data = getOr(queryResults.data, { items: [] });
    if (data.total === 1 && !isAutoExpand && !expandedAlertId) {
      setIsAutoExpand(true);
      const alertId = (data.items[0] as TableDataSimpleItem<TableAlertItem>).alertId;
      actionRef.current?.expandRow(alertId);
    }
  }, [queryResults.data, isAutoExpand, expandedAlertId]);
  const filterIds = denseArray([
    'caseId',
    'alertPriority',
    'caseTypesFilter',
    'rulesHitFilter',
    showUserFilters && 'userId',
    'tagKey',
    'businessIndustryFilter',
    'riskLevels',
    'ruleQueueIds',
    showAssignedToFilter && 'assignedTo',
    showAssignedToFilter && 'roleAssignedTo',
    'originMethodFilterId',
    'destinationMethodFilterId',
    'ruleNature',
    'alertStatus',
    'sla',
  ]);
  const filters = useCaseAlertFilters(filterIds);

  const getSelectionInfo = () => {
    const selectedTransactions = [
      ...new Set(
        Object.entries(selectedTxns)
          .filter(([_, txns]) => txns.length > 0)
          .flatMap(([, txns]) => txns),
      ),
    ];
    const selectedSanctionsHits = [
      ...new Set(
        Object.entries(selectedSanctionHits)
          .filter(([_, ids]) => ids.length > 0)
          .flatMap(([, ids]) => ids),
      ),
    ];
    if (selectedAlerts.length > 0) {
      return {
        entityName: 'alert',
        entityCount: selectedAlerts.length,
      };
    }
    if (selectedTransactions.length > 0) {
      return {
        entityName: 'transaction',
        entityCount: selectedTransactions.length,
      };
    }
    if (selectedSanctionsHits.length > 0) {
      return {
        entityName: 'hit',
        entityCount: selectedSanctionsHits.length,
      };
    }
    return {
      entityName: 'item',
      entityCount: 0,
    };
  };

  const resetSelection = useCallback(
    (
      params: {
        keepAlerts?: boolean;
        keepTxns?: boolean;
        keepSanctionHits?: boolean;
      } = {},
    ) => {
      const { keepAlerts = false, keepTxns = false, keepSanctionHits = false } = params;
      if (!keepAlerts) {
        setSelectedAlerts([]);
      }
      if (!keepTxns) {
        setSelectedTxns({});
      }
      if (!keepSanctionHits) {
        setSelectedSanctionHits({});
      }
    },
    [],
  );

  const page = params.page;
  const handleChangeParams = useCallback(
    (params: AlertTableParams) => {
      if (isEmbedded) {
        setInternalParams(params);
      } else if (onChangeParams) {
        onChangeParams(params);
      }
      if (page !== params.page) {
        resetSelection();
      }
    },
    [page, isEmbedded, onChangeParams, resetSelection],
  );

  const selectionActions: SelectionAction<TableAlertItem, AlertTableParams>[] = [
    ({ isDisabled }) => {
      if (selectedSanctionHitsIds.length === 0) {
        return;
      }

      const isAllOpen = selectedSanctionHitsStatuses.every((x) => x === 'OPEN');
      const isAllCleared = selectedSanctionHitsStatuses.every((x) => x === 'CLEARED');

      return (
        <>
          {isAllOpen && (
            <Button
              onClick={() => {
                setStatusChangeModalState('CLEARED');
                setStatusChangeModalVisible(true);
              }}
              isDisabled={isDisabled}
            >
              Clear
            </Button>
          )}
          {isAllCleared && (
            <Button
              onClick={() => {
                setStatusChangeModalState('OPEN');
                setStatusChangeModalVisible(true);
              }}
              isDisabled={isDisabled}
            >
              Restore
            </Button>
          )}
        </>
      );
    },
    ({ selectedIds, isDisabled }) => {
      if (!sarEnabled) {
        return;
      }

      if (!selectedTransactionIds.length || selectedAlerts.length) {
        return;
      }

      if (!caseId) {
        return;
      }

      return (
        <SarButton
          caseId={caseId}
          alertIds={selectedIds}
          transactionIds={selectedTransactionIds}
          isDisabled={isDisabled}
        />
      );
    },
    ({ selectedIds, selectedItems, isDisabled }) => {
      if (selectedAlerts.length === 0) {
        return;
      }

      const selectedAlertStatuses = new Set(
        Object.values(selectedItems).map((item) => item.alertStatus),
      );

      if ([...selectedAlertStatuses].find((status) => statusInProgressOrOnHold(status))) {
        return;
      }

      if (selectedAlertStatuses.has('ESCALATED') && selectedAlertStatuses.size === 1) {
        return (
          <AssignToButton
            onSelect={(account) =>
              handleAlertsReviewAssignments({
                alertIds: selectedIds,
                reviewAssignments: [
                  {
                    assigneeUserId: account.id,
                    assignedByUserId: user.userId,
                    timestamp: Date.now(),
                  },
                ],
              })
            }
            isDisabled={isDisabled}
          />
        );
      } else if (!selectedAlertStatuses.has('ESCALATED')) {
        return (
          <AssignToButton
            onSelect={(account) =>
              handleAlertAssignments({
                alertIds: selectedIds,
                assignments: [
                  {
                    assigneeUserId: account.id,
                    assignedByUserId: user.userId,
                    timestamp: Date.now(),
                  },
                ],
              })
            }
            isDisabled={isDisabled}
          />
        );
      }
    },
    ({ selectedIds, selectedItems, params, isDisabled }) => {
      const selectedAlertStatuses = [
        ...new Set(
          Object.values(selectedItems).map((item) =>
            item.alertStatus === 'REOPENED' ? 'OPEN' : item.alertStatus,
          ),
        ),
      ];
      const selectedAlertStatus =
        selectedAlertStatuses.length === 1 ? selectedAlertStatuses[0] : undefined;
      const selectedCaseIds = getSelectedCaseIdsForAlerts(selectedItems);
      const selectedCaseId = selectedCaseIds.length === 1 ? selectedCaseIds[0] : undefined;
      const caseId = params.caseId ?? selectedCaseId;
      const alertStatus = selectedAlertStatus;
      if (statusEscalated(alertStatus) && selectedTransactionIds.length) {
        return;
      }
      const status = selectedItems[selectedIds[0]]?.alertStatus;

      const isReviewAlerts = isInReviewCases(selectedItems, true);

      return (
        escalationEnabled &&
        caseId &&
        alertStatus &&
        !isReviewAlerts && (
          <AlertsStatusChangeButton
            ids={selectedIds}
            transactionIds={selectedTxns}
            onSaved={() => {
              reloadTable();
              setSelectedTxns({});
            }}
            status={status}
            caseId={caseId}
            statusTransitions={{
              OPEN: { status: 'ESCALATED', actionLabel: 'Escalate' },
              REOPENED: { status: 'ESCALATED', actionLabel: 'Escalate' },
              ESCALATED: { status: 'OPEN', actionLabel: 'Send back' },
              CLOSED: { status: 'ESCALATED', actionLabel: 'Escalate' },
              OPEN_IN_PROGRESS: { status: 'ESCALATED', actionLabel: 'Escalate' },
              OPEN_ON_HOLD: { status: 'ESCALATED', actionLabel: 'Escalate' },
              ESCALATED_IN_PROGRESS: { status: 'OPEN', actionLabel: 'Send back' },
              ESCALATED_ON_HOLD: { status: 'OPEN', actionLabel: 'Send back' },
            }}
            isDisabled={isDisabled}
          />
        )
      );
    },
    ({ selectedIds, selectedItems, isDisabled }) => {
      const isReviewAlerts =
        canReviewCases(selectedItems, user.userId) && isInReviewCases(selectedItems, true);
      const [previousStatus, isSingle] = getSingleCaseStatusPreviousForInReview(selectedItems);
      const [currentStatus, isSingleCurrent] = getSingleCaseStatusCurrent(selectedItems, true);
      const selectedCaseIds = getSelectedCaseIdsForAlerts(selectedItems);
      const selectedCaseId = selectedCaseIds.length === 1 ? selectedCaseIds[0] : undefined;

      if (isReviewAlerts && selectedCaseId) {
        return (
          <ApproveSendBackButton
            ids={selectedIds}
            onReload={reloadTable}
            type="ALERT"
            isDisabled={isDisabled}
            status={currentStatus}
            previousStatus={previousStatus}
            isDeclineHidden={!isSingle}
            isApproveHidden={!isSingleCurrent}
            selectedCaseId={selectedCaseId}
          />
        );
      }
    },
    ({ selectedIds, selectedItems, params, isDisabled }) => {
      const selectedStatuses = [
        ...new Set(
          Object.values(selectedItems).map((item) => {
            return item.alertStatus === 'CLOSED' ? 'CLOSED' : 'OPEN';
          }),
        ),
      ];
      const isReviewAlerts = isInReviewCases(selectedItems, true);

      if (isReviewAlerts) {
        return;
      }
      const statusChangeButtonValue =
        selectedStatuses.length === 1 ? selectedStatuses[0] : undefined;
      if (selectedTransactionIds.length) {
        return;
      }
      return statusChangeButtonValue ? (
        <AlertsStatusChangeButton
          ids={selectedIds}
          transactionIds={selectedTxns}
          onSaved={reloadTable}
          status={statusChangeButtonValue}
          caseId={params.caseId}
          isDisabled={isDisabled}
          statusTransitions={{
            OPEN_ON_HOLD: { status: 'CLOSED', actionLabel: 'Close' },
            OPEN_IN_PROGRESS: { status: 'CLOSED', actionLabel: 'Close' },
            ESCALATED_IN_PROGRESS: { status: 'CLOSED', actionLabel: 'Close' },
            ESCALATED_ON_HOLD: { status: 'CLOSED', actionLabel: 'Close' },
          }}
        />
      ) : null;
    },
    ({ selectedIds, params, onResetSelection }) => {
      if (selectedTransactionIds.length || selectedSanctionHitsIds.length) {
        return;
      }
      return (
        params.caseId && (
          <CreateCaseConfirmModal
            selectedEntities={selectedIds}
            caseId={params.caseId}
            onResetSelection={onResetSelection}
          />
        )
      );
    },
  ];

  const qaModeSelectionActions: SelectionAction<TableAlertItem, AlertTableParams>[] = [
    ({ selectedIds, params, onResetSelection, selectedItems }) => {
      if (selectedTransactionIds.length || !isAllAlertsOfStatus(selectedItems, 'CLOSED')) {
        return;
      }

      return (
        params.caseId && (
          <QaStatusChangeModal
            status={'PASSED'}
            alertIds={selectedIds}
            caseId={params.caseId}
            onResetSelection={onResetSelection}
            reload={reloadTable}
          />
        )
      );
    },
    ({ selectedIds, params, onResetSelection, selectedItems }) => {
      if (selectedTransactionIds.length || !isAllAlertsOfStatus(selectedItems, 'CLOSED')) {
        return;
      }
      return (
        params.caseId && (
          <QaStatusChangeModal
            status={'FAILED'}
            alertIds={selectedIds}
            caseId={params.caseId}
            onResetSelection={onResetSelection}
            reload={reloadTable}
          />
        )
      );
    },
  ];

  const exportPermissions = useHasPermissions(['case-management:export:read']);

  return (
    <>
      <QueryResultsTable<TableAlertItem, AlertTableParams>
        expandedRowId={expandedAlertId}
        tableId={isEmbedded ? 'alerts-list-embedded' : 'alerts-list'}
        rowKey={'alertId'}
        fitHeight={isEmbedded ? 500 : true}
        hideFilters={isEmbedded}
        innerRef={actionRef}
        columns={columns}
        queryResults={queryResults}
        params={internalParams ?? params}
        onChangeParams={handleChangeParams}
        selectedIds={[...selectedAlerts, ...Object.keys(selectedTxns), ...selectedSanctionHitsIds]}
        extraFilters={filters}
        pagination={isEmbedded ? 'HIDE_FOR_ONE_PAGE' : true}
        selectionInfo={getSelectionInfo()}
        selectionActions={qaMode ? qaModeSelectionActions : selectionActions}
        renderExpanded={
          expandTransactions
            ? (alert) => (
                <ExpandedRowRenderer
                  alert={alert ?? null}
                  escalatedTransactionIds={props.escalatedTransactionIds || []}
                  selectedTransactionIds={selectedTxns[alert.alertId ?? ''] ?? []}
                  selectedSanctionsHitsIds={selectedSanctionHitsIds}
                  onTransactionSelect={(alertId, transactionIds) => {
                    resetSelection({
                      keepTxns: true,
                      keepAlerts: selectedAlerts.includes(alertId),
                    });
                    setSelectedTxns((prevSelectedTxns) => ({
                      ...prevSelectedTxns,
                      [alertId]: [...transactionIds],
                    }));
                  }}
                  onSanctionsHitSelect={(alertId, sanctionsHitsIds, status) => {
                    resetSelection({ keepSanctionHits: true });
                    setSelectedSanctionHits((prevState) => ({
                      ...prevState,
                      [alertId]: sanctionsHitsIds.map((id) => ({ id, status })),
                    }));
                  }}
                  onSanctionsHitsChangeStatus={(sanctionsHitsIds, newStatus) => {
                    if (alert.alertId != null) {
                      setSelectedSanctionHits({
                        [alert.alertId]: sanctionsHitsIds.map((id) => ({
                          id,
                        })),
                      });
                      setStatusChangeModalVisible(true);
                      setStatusChangeModalState(newStatus);
                    }
                  }}
                />
              )
            : undefined
        }
        fixedExpandedContainer={true}
        partiallySelectedIds={Object.entries(selectedTxns)
          .filter(([id, txns]) => !selectedAlerts.includes(id) && txns.length > 0)
          .map(([id]) => id)}
        selection={(row) => {
          if (qaMode) {
            return !row.content?.ruleQaStatus;
          }
          return true;
        }}
        onSelect={(ids) => {
          resetSelection({ keepAlerts: true });
          setSelectedAlerts(ids);
        }}
        toolsOptions={{
          reload: true,
          download: exportPermissions,
          setting: true,
        }}
      />
      <InvestigativeCoPilotModal
        alertId={params.forensicsFor?.alertId}
        caseId={params.forensicsFor?.caseId}
        onClose={() => {
          const updatedParams = {
            ...params,
            forensicsFor: undefined,
          };
          setInternalParams(updatedParams);
          navigate(
            makeUrl(location.pathname, undefined, {
              ...queryAdapter.serializer(updatedParams),
              expandedAlertId,
            }),
          );
        }}
      />
      <SanctionsHitStatusChangeModal
        entityIds={selectedSanctionHitsIds}
        isVisible={isStatusChangeModalVisible}
        onClose={() => setStatusChangeModalVisible(false)}
        newStatus={statusChangeModalState ?? 'CLEARED'}
        updateMutation={adaptMutationVariables(changeStatusMutation, (formValues) => {
          const alertIds = Object.entries(selectedSanctionHits)
            .filter(([_, values]) => values != null && values.length > 0)
            .map(([key]) => key);
          if (alertIds.length !== 1) {
            throw new Error(`Its only possible to change status for a single alert`);
          }
          const [alertId] = alertIds;
          return {
            alertId: alertId,
            sanctionHitIds: selectedSanctionHitsIds,
            updates: {
              alertId: alertId,
              comment: formValues.comment,
              files: formValues.files,
              reasons: formValues.reasons,
              whitelistHits: formValues.whitelistHits,
              status: formValues.newStatus,
            },
          };
        })}
      />
    </>
  );
}
