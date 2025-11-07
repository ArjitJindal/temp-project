import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { Link, useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router';
import pluralize from 'pluralize';
import { AssigneesDropdown } from '../../../components/AssigneesDropdown';
import { ApproveSendBackButton } from '../components/ApproveSendBackButton';
import { useAlertQaAssignmentUpdateMutation } from '../QA/Table';
import { ConsoleUserAvatar } from '../components/ConsoleUserAvatar';
import SlaStatus from '../components/SlaStatus';
import { getSlaColumnsForExport } from '../helpers';
import { ActionLabel } from '../components/StatusChangeModal';
import ExpandedRowRenderer from './ExpandedRowRenderer';
import s from './index.module.less';
import CreateCaseConfirmModal from './CreateCaseConfirmModal';
import { FalsePositiveTag } from './FalsePositiveTag';
import SanctionsHitStatusChangeModal from '@/pages/case-management/AlertTable/SanctionsHitStatusChangeModal';
import CalendarLineIcon from '@/components/ui/icons/Remix/business/calendar-line.react.svg';
import {
  AlertsAssignmentsUpdateRequest,
  AlertsReviewAssignmentsUpdateRequest,
  AlertStatus,
  ChecklistStatus,
  Comment,
  SanctionsHitStatus,
  CaseStatusChange,
  Account,
  Alert,
} from '@/apis';
import { useApi } from '@/api';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import {
  AllParams,
  isSingleRow,
  SelectionAction,
  TableColumn,
  TableDataSimpleItem,
  TableRefType,
} from '@/components/library/Table/types';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { getAlertUrl, makeUrl } from '@/utils/routing';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';
import AssignToButton from '@/pages/case-management/components/AssignToButton';
import { useAuth0User, useHasResources } from '@/utils/user-utils';
import { useUsers, useAccounts } from '@/utils/api/auth';
import { message } from '@/components/library/Message';
import { TableSearchParams } from '@/pages/case-management/types';
import { queryAdapter, useCaseAlertFilters } from '@/pages/case-management/helpers';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
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
  canAssignToUser,
  canMutateEscalatedCases,
  canReviewCases,
  commentsToString,
  createAssignments,
  findLastStatusForInReview,
  getAssignmentsToShow,
  getNextStatusFromInReview,
  getSingleCaseStatusCurrent,
  getSingleCaseStatusPreviousForInReview,
  isEscalatedCases,
  isEscalatedL2Cases,
  isInReviewCases,
  statusEscalated,
  statusEscalatedL2,
  statusInReview,
} from '@/utils/case-utils';
import { CASE_STATUSS } from '@/apis/models-custom/CaseStatus';
import QaStatusChangeModal from '@/pages/case-management/AlertTable/QaStatusChangeModal';
import { useQaEnabled, useQaMode } from '@/utils/qa-mode';
import Button from '@/components/library/Button';
import InvestigativeCoPilotModal from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal';
import { getOr, map } from '@/utils/asyncResource';
import RuleQueueTag from '@/components/library/Tag/RuleQueueTag';
import { denseArray, neverReturn } from '@/utils/lang';
import { useRuleQueues } from '@/components/rules/util';
import { notEmpty } from '@/utils/array';
import { adaptMutationVariables } from '@/utils/queries/mutations/helpers';
import { SLA_POLICY_LIST } from '@/utils/queries/keys';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useQuery } from '@/utils/queries/hooks';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';
import { useDeepEqualEffect } from '@/utils/hooks';
import {
  updateSanctionsData,
  useChangeSanctionsHitsStatusMutation,
} from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/helpers';
import StatusChangeReasonsDisplay from '@/components/ui/StatusChangeReasonsDisplay';
import dayjs from '@/utils/dayjs';
import { usePaginatedAlertList } from '@/utils/api/alerts';
import { getPaymentDetailsIdString } from '@/utils/payments';
import { getAddressString } from '@/utils/address';

export type AlertTableParams = AllParams<TableSearchParams> & {
  filterQaStatus?: ChecklistStatus | "NOT_QA'd" | undefined;
};

const getEntityNameString = (entity: TableAlertItem): string => {
  if (entity.email?.origin) {
    return entity.email.origin;
  }
  if (entity.email?.destination) {
    return entity.email.destination;
  }
  if (entity.paymentDetails?.origin) {
    return getPaymentDetailsIdString(entity.paymentDetails.origin);
  }
  if (entity.paymentDetails?.destination) {
    return getPaymentDetailsIdString(entity.paymentDetails.destination);
  }
  if (entity.address?.origin) {
    return getAddressString(entity.address.origin);
  }
  if (entity.address?.destination) {
    return getAddressString(entity.address.destination);
  }
  if (entity.name?.origin) {
    return entity.name.origin;
  }
  if (entity.name?.destination) {
    return entity.name.destination;
  }
  if (entity.caseUserId) {
    return entity.caseUserId ?? '-';
  }
  return '-';
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

const isAllAlertStartingWithStatus = (
  selectedItems: Record<string, TableAlertItem>,
  status: string,
): boolean => {
  return Object.values(selectedItems).every((item) => item.alertStatus?.startsWith(status));
};

const isAllAlertsOfStatus = (
  selectedItems: Record<string, TableAlertItem>,
  status: string,
): boolean => {
  return Object.values(selectedItems).every((item) => item.alertStatus === status);
};

interface Props<ModalProps> {
  params: AlertTableParams;
  onChangeParams?: (newState: AlertTableParams) => void;
  isEmbedded?: boolean;
  showUserFilters?: boolean;
  caseId?: string;
  escalatedTransactionIds?: string[];
  expandTransactions?: boolean;
  showAssignedToFilter?: boolean;
  expandedAlertId?: string;
  updateModalState: (newState: ModalProps) => void;
  setModalVisibility: (visibility: boolean) => void;
}

function getCheckerAction(
  statusChanges: CaseStatusChange[],
  accountMap: {
    [accountId: string]: Account;
  },
) {
  if (statusChanges && statusChanges.length >= 2) {
    statusChanges.sort((a, b) => {
      if (a.timestamp > b.timestamp) {
        return -1;
      }
      return 1;
    });

    let checkerChange: CaseStatusChange | undefined = undefined,
      makerChange: CaseStatusChange | undefined = undefined;
    for (let i = 0; i < statusChanges.length; i++) {
      const change = statusChanges[i];
      const account = accountMap[change.userId];
      if (account) {
        if (account.isReviewer) {
          checkerChange = change;
          makerChange = undefined;
        }
        if (
          account.reviewerId &&
          (change.caseStatus === 'IN_REVIEW_CLOSED' || change.caseStatus === 'IN_REVIEW_ESCALATED')
        ) {
          makerChange = change;
          if (checkerChange) {
            break;
          }
        }
      }
    }
    if (checkerChange && makerChange) {
      if (makerChange.caseStatus === 'IN_REVIEW_ESCALATED') {
        if (checkerChange.caseStatus === 'ESCALATED') {
          return 'Escalation approved';
        } else {
          return 'Escalation rejected';
        }
      } else {
        if (checkerChange.caseStatus === 'CLOSED') {
          return 'Closure approved';
        } else {
          return 'Closure rejected';
        }
      }
    }
  }
  return '-';
}

const getCommentForStatusChange = (body: string) => {
  const match = body.match(/Alert status changed to \s*(.*) Reasons: \s*(.*) Comment: \s*(.*)/s);
  return match && match.length === 4 ? match[3].trim() : undefined;
};

const isQAChange = (body: string) => {
  return /^Alert QA status set to .*/.test(body);
};

const santiziedMakerComment = (comment?: Comment) => {
  if (!comment) {
    return comment;
  }

  // sure that this is a status change comment need to find maker comment by filtering
  if (comment.type === 'STATUS_CHANGE') {
    return getCommentForStatusChange(comment.body);
  } else {
    // not sure that this is status change comment or a comment on alert
    // https://github.com/flagright/orca/pull/3118 implemented type in comment, comment before this has no distinguishing

    if (!isQAChange(comment.body)) {
      const santiziedComment = getCommentForStatusChange(comment.body);
      if (!santiziedComment) {
        return comment.body;
      }
      return santiziedComment;
    }
  }

  return undefined;
};

export function getLatestMakerComment(
  comments: Comment[],
  accounts: { [accountId: string]: Account },
): Comment | undefined {
  let latestMakerComment: Comment | undefined = undefined,
    commentTime = 0;

  comments.forEach((comment) => {
    // filtering a valid comment made by maker, which is not deleted
    if (comment.id && comment.userId) {
      const account = accounts[comment.userId];
      if (account && account.reviewerId && comment.createdAt && !comment.deletedAt) {
        const santiziedCommentBody = santiziedMakerComment(comment);
        if (santiziedCommentBody && commentTime < comment.createdAt) {
          commentTime = comment.createdAt;
          latestMakerComment = { ...comment, body: santiziedCommentBody };
        }
      }
    }
  });

  return latestMakerComment;
}

export default function AlertTable<ModalProps>(props: Props<ModalProps>) {
  const {
    caseId,
    params: externalParams,
    onChangeParams,
    isEmbedded = false,
    showUserFilters = false,
    expandTransactions = true,
    showAssignedToFilter,
    expandedAlertId,
    updateModalState,
    setModalVisibility,
  } = props;
  const settings = useSettings();
  const { data: accounts } = useAccounts();
  const capitalizeUserAlias = firstLetterUpper(settings.userAlias);
  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
  const customAggregationFieldsEnabled = useFeatureEnabled('CUSTOM_AGGREGATION_FIELDS');
  const isPNBDay2Enabled = useFeatureEnabled('PNB_DAY_2');
  const sarEnabled = useFeatureEnabled('SAR');
  const slaEnabled = useFeatureEnabled('ALERT_SLA');
  const clickhouseEnabled = useFeatureEnabled('CLICKHOUSE_ENABLED');
  const [qaMode] = useQaMode();
  const qaEnabled = useQaEnabled();
  const api = useApi();
  const user = useAuth0User();
  const { users, isLoading: loadingUsers } = useUsers({
    includeRootUsers: true,
    includeBlockedUsers: true,
  });
  const userAccount = users[user.userId];
  const isMultiEscalationEnabled = useFeatureEnabled('MULTI_LEVEL_ESCALATION');

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
  const location = useLocation();

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
  const { changeHitsStatusMutation } = useChangeSanctionsHitsStatusMutation();

  const queryResults = usePaginatedAlertList(params);

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
    async (updateRequest: AlertsAssignmentsUpdateRequest) => {
      const { alertIds, assignments } = updateRequest;

      await assignmentsToMutationAlerts.mutateAsync({
        alertIds,
        assignments,
      });
    },
    [assignmentsToMutationAlerts],
  );

  const handleAlertsReviewAssignments = useCallback(
    async (updateRequest: AlertsReviewAssignmentsUpdateRequest) => {
      const { alertIds, reviewAssignments } = updateRequest;

      await reviewAssignmentsToMutationAlerts.mutateAsync({
        alertIds,
        reviewAssignments,
      });
    },
    [reviewAssignmentsToMutationAlerts],
  );

  const icpFeatureEnabled = useFeatureEnabled('AI_FORENSICS');
  const icpEnabled = icpFeatureEnabled || user.role === 'root'; // TODO remove this after testing

  const ruleQueues = useRuleQueues();

  const showReason =
    params.alertStatus == null ||
    params.alertStatus.length === 0 ||
    params.alertStatus.some((x) => {
      return x !== 'OPEN';
    });

  const isInReview =
    params.caseStatus?.includes('IN_REVIEW') || params.alertStatus?.includes('IN_REVIEW') || false;

  useDeepEqualEffect(() => {
    reloadTable();
  }, [params.caseStatus, reloadTable]);

  const columns = useMemo(() => {
    const mergedColumns = (
      showUserColumns: boolean,
      handleAlertsAssignments: (updateRequest: AlertsAssignmentsUpdateRequest) => Promise<void>,
      handleAlertsReviewAssignments: (
        updateRequest: AlertsReviewAssignmentsUpdateRequest,
      ) => Promise<void>,
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

      return helper.list(
        [
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
                // Always show alert details page
                return (
                  <div className={s.alert}>
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
                          alertId={entity.alertId}
                          caseIds={[entity.caseId].filter(notEmpty)}
                          confidence={falsePositiveDetails.confidenceScore}
                          newCaseStatus={'CLOSED'}
                          onSaved={reload}
                          rounded
                          user={entity.user}
                          ruleNature={entity.ruleNature}
                        />
                      )}
                  </div>
                );
              },
              stringify(value, item) {
                return item.alertId ?? '';
              },
              link: (value, item) => {
                return item?.caseId && value ? getAlertUrl(item.caseId, value) : undefined;
              },
            },
            sorting: true,
          }),
          helper.simple<'caseId'>({
            title: 'Case ID',
            key: 'caseId',
            type: CASEID,
            sorting: true,
          }),
          ...(customAggregationFieldsEnabled
            ? [
                helper.derived({
                  title: 'Entity name',
                  type: {
                    render: (_, { item: entity }) => {
                      return <>{getEntityNameString(entity)}</>;
                    },
                  },
                  value: (item) => getEntityNameString(item),
                }),
              ]
            : []),
          helper.simple<'createdTimestamp'>({
            title: 'Created at',
            key: 'createdTimestamp',
            showFilterByDefault: true,
            sorting: true,
            filtering: true,
            icon: <CalendarLineIcon />,
            type: DATE,
          }),
          helper.simple<'age'>({
            title: 'Alert age',
            key: 'age',
            sorting: true,
            type: {
              render: (value) => {
                if (value == null) {
                  return <>-</>;
                }
                const duration = dayjs.duration(value);
                const days = Math.floor(duration.asDays());
                return <>{pluralize('day', days, true)}</>;
              },
              stringify: (value) => {
                if (value == null) {
                  return '-';
                }
                const duration = dayjs.duration(value);
                const days = Math.floor(duration.asDays());
                return pluralize('day', days, true);
              },
            },
          }),
          helper.simple<'numberOfTransactionsHit'>({
            title: '#TX',
            key: 'numberOfTransactionsHit',
            sorting: true,
          }),
          ...(showUserColumns
            ? [
                helper.simple<'caseUserId'>({
                  title: `${capitalizeUserAlias} ID`,
                  key: 'caseUserId',
                  type: ALERT_USER_ID,
                }),

                helper.simple<'caseUserName'>({
                  title: `${capitalizeUserAlias} name`,
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
                    return (
                      <SlaStatus
                        slaPolicyDetails={entity.slaPolicyDetails}
                        entity={entity as Alert}
                        accounts={getOr(accounts, [])}
                      />
                    );
                  },
                }),
                ...getSlaColumnsForExport(helper, slaPolicies.items ?? [], getOr(accounts, [])),
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
                return (
                  <AssigneesDropdown
                    assignments={getAssignmentsToShow(entity) ?? []}
                    editing={!(entity.alertStatus === 'CLOSED' || qaMode)}
                    customFilter={(account) =>
                      canAssignToUser(
                        entity.alertStatus ?? 'OPEN',
                        account,
                        isMultiEscalationEnabled,
                      )
                    }
                    onChange={async (assignees) => {
                      const [assignments, isReview] = createAssignments(
                        entity.alertStatus ?? 'OPEN',
                        assignees,
                        isMultiEscalationEnabled,
                        user.userId,
                      );

                      if (entity.alertId == null) {
                        message.fatal('Alert ID is null');
                        return;
                      }

                      if (isReview) {
                        await handleAlertsReviewAssignments({
                          alertIds: [entity.alertId],
                          reviewAssignments: assignments,
                        });
                      } else {
                        await handleAlertsAssignments({
                          alertIds: [entity.alertId],
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
                          onChange={async (assignees) => {
                            if (entity.alertId) {
                              await qaAssigneesUpdateMutation.mutateAsync({
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
                helper.simple<'proposedAction'>({
                  title: 'Proposed action',
                  tooltip: 'Proposed action for the case',
                  key: 'proposedAction',
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
                helper.simple<'lastStatusChange.userId'>({
                  id: 'proposed-by',
                  title: 'Proposed by',
                  key: 'lastStatusChange.userId',
                  defaultWidth: 300,
                  enableResizing: false,
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
          helper.simple<'comments'>({
            title: 'Maker comment',
            key: 'comments',
            hideInTable: true,
            exporting: true,
            filtering: false,
            type: {
              stringify: (value) => {
                const latestMakerComment = getLatestMakerComment(value ?? [], users);
                return latestMakerComment && latestMakerComment.body
                  ? latestMakerComment.body
                  : '-';
              },
            },
          }),
          helper.simple<'transactionIds'>({
            title: 'Transaction IDs',
            key: 'transactionIds',
            hideInTable: true,
            filtering: false,
            exporting: true,
            type: {
              stringify: (value) => {
                if (!value || !Array.isArray(value) || value.length === 0) {
                  return '';
                }
                return value.join(', ');
              },
            },
          }),
          helper.simple<'comments'>({
            title: 'Comments',
            key: 'comments',
            hideInTable: true,
            filtering: false,
            exporting: true,
            type: {
              stringify: (value) => commentsToString(value ?? [], users).trim(),
            },
          }),
          ...(isPNBDay2Enabled
            ? [
                helper.simple<'statusChanges'>({
                  title: 'Checker action',
                  key: 'statusChanges',
                  hideInTable: true,
                  filtering: false,
                  exporting: true,
                  type: {
                    stringify: (value) => {
                      const checkerAction = getCheckerAction(value ?? [], users);
                      return checkerAction ?? '-';
                    },
                  },
                }),
              ]
            : []),
          showReason &&
            helper.derived<TableAlertItem['lastStatusChangeReasons'] | null>({
              title: 'Reason',
              id: 'reason',
              filtering: false,
              value: (value) => {
                const { lastStatusChangeReasons, alertStatus } = value;
                if (
                  alertStatus == null ||
                  alertStatus === 'OPEN' ||
                  alertStatus === 'OPEN_IN_PROGRESS' ||
                  alertStatus === 'OPEN_ON_HOLD' ||
                  alertStatus === 'REOPENED'
                ) {
                  return null;
                }
                if (
                  alertStatus === 'CLOSED' ||
                  statusEscalated(alertStatus) ||
                  statusEscalatedL2(alertStatus) ||
                  statusInReview(alertStatus)
                ) {
                  return lastStatusChangeReasons;
                }
                return neverReturn(alertStatus, lastStatusChangeReasons);
              },
              type: {
                render: (lastStatusChangeReasons) => {
                  if (lastStatusChangeReasons == null) {
                    return <></>;
                  }
                  if (
                    !lastStatusChangeReasons ||
                    (lastStatusChangeReasons.reasons.length == 0 &&
                      !lastStatusChangeReasons.otherReason)
                  ) {
                    return <></>;
                  }
                  return (
                    <StatusChangeReasonsDisplay
                      reasons={lastStatusChangeReasons.reasons}
                      otherReason={lastStatusChangeReasons.otherReason}
                    />
                  );
                },
                stringify: (lastStatusChangeReasons) => {
                  if (lastStatusChangeReasons == null) {
                    return '';
                  }
                  return [
                    ...(lastStatusChangeReasons?.reasons ?? []),
                    lastStatusChangeReasons?.otherReason,
                  ]
                    .filter(notEmpty)
                    .join('; ');
                },
              },
            }),
          helper.simple<'lastStatusChange.userId'>({
            title: 'Status changed by',
            key: 'lastStatusChange.userId',
            defaultWidth: 300,
            enableResizing: false,
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
              const isEscalated = statusEscalated(entity.alertStatus);
              const isEscalatedL2 = statusEscalatedL2(entity.alertStatus);
              const caseUser = entity.user;
              const canMutateCases = canMutateEscalatedCases(
                { [entity.caseId]: entity },
                userId,
                isMultiEscalationEnabled,
              );
              return (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {entity?.caseId && !statusInReview(entity.alertStatus) && !isEscalated && (
                    <AlertsStatusChangeButton
                      caseId={entity.caseId}
                      ids={[entity.alertId]}
                      status={entity.alertStatus}
                      onSaved={reload}
                      statusTransitions={{
                        OPEN_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                        OPEN_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                      }}
                      transactionIds={selectedTxns}
                      updateModalState={(modalState) => {
                        updateModalState(modalState as ModalProps);
                      }}
                      setModalVisibility={setModalVisibility}
                      haveModal={false}
                      user={caseUser}
                      alertsData={[{ alertId: entity.alertId, ruleNature: entity.ruleNature }]}
                    />
                  )}
                  {entity?.caseId &&
                    !statusInReview(entity.alertStatus) &&
                    isEscalated &&
                    !isEscalatedL2 &&
                    canMutateCases && (
                      <AlertsStatusChangeButton
                        caseId={entity.caseId}
                        ids={[entity.alertId]}
                        status={entity.alertStatus}
                        onSaved={reload}
                        statusTransitions={{
                          ESCALATED_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                          ESCALATED_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                        }}
                        transactionIds={selectedTxns}
                        updateModalState={(modalState) => {
                          updateModalState(modalState as ModalProps);
                        }}
                        setModalVisibility={setModalVisibility}
                        haveModal={false}
                        user={caseUser}
                        alertsData={[{ alertId: entity.alertId, ruleNature: entity.ruleNature }]}
                      />
                    )}
                  {entity?.caseId &&
                    !statusInReview(entity.alertStatus) &&
                    isEscalatedL2 &&
                    canMutateCases &&
                    userAccount?.escalationLevel === 'L2' && (
                      <AlertsStatusChangeButton
                        caseId={entity.caseId}
                        ids={[entity.alertId]}
                        status={entity.alertStatus}
                        onSaved={reload}
                        statusTransitions={{
                          ESCALATED_L2: { actionLabel: 'Close', status: 'CLOSED' },
                        }}
                        transactionIds={selectedTxns}
                        updateModalState={(modalState) => {
                          updateModalState(modalState as ModalProps);
                        }}
                        setModalVisibility={setModalVisibility}
                        haveModal={false}
                        user={caseUser}
                        alertsData={[{ alertId: entity.alertId, ruleNature: entity.ruleNature }]}
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
                  {handleInvestigateAlert && icpFeatureEnabled && clickhouseEnabled && (
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
                        <AiForensicsLogo /> Forensics
                      </Button>
                    </Link>
                  )}
                </div>
              );
            },
          }),
        ].filter(notEmpty),
      );
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
    showUserFilters,
    handleAlertAssignments,
    handleAlertsReviewAssignments,
    icpEnabled,
    icpFeatureEnabled,
    user.userId,
    reloadTable,
    isFalsePositiveEnabled,
    selectedTxns,
    qaEnabled,
    slaEnabled,
    clickhouseEnabled,
    slaPolicies.items,
    qaMode,
    caseId,
    isInReview,
    showReason,
    users,
    qaAssigneesUpdateMutation,
    ruleQueues,
    loadingUsers,
    isMultiEscalationEnabled,
    updateModalState,
    setModalVisibility,
    userAccount?.escalationLevel,
    location.pathname,
    params,
    navigate,
    expandedAlertId,
    capitalizeUserAlias,
    isPNBDay2Enabled,
    accounts,
    customAggregationFieldsEnabled,
  ]);
  const [isAutoExpand, setIsAutoExpand] = useState(false);
  useEffect(() => {
    const data = getOr(queryResults.data, { items: [] });
    if (data.total === 1 && !isAutoExpand && !expandedAlertId && data.items[0]) {
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
    showUserFilters && 'userName',
    showUserFilters && 'parentUserId',
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
    'filterClosingReason',
    'alertSla',
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
              Re-open
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

      const selectedTransactionAlertIds = Object.entries(selectedTxns)
        .filter(([_, ids]) => ids.some((x) => selectedTransactionIds.includes(x)))
        .map(([alertIds]) => alertIds);

      const selectedAlertsCaseIds = getOr(
        map(queryResults.data, (alerts) => {
          return alerts.items
            .filter(isSingleRow)
            .filter((tableItem) => {
              return (
                tableItem.alertId != null && selectedTransactionAlertIds.includes(tableItem.alertId)
              );
            })
            .map(({ caseId }) => caseId);
        }),
        [],
      );

      if (selectedAlertsCaseIds.length !== 1) {
        return;
      }
      const [caseId] = selectedAlertsCaseIds;
      if (!caseId) {
        return;
      }

      return (
        <SarButton
          caseId={caseId}
          alertIds={selectedIds}
          transactionIds={selectedTransactionIds}
          isDisabled={isDisabled}
          source="alert"
        />
      );
    },
    ({ selectedIds, selectedItems, isDisabled }) => {
      if (selectedAlerts.length === 0) {
        return;
      }

      const selectedAlertStatuses = new Set(
        Object.values(selectedItems).map((item) => {
          const status = item.alertStatus;
          // Strip _IN_PROGRESS and _ON_HOLD suffixes to treat them as the base status
          return status?.replace(/_(IN_PROGRESS|ON_HOLD)$/, '') as AlertStatus;
        }),
      );

      // ensure alerts are all in the same status else disable the button
      const multipleStatuses = selectedAlertStatuses.size > 1;

      const selectedAlertStatus = Array.from(selectedAlertStatuses)[0];
      const someEscalated = [...selectedAlertStatuses].some(
        (status) => statusEscalated(status) || statusEscalatedL2(status),
      );

      // this is for multi-level escalation (PNB)
      // if any of the selected alerts have a different escalation level, then we don't allow the assignment
      if (isMultiEscalationEnabled && someEscalated) {
        // all alerts are all escalated and of the same level
        // get the escalation level from selectedAlertStatus
        const isL2Escalated = statusEscalatedL2(selectedAlertStatus);
        const escalationLevel = isL2Escalated ? 'L2' : 'L1';

        return (
          <AssignToButton
            userFilter={(account) => account?.escalationLevel === escalationLevel}
            onSelect={(account) =>
              handleAlertsReviewAssignments({
                alertIds: selectedIds,
                reviewAssignments: [
                  {
                    assigneeUserId: account.id,
                    assignedByUserId: user.userId,
                    timestamp: Date.now(),
                    escalationLevel: escalationLevel,
                  },
                ],
              })
            }
            isDisabled={isDisabled || multipleStatuses}
            tooltip={multipleStatuses ? 'Please select alerts of the same status' : ''}
          />
        );
      }

      // ensure alerts are all in the same status
      return (
        <AssignToButton
          onSelect={(account) => {
            const [assignments, isReview] = createAssignments(
              selectedAlertStatus,
              [account.id],
              isMultiEscalationEnabled,
              user.userId,
            );

            if (isReview) {
              handleAlertsReviewAssignments({
                alertIds: selectedIds,
                reviewAssignments: assignments,
              });
            } else {
              handleAlertAssignments({
                alertIds: selectedIds,
                assignments,
              });
            }
          }}
          isDisabled={isDisabled || multipleStatuses}
          tooltip={multipleStatuses ? 'Please select alerts of the same status' : ''}
        />
      );
    },
    ({ selectedIds, selectedItems, params, isDisabled }) => {
      const selectedAlertStatuses = [
        ...new Set(
          Object.values(selectedItems).map((item) => {
            const status = item.alertStatus;
            // Strip _IN_PROGRESS and _ON_HOLD suffixes to treat them as the base status
            const baseStatus = status?.replace(/_(IN_PROGRESS|ON_HOLD)$/, '') as AlertStatus;
            // map REOPENED to OPEN
            return baseStatus === 'REOPENED' ? 'OPEN' : baseStatus;
          }),
        ),
      ];
      const selectedAlertStatus =
        selectedAlertStatuses.length === 1 ? selectedAlertStatuses[0] : undefined;
      const selectedCaseIds = getSelectedCaseIdsForAlerts(selectedItems);
      const selectedCaseId = selectedCaseIds.length === 1 ? selectedCaseIds[0] : undefined;
      const caseId = params.caseId ?? selectedCaseId;
      const alertStatus = selectedAlertStatus;
      const isCaseHavingEscalated = isEscalatedCases(selectedItems, true);
      const status = selectedItems[selectedIds[0]]?.alertStatus;
      const caseUser = selectedItems[selectedIds[0]]?.user;

      const isReviewAlerts = isInReviewCases(selectedItems, true);

      if (isCaseHavingEscalated || isReviewAlerts) {
        return;
      }
      if (
        !escalationEnabled ||
        !caseId ||
        !alertStatus ||
        isReviewAlerts ||
        isCaseHavingEscalated
      ) {
        return;
      }
      return (
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
            CLOSED: { status: 'ESCALATED', actionLabel: 'Escalate' },
            OPEN_IN_PROGRESS: { status: 'ESCALATED', actionLabel: 'Escalate' },
            OPEN_ON_HOLD: { status: 'ESCALATED', actionLabel: 'Escalate' },
          }}
          isDisabled={isDisabled}
          updateModalState={(modalState) => {
            updateModalState(modalState as ModalProps);
          }}
          setModalVisibility={setModalVisibility}
          haveModal={false}
          user={caseUser}
          alertsData={selectedIds.map((id) => ({
            alertId: id,
            ruleNature: selectedItems[id]?.ruleNature,
          }))}
        />
      );
    },
    ({ selectedIds, selectedItems, params, isDisabled }) => {
      const isReviewAlerts = isInReviewCases(selectedItems, true);
      const isAllAlertsOfStatusEscalatedL2 = isAllAlertStartingWithStatus(
        selectedItems,
        'ESCALATED_L2',
      );

      const selectedCaseIds = getSelectedCaseIdsForAlerts(selectedItems);
      const selectedCaseId = selectedCaseIds.length === 1 ? selectedCaseIds[0] : undefined;
      const caseId = params.caseId ?? selectedCaseId;
      const status = selectedItems[selectedIds[0]]?.alertStatus;
      const canMutateEscalatedL2Cases =
        canMutateEscalatedCases(selectedItems, user.userId, isMultiEscalationEnabled) &&
        userAccount?.escalationLevel === 'L2';
      const caseUser = selectedItems[selectedIds[0]]?.user;

      if (
        !escalationEnabled ||
        !caseId ||
        isReviewAlerts ||
        !isAllAlertsOfStatusEscalatedL2 ||
        !canMutateEscalatedL2Cases
      ) {
        return;
      }
      return (
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
            ESCALATED_L2: { status: 'ESCALATED', actionLabel: 'Send back' },
            ESCALATED_L2_IN_PROGRESS: { status: 'ESCALATED', actionLabel: 'Send back' },
            ESCALATED_L2_ON_HOLD: { status: 'ESCALATED', actionLabel: 'Send back' },
          }}
          isDisabled={isDisabled}
          updateModalState={(modalState) => {
            updateModalState(modalState as ModalProps);
          }}
          setModalVisibility={setModalVisibility}
          haveModal={false}
          user={caseUser}
          alertsData={selectedIds.map((id) => ({
            alertId: id,
            ruleNature: selectedItems[id]?.ruleNature,
          }))}
        />
      );
    },
    ({ selectedIds, selectedItems, isDisabled, params }) => {
      const isAllAlertsOfStatusEscalated = isAllAlertsOfStatus(selectedItems, 'ESCALATED');

      const isReviewAlerts = isInReviewCases(selectedItems, true);
      const selectedCaseIds = getSelectedCaseIdsForAlerts(selectedItems);
      const selectedCaseId = selectedCaseIds.length === 1 ? selectedCaseIds[0] : undefined;
      const caseId = params.caseId ?? selectedCaseId;
      const status = selectedItems[selectedIds[0]]?.alertStatus;
      const caseUser = selectedItems[selectedIds[0]]?.user;
      if (!caseId) {
        return;
      }

      if (
        !isMultiEscalationEnabled ||
        !isAllAlertsOfStatusEscalated ||
        !canMutateEscalatedCases(selectedItems, user.userId, isMultiEscalationEnabled) ||
        isReviewAlerts ||
        !caseId ||
        !status ||
        status !== 'ESCALATED'
      ) {
        return;
      }
      return (
        <AlertsStatusChangeButton
          ids={selectedIds}
          transactionIds={selectedTxns}
          onSaved={() => {
            reloadTable();
            setSelectedTxns({});
          }}
          status={status}
          caseId={caseId}
          isDisabled={isDisabled}
          statusTransitions={{
            ESCALATED: { status: 'ESCALATED_L2', actionLabel: 'Escalate L2' },
          }}
          updateModalState={(modalState) => {
            updateModalState(modalState as ModalProps);
          }}
          setModalVisibility={setModalVisibility}
          haveModal={false}
          user={caseUser}
          alertsData={selectedIds.map((id) => ({
            alertId: id,
            ruleNature: selectedItems[id]?.ruleNature,
          }))}
        />
      );
    },
    ({ selectedIds, selectedItems, isDisabled, params }) => {
      const isAllAlertsOfStatusEscalated = isAllAlertStartingWithStatus(selectedItems, 'ESCALATED');
      const isAllAlertsOfStatusEscalatedL2 = isAllAlertStartingWithStatus(
        selectedItems,
        'ESCALATED_L2',
      );
      const isReviewAlerts = isInReviewCases(selectedItems, true);

      if (
        !isAllAlertsOfStatusEscalated ||
        !canMutateEscalatedCases(selectedItems, user.userId, isMultiEscalationEnabled) ||
        isReviewAlerts ||
        isAllAlertsOfStatusEscalatedL2
      ) {
        return;
      }

      const selectedCaseIds = getSelectedCaseIdsForAlerts(selectedItems);
      const selectedCaseId = selectedCaseIds.length === 1 ? selectedCaseIds[0] : undefined;
      const caseId = params.caseId ?? selectedCaseId;
      const status = selectedItems[selectedIds[0]]?.alertStatus;
      const caseUser = selectedItems[selectedIds[0]]?.user;
      if (!caseId) {
        return;
      }
      const statusTransitions: Partial<
        Record<AlertStatus, { status: AlertStatus; actionLabel: ActionLabel }>
      > = {
        ESCALATED_IN_PROGRESS: { status: 'OPEN', actionLabel: 'Send back' },
        ESCALATED_ON_HOLD: { status: 'OPEN', actionLabel: 'Send back' },
        ESCALATED: { status: 'OPEN', actionLabel: 'Send back' },
      };

      return (
        <AlertsStatusChangeButton
          ids={selectedIds}
          transactionIds={selectedTxns}
          onSaved={() => {
            reloadTable();
            setSelectedTxns({});
          }}
          status={status}
          caseId={caseId}
          isDisabled={isDisabled}
          statusTransitions={statusTransitions}
          updateModalState={(modalState) => {
            updateModalState(modalState as ModalProps);
          }}
          setModalVisibility={setModalVisibility}
          haveModal={false}
          user={caseUser}
          alertsData={selectedIds.map((id) => ({
            alertId: id,
            ruleNature: selectedItems[id]?.ruleNature,
          }))}
        />
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
      const isEscalated = isEscalatedCases(selectedItems, true);
      const caseUser = selectedItems[selectedIds[0]]?.user;
      if (isReviewAlerts || isEscalated) {
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
          }}
          updateModalState={(modalState) => {
            updateModalState(modalState as ModalProps);
          }}
          setModalVisibility={setModalVisibility}
          haveModal={false}
          user={caseUser}
          alertsData={selectedIds.map((id) => ({
            alertId: id,
            ruleNature: selectedItems[id]?.ruleNature,
          }))}
        />
      ) : null;
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
      const isEscalated = isEscalatedCases(selectedItems, true);
      const isEscalatedL2 = isEscalatedL2Cases(selectedItems, true);
      if (isReviewAlerts || !isEscalated || isEscalatedL2) {
        return;
      }
      const canMutateCases = canMutateEscalatedCases(
        selectedItems,
        user.userId,
        isMultiEscalationEnabled,
      );
      const statusChangeButtonValue =
        selectedStatuses.length === 1 ? selectedStatuses[0] : undefined;
      const caseUser = selectedItems[selectedIds[0]]?.user;
      if (selectedTransactionIds.length) {
        return;
      }
      return statusChangeButtonValue && canMutateCases ? (
        <AlertsStatusChangeButton
          ids={selectedIds}
          transactionIds={selectedTxns}
          onSaved={reloadTable}
          status={statusChangeButtonValue}
          caseId={params.caseId}
          isDisabled={isDisabled}
          statusTransitions={{
            ESCALATED_IN_PROGRESS: { status: 'CLOSED', actionLabel: 'Close' },
            ESCALATED_ON_HOLD: { status: 'CLOSED', actionLabel: 'Close' },
          }}
          updateModalState={(modalState) => {
            updateModalState(modalState as ModalProps);
          }}
          setModalVisibility={setModalVisibility}
          haveModal={false}
          user={caseUser}
          alertsData={selectedIds.map((id) => ({
            alertId: id,
            ruleNature: selectedItems[id]?.ruleNature,
          }))}
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
    ({ selectedIds, params, selectedItems }) => {
      if (selectedTransactionIds.length || !isAllAlertsOfStatus(selectedItems, 'CLOSED')) {
        return;
      }

      return (
        params.caseId && (
          <QaStatusChangeModal
            status={'PASSED'}
            alertIds={selectedIds}
            caseId={params.caseId}
            onSuccess={reloadTable}
          />
        )
      );
    },
    ({ selectedIds, params, selectedItems }) => {
      if (selectedTransactionIds.length || !isAllAlertsOfStatus(selectedItems, 'CLOSED')) {
        return;
      }
      return (
        params.caseId && (
          <QaStatusChangeModal
            status={'FAILED'}
            alertIds={selectedIds}
            caseId={params.caseId}
            onSuccess={reloadTable}
          />
        )
      );
    },
  ];

  const exportPermissions = useHasResources(['read:::case-management/export/*']);
  return (
    <>
      <QueryResultsTable<TableAlertItem, AlertTableParams>
        expandedRowId={expandedAlertId}
        tableId={isEmbedded ? 'alerts-list-embedded' : 'alerts-list'}
        rowKey="alertId"
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
                  isEmbedded={isEmbedded}
                  escalatedTransactionIds={props.escalatedTransactionIds || []}
                  selectedTransactionIds={selectedTxns[alert.alertId ?? ''] ?? []}
                  selectedSanctionsHitsIds={
                    selectedSanctionHits[alert.alertId ?? '']?.map(({ id }) => id) ?? []
                  }
                  onTransactionSelect={(alertId, transactionIds) => {
                    resetSelection({
                      keepTxns: true,
                      keepAlerts: true,
                    });
                    setSelectedTxns((prevSelectedTxns) => {
                      if (transactionIds.length === 0) {
                        // when minimizing an alert, removing it key from selected txn, avoid repetition of ids
                        if (alertId in prevSelectedTxns) {
                          delete prevSelectedTxns[alertId];
                          return prevSelectedTxns;
                        } else {
                          return prevSelectedTxns;
                        }
                      }
                      return {
                        ...prevSelectedTxns,
                        [alertId]: transactionIds,
                      };
                    });
                    if (transactionIds.length > 0) {
                      // if a alert is selected, selecting a txn should partially select alert
                      setSelectedAlerts((prevSelectedAlerts) =>
                        prevSelectedAlerts.filter((id) => id !== alertId),
                      );
                    }
                  }}
                  onSanctionsHitSelect={(alertId, sanctionsHitsIds, status) => {
                    resetSelection({});
                    setSelectedSanctionHits((prevState) => {
                      if (sanctionsHitsIds.length === 0) {
                        if (alertId in prevState) {
                          delete prevState[alertId];
                          return prevState;
                        } else {
                          return prevState;
                        }
                      }
                      return {
                        ...prevState,
                        [alertId]: sanctionsHitsIds.map((id) => ({ id, status })),
                      };
                    });
                    if (sanctionsHitsIds.length > 0) {
                      setSelectedAlerts((prevSelectedAlerts) =>
                        prevSelectedAlerts.filter((id) => id !== alertId),
                      );
                    }
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
        partiallySelectedIds={[
          ...Object.entries(selectedTxns)
            .filter(([id, txns]) => !selectedAlerts.includes(id) && txns.length > 0)
            .map(([id]) => id),
          ...Object.entries(selectedSanctionHits)
            .filter(([id, sanction]) => !selectedAlerts.includes(id) && sanction.length > 0)
            .map(([id]) => id),
        ]}
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
        onClose={() => {
          setStatusChangeModalVisible(false);
          queryResults.refetch();
          reloadTable();
        }}
        newStatus={statusChangeModalState ?? 'CLEARED'}
        updateMutation={adaptMutationVariables(changeHitsStatusMutation, (formValues) =>
          updateSanctionsData(formValues, selectedSanctionHits),
        )}
      />
    </>
  );
}
