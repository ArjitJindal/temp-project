import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AssigneesDropdown } from '../components/AssigneesDropdown';
import { ApproveSendBackButton } from '../components/ApproveSendBackButton';
import { FalsePositiveTag } from '../components/FalsePositiveTag';
import { useAlertQuery } from '../common';
import { useAlertQaAssignmentUpdateMutation } from '../QaTable';
import CreateCaseConfirmModal from './CreateCaseConfirmModal';
import { useApi } from '@/api';
import {
  AlertsAssignmentsUpdateRequest,
  AlertsReviewAssignmentsUpdateRequest,
  Assignment,
  ChecklistStatus,
} from '@/apis';
import QueryResultsTable from '@/components/common/QueryResultsTable';
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
import { getAlertUrl } from '@/utils/routing';
import ExpandedRowRenderer from '@/pages/case-management/AlertTable/ExpandedRowRenderer';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';
import AssignToButton from '@/pages/case-management/components/AssignToButton';
import { useAuth0User, useUsers, useHasPermissions } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { TableSearchParams } from '@/pages/case-management/types';
import { useCaseAlertFilters } from '@/pages/case-management/helpers';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  ASSIGNMENTS,
  CASE_STATUS,
  ALERT_USER_ID,
  CASEID,
  DATE,
  PRIORITY,
  RULE_ACTION,
  RULE_NATURE,
} from '@/components/library/Table/standardDataTypes';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { SarButton as SarButton } from '@/components/Sar';
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
  commentsToString,
} from '@/utils/case-utils';
import { CASE_STATUSS } from '@/apis/models-custom/CaseStatus';
import QaStatusChangeModal from '@/pages/case-management/AlertTable/QaStatusChangeModal';
import { useQaEnabled, useQaMode } from '@/utils/qa-mode';
import Button from '@/components/library/Button';
import InvestigativeCoPilotModal from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal';
import { getOr } from '@/utils/asyncResource';
import { RuleQueueTag } from '@/components/rules/RuleQueueTag';
import { denseArray } from '@/utils/lang';
import { useRuleQueues } from '@/components/rules/util';

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
  const [qaMode] = useQaMode();
  const qaEnabled = useQaEnabled();
  const api = useApi();
  const user = useAuth0User();
  const [users] = useUsers({ includeRootUsers: true, includeBlockedUsers: true });
  const [selectedTxns, setSelectedTxns] = useState<{ [alertId: string]: string[] }>({});
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [internalParams, setInternalParams] = useState<AlertTableParams | null>(null);
  const params = useMemo(() => internalParams ?? externalParams, [externalParams, internalParams]);
  const selectedTransactionIds = useMemo(() => {
    return Object.values(selectedTxns)
      .flatMap((v) => v)
      .filter(Boolean);
  }, [selectedTxns]);
  const [investigativeAlert, setInvestigativeAlert] = useState<{
    alertId: string;
    caseUserName: string;
  }>();

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

  const isFalsePositiveEnabled = useFeatureEnabled('FALSE_POSITIVE_CHECK');

  const queryResults: QueryResult<TableData<TableAlertItem>> = useAlertQuery(params);

  const actionRef = useRef<TableRefType>(null);

  const qaAssigneesUpdateMutation = useAlertQaAssignmentUpdateMutation(actionRef);

  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

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

  const columns = useMemo(() => {
    const mergedColumns = (
      showUserColumns: boolean,
      handleAlertsAssignments: (updateRequest: AlertsAssignmentsUpdateRequest) => void,
      handleAlertsReviewAssignments: (updateRequest: AlertsReviewAssignmentsUpdateRequest) => void,
      handleInvestigateAlert:
        | ((alertInfo: { alertId: string; caseUserName: string }) => void)
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
              if (caseId !== undefined) return <div>{alertId}</div>;
              return (
                <>
                  <Id
                    to={addBackUrlToRoute(getAlertUrl(entity.caseId!, alertId!))}
                    testName="alert-id"
                  >
                    {alertId}
                  </Id>
                  {falsePositiveDetails &&
                    falsePositiveDetails.isFalsePositive &&
                    falsePositiveEnabled && (
                      <FalsePositiveTag
                        caseIds={[entity.caseId!]}
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
          type: RULE_ACTION,
        }),
        helper.simple<'ruleNature'>({
          title: 'Rule nature',
          key: 'ruleNature',
          type: RULE_NATURE,
        }),
        helper.simple<'alertStatus'>({
          title: 'Alert status',
          key: 'alertStatus',
          type: CASE_STATUS<TableAlertItem>({
            statusesToShow: CASE_STATUSS,
            reload,
          }),
        }),
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
          title: 'Assignees',
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
              const otherStatuses = isOnHoldOrInProgress(entity.alertStatus!);
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

        ...(qaMode
          ? [
              helper.simple<'assignments'>({
                title: 'QA Assignees',
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
        helper.display({
          title: 'Operations',
          enableResizing: false,
          defaultWidth: 230,
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
                    ids={[entity.alertId!]}
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
                  <Button
                    testName={'investigate-button'}
                    type="TETRIARY"
                    onClick={() => {
                      if (entity.alertId != null) {
                        handleInvestigateAlert({
                          alertId: entity.alertId,
                          caseUserName: entity.caseUserName || '',
                        });
                      }
                    }}
                  >
                    <BrainIcon style={{ width: '16px', cursor: 'pointer' }} /> Forensics
                  </Button>
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
      icpEnabled ? setInvestigativeAlert : undefined,
      user.userId,
      reloadTable,
      isFalsePositiveEnabled,
      selectedTxns,
      qaEnabled,
    );
    return col;
  }, [
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
  ]);
  const [isAutoExpand, setIsAutoExpand] = useState(false);
  useEffect(() => {
    const data = getOr(queryResults.data, { items: [] });
    if (data.total === 1 && !isAutoExpand) {
      setIsAutoExpand(true);
      const alertId = (data.items[0] as TableDataSimpleItem<TableAlertItem>).alertId;
      actionRef.current?.expandRow(alertId);
    }
  }, [queryResults.data, isAutoExpand]);
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
    'originMethodFilterId',
    'destinationMethodFilterId',
    'ruleNature',
    'alertStatus',
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
    const entityName = selectedTransactions.length ? 'transaction' : 'alert';
    const count = entityName === 'alert' ? selectedAlerts.length : selectedTransactions.length;
    return count > 0
      ? {
          entityName: entityName,
          entityCount: count,
        }
      : undefined;
  };
  const handleChangeParams = useCallback(
    (params: AlertTableParams) => {
      if (isEmbedded) {
        setInternalParams(params);
      } else if (onChangeParams) {
        onChangeParams(params);
      }
    },
    [isEmbedded, onChangeParams],
  );

  const selectionActions: SelectionAction<TableAlertItem, AlertTableParams>[] = [
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
      if (selectedTransactionIds.length) {
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
      if (selectedTransactionIds.length) {
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
    ({ selectedIds, params, onResetSelection }) => {
      if (selectedTransactionIds.length) {
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
    ({ selectedIds, params, onResetSelection }) => {
      if (selectedTransactionIds.length) {
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
        selectedIds={[
          ...selectedAlerts,
          ...Object.entries(selectedTxns)
            .filter(([_, txns]) => txns.length > 0)
            .map(([key]) => key),
        ]}
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
                  onTransactionSelect={(alertId, transactionIds) => {
                    setSelectedTxns((prevSelectedTxns) => ({
                      ...prevSelectedTxns,
                      [alertId]: [...transactionIds],
                    }));
                    if (transactionIds.length > 0) {
                      setSelectedAlerts((prevState) => prevState.filter((x) => x !== alertId));
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
          setSelectedTxns((prevState) =>
            ids.reduce((acc, id) => ({ ...acc, [id]: [] }), prevState),
          );
          setSelectedAlerts(ids);
        }}
        toolsOptions={{
          reload: true,
          download: exportPermissions,
          setting: true,
        }}
      />
      <InvestigativeCoPilotModal
        alertId={investigativeAlert?.alertId}
        caseUserName={investigativeAlert?.caseUserName}
        onClose={() => {
          setInvestigativeAlert(undefined);
        }}
      />
    </>
  );
}
