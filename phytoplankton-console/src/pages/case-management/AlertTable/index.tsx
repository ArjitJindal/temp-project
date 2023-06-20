import React, { useCallback, useMemo, useRef, useState } from 'react';
import pluralize from 'pluralize';
import { AssigneesDropdown } from '../components/AssigneesDropdown';
import CreateCaseConfirmModal from './CreateCaseConfirmModal';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { Account, AlertListResponseItem, AlertStatus, Assignment, RuleInstance } from '@/apis';
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
import { SarButton as SarDemoButton } from '@/components/SarDemo';
import { SarButton as SarButton } from '@/components/Sar';

export type AlertTableParams = AllParams<TableSearchParams>;
const mergedColumns = (
  users: Record<string, Account>,
  hideUserColumns: boolean,
  hideAlertStatusFilters: boolean,
  handleAssignToRequest: (
    alertIds: Array<string>,
    assignment: Assignment,
    isReview: boolean,
  ) => void,
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
                const assignments = {
                  assignedByUserId: userId,
                  assigneeUserId: assignees[assignees.length - 1],
                  timestamp: Date.now(),
                };
                handleAssignToRequest(
                  [entity.alertId as string],
                  assignments,
                  entity.alertStatus === 'ESCALATED',
                );
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
  onChangeParams: (newState: AlertTableParams) => void;
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
    params,
    onChangeParams,
    isEmbedded = false,
    hideAlertStatusFilters = false,
    hideUserFilters = false,
    expandTransactions = true,
  } = props;
  const escalationEnabled = useFeatureEnabled('ESCALATION');
  const isPulseEnabled = useFeatureEnabled('PULSE');
  const sarDemoEnabled = useFeatureEnabled('SAR_DEMO');
  const sarEnabled = useFeatureEnabled('SAR');
  const api = useApi();
  const user = useAuth0User();
  const [users, _] = useUsers({ includeBlockedUsers: true });
  const [selectedTxns, setSelectedTxns] = useState<{ [alertId: string]: string[] }>({});
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const selectedTransactionIds = useMemo(() => {
    return Object.values(selectedTxns)
      .flatMap((v) => v)
      .filter(Boolean);
  }, [selectedTxns]);

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
        transactionState,
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
        filterTransactionState:
          transactionState && transactionState.length > 0 ? transactionState : undefined,
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

  const handleAssignTo = (account: Account, selectedEntities: string[], isReview: boolean) => {
    const assignment = {
      assigneeUserId: account.id,
      assignedByUserId: user.userId,
      timestamp: Date.now(),
    };
    handleAssignToRequest(selectedEntities, assignment, isReview);
  };

  const handleAssignToRequest = useCallback(
    (alertIds: string[], assignment: Assignment, isReview: boolean) => {
      const hideLoading = message.loading('Assigning alerts');
      api
        .alertsAssignee({
          AlertsAssignmentUpdateRequest: {
            alertIds: alertIds,
            assignment: isReview ? undefined : assignment,
            reviewAssignment: isReview ? assignment : undefined,
          },
        })
        .then(() => {
          message.success('Done!');
          reloadTable();
        })
        .catch(() => {
          message.success('Unable to reassign alerts!');
        })
        .finally(() => {
          hideLoading();
        });
    },
    [reloadTable, api],
  );

  const columns = useMemo(
    () =>
      mergedColumns(
        users,
        hideUserFilters,
        hideAlertStatusFilters,
        handleAssignToRequest,
        user.userId,
      ),
    [users, hideUserFilters, hideAlertStatusFilters, handleAssignToRequest, user.userId],
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
    () => makeExtraFilters(isPulseEnabled, ruleOptions, hideUserFilters),
    [isPulseEnabled, ruleOptions, hideUserFilters],
  );
  let sarDemoButton: any = () => null;
  if (process.env.ENV_NAME !== 'prod') {
    sarDemoButton = () =>
      sarDemoEnabled ? (
        <SarDemoButton transactionIds={Object.values(selectedTxns).flatMap((v) => v)} />
      ) : null;
  }

  let sarButton: any = () => null;
  if (caseId && sarEnabled) {
    sarButton = () =>
      selectedTransactionIds.length > 0 && (
        <SarButton caseId={caseId} transactionIds={selectedTransactionIds} />
      );
  }

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
        params={params}
        onChangeParams={onChangeParams}
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
          sarDemoButton,
          sarButton,
          ({ selectedIds, selectedItems }) => {
            if (selectedTransactionIds.length) {
              return;
            }

            const selectedAlertStatuses = new Set(
              Object.values(selectedItems).map((item) => item.alertStatus),
            );
            if (selectedAlertStatuses.has('ESCALATED') && selectedAlertStatuses.size === 1) {
              return (
                <AssignToButton
                  ids={selectedIds}
                  onSelect={(account, ids) => handleAssignTo(account, ids, true)}
                />
              );
            } else if (!selectedAlertStatuses.has('ESCALATED')) {
              return (
                <AssignToButton
                  ids={selectedIds}
                  onSelect={(account, ids) => handleAssignTo(account, ids, false)}
                />
              );
            }
          },
          ({ selectedIds, selectedItems, params }) => {
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
                />
              )
            );
          },
          ({ selectedIds, selectedItems, params }) => {
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

            return statusChangeButtonValue ? (
              <AlertsStatusChangeButton
                ids={selectedIds}
                transactionIds={selectedTxns}
                onSaved={reloadTable}
                status={params.alertStatus ?? statusChangeButtonValue}
                caseId={params.caseId}
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
