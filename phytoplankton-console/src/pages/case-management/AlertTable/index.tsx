import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import pluralize from 'pluralize';
import { useMutation } from '@tanstack/react-query';
import { AssigneesDropdown } from '../components/AssigneesDropdown';
import CreateCaseConfirmModal from './CreateCaseConfirmModal';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import {
  Account,
  AlertListResponseItem,
  AlertStatus,
  AlertsAssignmentsUpdateRequest,
  AlertsReviewAssignmentsUpdateRequest,
  Assignment,
  RuleInstance,
} from '@/apis';
import { ALERT_LIST } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, TableColumn, TableData, TableRefType } from '@/components/library/Table/types';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import { QueryResult } from '@/utils/queries/types';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import dayjs from '@/utils/dayjs';
import { getUserName } from '@/utils/api/users';
import ExpandedRowRenderer from '@/pages/case-management/AlertTable/ExpandedRowRenderer';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';
import AssignToButton from '@/pages/case-management/components/AssignToButton';
import { useAuth0User, useUsers } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { TableSearchParams } from '@/pages/case-management/types';
import { makeExtraFilters } from '@/pages/case-management/helpers';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { UI_SETTINGS } from '@/pages/case-management-item/CaseDetails/ui-settings';
import {
  ASSIGNMENTS,
  CASEID_PRIORITY,
  CASE_STATUS,
  DATE,
  DATE_TIME,
  RULE_ACTION,
  RULE_NATURE,
} from '@/components/library/Table/standardDataTypes';
import { useRules } from '@/utils/rules';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DefaultApiGetAlertListRequest } from '@/apis/types/ObjectParamAPI';
import { neverReturn } from '@/utils/lang';
import { SarButton as SarButton } from '@/components/Sar';

export type AlertTableParams = AllParams<TableSearchParams>;

const mergedColumns = (
  users: Record<string, Account>,
  hideUserColumns: boolean,
  hideAlertStatusFilters: boolean,
  handleAlertsAssignments: (updateRequest: AlertsAssignmentsUpdateRequest) => void,
  handleAlertsReviewAssignments: (updateRequest: AlertsReviewAssignmentsUpdateRequest) => void,
  userId: string,
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
          return (
            <Id
              id={alertId}
              to={addBackUrlToRoute(
                makeUrl(
                  `/case-management/case/:caseId`,
                  {
                    caseId: entity.caseId,
                  },
                  { focus: UI_SETTINGS.cards.ALERTS.key },
                ),
              )}
            >
              {alertId}
            </Id>
          );
        },
      },
    }),
    helper.simple<'caseId'>({
      title: 'Case ID',
      subtitle: 'Priority',
      key: 'caseId',
      type: CASEID_PRIORITY,
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
      type: CASE_STATUS({ statusesToShow: ['OPEN', 'CLOSED', 'ESCALATED', 'REOPENED'] }),
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
      value: (item) =>
        item.alertStatus === 'ESCALATED' ? item.reviewAssignments : item.assignments,
      type: {
        ...ASSIGNMENTS,
        render: (assignments, { item: entity }) => {
          return (
            <AssigneesDropdown
              assignments={assignments || []}
              editing={true}
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

    helper.simple<'lastStatusChange.timestamp'>({
      title: 'Last update time',
      key: 'lastStatusChange.timestamp',
      type: DATE_TIME,
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
  } = props;
  const escalationEnabled = useFeatureEnabled('ESCALATION');
  const isPulseEnabled = useFeatureEnabled('PULSE');
  const sarEnabled = useFeatureEnabled('SAR');
  const api = useApi();
  const user = useAuth0User();

  const [users, _] = useUsers({ includeBlockedUsers: true });
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

  const queryResults: QueryResult<TableData<TableAlertItem>> = usePaginatedQuery(
    ALERT_LIST(params),
    async () => {
      const {
        sort,
        page,
        pageSize,
        alertId,
        alertStatus,
        userId,
        businessIndustryFilter,
        tagKey,
        tagValue,
        caseId,
        assignedTo,
        destinationMethodFilter,
        originMethodFilter,
        createdTimestamp,
        caseCreatedTimestamp,
        rulesHitFilter,
      } = params;
      const [sortField, sortOrder] = sort[0] ?? [];

      let filterAssignmentsIds: string[] | undefined = undefined;

      let filterAlertStatus: AlertStatus[];
      if (alertStatus == null) {
        filterAlertStatus = [];
      } else if (alertStatus === 'OPEN' || alertStatus === 'REOPENED') {
        filterAlertStatus = ['OPEN', 'REOPENED'];
      } else if (alertStatus === 'CLOSED') {
        filterAlertStatus = ['CLOSED'];
      } else if (alertStatus === 'ESCALATED') {
        filterAlertStatus = ['ESCALATED'];
      } else {
        filterAlertStatus = neverReturn(alertStatus, []);
      }

      if (assignedTo?.length) {
        filterAssignmentsIds = assignedTo;
      }

      const preparedParams: DefaultApiGetAlertListRequest = {
        page,
        pageSize,
        filterAlertId: alertId,
        filterCaseId: caseId,
        filterAlertStatus: filterAlertStatus,
        filterAssignmentsIds,
        filterBusinessIndustries:
          businessIndustryFilter && businessIndustryFilter.length > 0
            ? businessIndustryFilter
            : undefined,
        filterTransactionTagKey: tagKey,
        filterTransactionTagValue: tagValue,
        filterUserId: userId,
        filterOriginPaymentMethods: originMethodFilter,
        filterDestinationPaymentMethods: destinationMethodFilter,
        filterRulesHit: rulesHitFilter,
        sortField: sortField === 'age' ? 'createdTimestamp' : sortField,
        sortOrder: sortOrder ?? undefined,
        ...(createdTimestamp
          ? {
              filterAlertBeforeCreatedTimestamp: createdTimestamp
                ? dayjs.dayjs(createdTimestamp[1]).valueOf()
                : Number.MAX_SAFE_INTEGER,
              filterAlertAfterCreatedTimestamp: createdTimestamp
                ? dayjs.dayjs(createdTimestamp[0]).valueOf()
                : 0,
            }
          : {}),
        ...(caseCreatedTimestamp
          ? {
              filterCaseBeforeCreatedTimestamp: caseCreatedTimestamp
                ? dayjs.dayjs(caseCreatedTimestamp[1]).valueOf()
                : Number.MAX_SAFE_INTEGER,
              filterCaseAfterCreatedTimestamp: caseCreatedTimestamp
                ? dayjs.dayjs(caseCreatedTimestamp[0]).valueOf()
                : 0,
            }
          : {}),
      };
      const result = await api.getAlertList(
        Object.entries(preparedParams).reduce(
          (acc, [key, value]) => ({ ...acc, [key]: value }),
          {},
        ),
      );
      return {
        items: presentAlertData(result.data),
        total: result.total,
      };
    },
  );

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
        users,
        hideUserFilters,
        hideAlertStatusFilters,
        handleAlertAssignments,
        handleAlertsReviewAssignments,
        user.userId,
      ),
    [
      users,
      hideUserFilters,
      hideAlertStatusFilters,
      handleAlertAssignments,
      handleAlertsReviewAssignments,
      user.userId,
    ],
  );

  const rules = useRules();

  const ruleOptions = useMemo(() => {
    return Object.values(rules.ruleInstances).map((rulesInstance: RuleInstance) => {
      const ruleName = rulesInstance.ruleNameAlias || rules.rules[rulesInstance.ruleId]?.name;
      return {
        value: rulesInstance.id ?? '',
        label: `${ruleName} ${rulesInstance.ruleId} (${rulesInstance.id})`,
      };
    });
  }, [rules.ruleInstances, rules.rules]);

  const extraFilters = useMemo(
    () => makeExtraFilters(isPulseEnabled, ruleOptions, hideUserFilters, 'ALERTS'),
    [isPulseEnabled, ruleOptions, hideUserFilters],
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

            if (selectedTransactionIds.length) {
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
            const selectedCaseIds = [
              ...new Set(
                Object.values(selectedItems)
                  .map(({ caseId }) => caseId)
                  .filter((x): x is string => typeof x === 'string'),
              ),
            ];
            const selectedCaseId = selectedCaseIds.length === 1 ? selectedCaseIds[0] : undefined;
            const caseId = params.caseId ?? selectedCaseId;
            const alertStatus = params.alertStatus ?? selectedAlertStatus;
            if (alertStatus === 'ESCALATED' && selectedTransactionIds.length) {
              return;
            }
            return (
              escalationEnabled &&
              caseId &&
              alertStatus && (
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
                  }}
                  isDisabled={isDisabled}
                />
              )
            );
          },
          ({ selectedIds, selectedItems, params, isDisabled }) => {
            const selectedStatuses = [
              ...new Set(
                Object.values(selectedItems).map((item) => {
                  return item.alertStatus === 'CLOSED' ? 'CLOSED' : 'OPEN';
                }),
              ),
            ];
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
                  escalatedTransactionIds={props.escalatedTransactionIds}
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

function presentAlertData(data: AlertListResponseItem[]) {
  return data.map(({ alert, caseUsers, ...rest }) => {
    const caseUser = caseUsers ?? {};
    const user = caseUser?.origin?.userId
      ? caseUser?.origin
      : caseUser?.destination?.userId
      ? caseUser?.destination
      : undefined;
    const duration = dayjs.duration(Date.now() - alert.createdTimestamp);
    return {
      ...alert,
      caseCreatedTimestamp: rest.caseCreatedTimestamp,
      caseUserName: getUserName(user),
      age: pluralize('day', Math.floor(duration.asDays()), true),
      caseUserId: caseUsers?.origin?.userId ?? caseUsers?.destination?.userId ?? '',
    };
  });
}
