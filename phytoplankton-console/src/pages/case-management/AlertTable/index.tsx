import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AssigneesDropdown } from '../components/AssigneesDropdown';
import { ApproveSendBackButton } from '../components/ApproveSendBackButton';
import { FalsePositiveTag } from '../components/FalsePositiveTag';
import { useAlertQuery } from '../common';
import CreateCaseConfirmModal from './CreateCaseConfirmModal';
import { useApi } from '@/api';
import {
  AlertsAssignmentsUpdateRequest,
  AlertsReviewAssignmentsUpdateRequest,
  Assignment,
  ChecklistStatus,
} from '@/apis';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, TableColumn, TableData, TableRefType } from '@/components/library/Table/types';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import { QueryResult } from '@/utils/queries/types';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import ExpandedRowRenderer from '@/pages/case-management/AlertTable/ExpandedRowRenderer';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';
import AssignToButton from '@/pages/case-management/components/AssignToButton';
import { useAuth0User } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { TableSearchParams } from '@/pages/case-management/types';
import { makeExtraFilters } from '@/pages/case-management/helpers';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  ASSIGNMENTS,
  CASE_STATUS,
  CASEID,
  DATE,
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
  statusInReview,
} from '@/utils/case-utils';
import { CASE_STATUSS } from '@/apis/models-custom/CaseStatus';
import { useRuleOptions } from '@/utils/rules';

export type AlertTableParams = AllParams<TableSearchParams> & {
  filterQaStatus?: ChecklistStatus;
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

const mergedColumns = (
  hideUserColumns: boolean,
  hideAlertStatusFilters: boolean,
  handleAlertsAssignments: (updateRequest: AlertsAssignmentsUpdateRequest) => void,
  handleAlertsReviewAssignments: (updateRequest: AlertsReviewAssignmentsUpdateRequest) => void,
  userId: string,
  reload: () => void,
  falsePositiveEnabled: boolean,
  selectedTxns: {
    [alertId: string]: string[];
  },
): TableColumn<TableAlertItem>[] => {
  const helper = new ColumnHelper<TableAlertItem>();
  return helper.list([
    helper.simple<'alertId'>({
      title: 'Alert ID',
      key: 'alertId',
      icon: <StackLineIcon />,
      showFilterByDefault: true,
      filtering: true,
      type: {
        render: (alertId, { item: entity }) => {
          const falsePositiveDetails = entity?.ruleHitMeta?.falsePositiveDetails;
          return (
            <>
              <Id
                to={addBackUrlToRoute(
                  makeUrl(`/case-management/case/:caseId/:tab`, {
                    caseId: entity.caseId,
                    tab: 'alerts',
                  }),
                )}
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
    helper.simple<'priority'>({
      title: 'Priority',
      key: 'priority',
      sorting: true,
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
    !hideUserColumns &&
      helper.simple<'caseUserName'>({
        title: 'User name',
        key: 'caseUserName',
      }),
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
      filtering: !hideAlertStatusFilters,
      type: CASE_STATUS<TableAlertItem>({
        statusesToShow: CASE_STATUSS,
        reload,
      }),
    }),
    helper.simple<'caseCreatedTimestamp'>({
      title: 'Case created at',
      key: 'caseCreatedTimestamp',
      type: DATE,
      sorting: true,
    }),
    helper.derived({
      title: 'Assigned to',
      id: '_assigneeName',
      sorting: true,
      defaultWidth: 300,
      enableResizing: false,
      value: (item) =>
        item.alertStatus === 'ESCALATED' || statusInReview(item.alertStatus)
          ? item.reviewAssignments
          : item.assignments,
      type: {
        ...ASSIGNMENTS,
        render: (assignments, { item: entity }) => {
          const otherStatuses = isOnHoldOrInProgress(entity.alertStatus!);
          return (
            <AssigneesDropdown
              assignments={assignments || []}
              editing={!(statusInReview(entity.alertStatus) || otherStatuses)}
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

                if (entity.alertStatus === 'ESCALATED') {
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
    helper.display({
      title: 'Operations',
      enableResizing: false,
      defaultWidth: 200,
      render: (entity) => {
        if (!entity.alertId || !entity.caseId) {
          return <></>;
        }

        const isInReview = isInReviewCases({ [entity.alertId]: entity }, true);

        const canReview = canReviewCases({ [entity.alertId]: entity }, userId);
        const previousStatus = findLastStatusForInReview(entity.statusChanges ?? []);

        return (
          <>
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
          </>
        );
      },
    }),
    helper.simple<'updatedAt'>({
      title: 'Last updated',
      key: 'updatedAt',
      type: DATE,
      filtering: true,
      sorting: true,
    }),
  ]);
};

interface Props {
  params: AlertTableParams;
  onChangeParams?: (newState: AlertTableParams) => void;
  isEmbedded?: boolean;
  hideAlertStatusFilters?: boolean;
  hideUserFilters?: boolean;
  caseId?: string;
  escalatedTransactionIds?: string[];
  expandTransactions?: boolean;
  hideAssignedToFilter?: boolean;
}

export default function AlertTable(props: Props) {
  const {
    caseId,
    params: externalParams,
    onChangeParams,
    isEmbedded = false,
    hideAlertStatusFilters = false,
    hideUserFilters = false,
    expandTransactions = true,
    hideAssignedToFilter,
  } = props;
  const escalationEnabled = useFeatureEnabled('ESCALATION');
  const isPulseEnabled = useFeatureEnabled('PULSE');
  const sarEnabled = useFeatureEnabled('SAR');
  const api = useApi();
  const user = useAuth0User();

  const [selectedTxns, setSelectedTxns] = useState<{ [alertId: string]: string[] }>({});
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const [internalParams, setInternalParams] = useState<AlertTableParams | null>(null);
  const params = useMemo(() => internalParams ?? externalParams, [externalParams, internalParams]);
  const selectedTransactionIds = useMemo(() => {
    return Object.values(selectedTxns)
      .flatMap((v) => v)
      .filter(Boolean);
  }, [selectedTxns]);

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
  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  useEffect(() => {
    reloadTable();
  }, [params.alertStatus, reloadTable]);

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

  const columns = useMemo(
    () =>
      mergedColumns(
        hideUserFilters,
        hideAlertStatusFilters,
        handleAlertAssignments,
        handleAlertsReviewAssignments,
        user.userId,
        reloadTable,
        isFalsePositiveEnabled,
        selectedTxns,
      ),
    [
      hideUserFilters,
      hideAlertStatusFilters,
      handleAlertAssignments,
      handleAlertsReviewAssignments,
      user.userId,
      reloadTable,
      isFalsePositiveEnabled,
      selectedTxns,
    ],
  );

  const ruleOptions = useRuleOptions();
  const extraFilters = useMemo(
    () =>
      makeExtraFilters(
        isPulseEnabled,
        ruleOptions,
        hideUserFilters,
        'ALERTS',
        hideAssignedToFilter,
      ),
    [isPulseEnabled, ruleOptions, hideUserFilters, hideAssignedToFilter],
  );

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
  return (
    <>
      <QueryResultsTable<TableAlertItem, AlertTableParams>
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
        extraFilters={extraFilters}
        pagination={isEmbedded ? 'HIDE_FOR_ONE_PAGE' : true}
        selectionInfo={getSelectionInfo()}
        selectionActions={[
          ({ isDisabled }) => {
            if (!sarEnabled) {
              return;
            }

            if (!selectedTransactionIds.length) {
              return;
            }

            if (!caseId) {
              return;
            }

            return (
              <SarButton
                caseId={caseId}
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
            const alertStatus = params.alertStatus ?? selectedAlertStatus;
            if (alertStatus === 'ESCALATED' && selectedTransactionIds.length) {
              return;
            }

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
                  status={alertStatus}
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
            const [previousStatus, isSingle] =
              getSingleCaseStatusPreviousForInReview(selectedItems);
            const [currentStatus, isSingleCurrent] = getSingleCaseStatusCurrent(
              selectedItems,
              true,
            );
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
            const status = params.alertStatus ?? statusChangeButtonValue;
            return statusChangeButtonValue ? (
              <AlertsStatusChangeButton
                ids={selectedIds}
                transactionIds={selectedTxns}
                onSaved={reloadTable}
                status={status}
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
        ]}
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
        onSelect={(ids) => {
          setSelectedTxns((prevState) =>
            ids.reduce((acc, id) => ({ ...acc, [id]: [] }), prevState),
          );
          setSelectedAlerts(ids);
        }}
      />
    </>
  );
}
