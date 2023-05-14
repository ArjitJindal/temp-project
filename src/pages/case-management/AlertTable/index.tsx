import React, { useCallback, useMemo, useRef, useState } from 'react';
import pluralize from 'pluralize';
import { Avatar } from 'antd';
import CreateCaseConfirmModal from './CreateCaseConfirmModal';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { Account, AlertListResponseItem, RuleInstance } from '@/apis';
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
import Tooltip from '@/components/library/Tooltip';
import { UI_SETTINGS } from '@/pages/case-management-item/CaseDetails/ui-settings';
import {
  ASSIGNMENTS,
  CASE_STATUS,
  DATE,
  RULE_ACTION,
  RULE_NATURE,
} from '@/components/library/Table/standardDataTypes';
import { useRules } from '@/utils/rules';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DefaultApiGetAlertListRequest } from '@/apis/types/ObjectParamAPI';

export type AlertTableParams = AllParams<TableSearchParams>;

const mergedColumns = (
  users: Record<string, Account>,
  hideUserColumns: boolean,
  hideAlertStatusFilters: boolean,
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
      type: CASE_STATUS({ statusesToShow: ['OPEN', 'CLOSED'] }),
    }),
    helper.simple<'caseCreatedTimestamp'>({
      title: 'Case created at',
      key: 'caseCreatedTimestamp',
      type: DATE,
      sorting: true,
    }),
    helper.simple<'assignments'>({
      title: 'Assigned to',
      key: 'assignments',
      id: '_assigneeName',
      sorting: true,
      type: {
        ...ASSIGNMENTS,
        render: (assignments) => {
          return (
            <>
              {users &&
                assignments?.map((assignment) => {
                  const user = users[assignment.assigneeUserId]?.name ?? assignment.assigneeUserId;

                  return (
                    <Tooltip key={user} title={user}>
                      <Avatar key={user} size="small">
                        {user.substring(0, 2).toUpperCase()}
                      </Avatar>
                    </Tooltip>
                  );
                })}
            </>
          );
        },
      },
    }),
  ]);
};

interface Props {
  params: AlertTableParams;
  onChangeParams: (newState: AlertTableParams) => void;
  isEmbedded?: boolean;
  hideAlertStatusFilters?: boolean;
  hideUserFilters?: boolean;
  escalatedTransactionIds?: string[];
}

export default function AlertTable(props: Props) {
  const {
    params,
    onChangeParams,
    isEmbedded = false,
    hideAlertStatusFilters = false,
    hideUserFilters = false,
  } = props;
  const escalationEnabled = useFeatureEnabled('ESCALATION');

  const api = useApi();
  const user = useAuth0User();
  const isPulseEnabled = useFeatureEnabled('PULSE');
  const [users, _] = useUsers({ includeBlockedUsers: true });
  const [selectedTxns, setSelectedTxns] = useState<{ [alertId: string]: string[] }>({});
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);

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
        showCases,
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

      if (showCases === 'MY_ALERTS') {
        filterAssignmentsIds = [user.userId];
      } else if (assignedTo?.length) {
        filterAssignmentsIds = assignedTo;
      }

      const preparedParams: DefaultApiGetAlertListRequest = {
        page,
        pageSize,
        filterAlertId: alertId,
        filterCaseId: caseId,
        filterOutAlertStatus: alertStatus === 'OPEN' ? 'CLOSED' : undefined,
        filterAlertStatus: alertStatus === 'CLOSED' ? 'CLOSED' : undefined,
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
        filterOriginPaymentMethod: originMethodFilter,
        filterDestinationPaymentMethod: destinationMethodFilter,
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

  const handleAssignTo = (account: Account, selectedEntities: string[]) => {
    const hideLoading = message.loading('Assigning alerts');
    api
      .postAlerts({
        AlertsUpdateRequest: {
          alertIds: selectedEntities,
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
        message.success('Unable to reassign alerts!');
      })
      .finally(() => {
        hideLoading();
      });
  };

  const columns = useMemo(
    () => mergedColumns(users, hideUserFilters, hideAlertStatusFilters),
    [users, hideUserFilters, hideAlertStatusFilters],
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
        selectedIds={selectedAlerts}
        extraFilters={extraFilters}
        pagination={isEmbedded ? 'HIDE_FOR_ONE_PAGE' : true}
        selectionActions={[
          ({ selectedIds }) => <AssignToButton ids={selectedIds} onSelect={handleAssignTo} />,

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

            const alertClosedBefore = Object.values(selectedItems).some((item) => {
              return item.statusChanges?.some((statusChange) => {
                return statusChange?.caseStatus === 'CLOSED';
              });
            });

            return (
              escalationEnabled &&
              params.caseId &&
              params.alertStatus != 'ESCALATED' &&
              statusChangeButtonValue && (
                <AlertsStatusChangeButton
                  ids={selectedIds}
                  txnIds={selectedTxns}
                  onSaved={reloadTable}
                  status={params.alertStatus ?? statusChangeButtonValue}
                  caseId={params.caseId}
                  statusTransitions={{
                    OPEN: { status: 'ESCALATED', actionLabel: 'Escalate' },
                    REOPENED: { status: 'ESCALATED', actionLabel: 'Escalate' },
                    ESCALATED: {
                      status: alertClosedBefore ? 'REOPENED' : 'OPEN',
                      actionLabel: 'Send back',
                    },
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

            return statusChangeButtonValue ? (
              <AlertsStatusChangeButton
                ids={selectedIds}
                txnIds={selectedTxns}
                onSaved={reloadTable}
                status={params.alertStatus ?? statusChangeButtonValue}
                caseId={params.caseId}
              />
            ) : null;
          },
          ({ selectedIds, params, onResetSelection }) =>
            params.caseId && (
              <CreateCaseConfirmModal
                selectedEntities={selectedIds}
                caseId={params.caseId}
                onResetSelection={onResetSelection}
              />
            ),
        ]}
        renderExpanded={(record) => (
          <ExpandedRowRenderer
            alert={record ?? null}
            escalatedTransactionIds={props.escalatedTransactionIds}
            onTransactionSelect={(alertId, txnIds) => {
              setSelectedTxns((prevSelectedTxns) => {
                prevSelectedTxns[alertId] = [...txnIds];
                return prevSelectedTxns;
              });
              if (txnIds.length > 0) {
                setSelectedAlerts((prev) => Array.from(new Set([...prev, alertId])));
              }
            }}
          />
        )}
        fixedExpandedContainer={true}
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
