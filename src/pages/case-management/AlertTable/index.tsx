import { useCallback, useMemo, useRef, useState } from 'react';
import pluralize from 'pluralize';
import { Avatar } from 'antd';
import { useCreateNewCaseMutation } from './helpers';
import { getMutationAsyncResource, usePaginatedQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { Account, AlertListResponseItem } from '@/apis';
import { ALERT_LIST } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { TableColumn, TableData, TableRow } from '@/components/ui/Table/types';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import { QueryResult } from '@/utils/queries/types';
import { AllParams, TableActionType } from '@/components/ui/Table';
import ScopeSelector from '@/pages/case-management/components/ScopeSelector';
import StatusButtons from '@/pages/transactions/components/StatusButtons';
import CaseStatusTag from '@/components/ui/CaseStatusTag';
import { RuleActionTag } from '@/components/rules/RuleActionTag';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import dayjs, { DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { getUserName } from '@/utils/api/users';
import ExpandedRowRenderer from '@/pages/case-management/AlertTable/ExpandedRowRenderer';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';
import AssignToButton from '@/pages/case-management/components/AssignToButton';
import { useAuth0User, useUsers } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { TableSearchParams } from '@/pages/case-management/types';
import { extraFilters } from '@/pages/case-management/helpers';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import Confirm from '@/components/utils/Confirm';
import Tooltip from '@/components/library/Tooltip';
import { UI_SETTINGS } from '@/pages/case-management-item/UserCaseDetails/ui-settings';

export type AlertTableParams = AllParams<TableSearchParams>;

interface Props {
  params: TableSearchParams;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
  hideCaseIdFilter?: boolean;
  disableInternalPadding?: boolean;
  isEmbedded?: boolean;
  hideScopeSelector?: boolean;
}

const mergedColumns = (
  hideCaseIdFilter: boolean,
  users: Record<string, Account>,
): TableColumn<TableAlertItem>[] => {
  return [
    {
      title: 'Alert ID',
      dataIndex: 'alertId',
      exportData: 'alertId',
      valueType: 'text',
      width: 130,
      fieldProps: {
        icon: <StackLineIcon />,
        showFilterByDefault: true,
      },
      render: (dom, entity) => {
        return (
          <Id
            id={entity.alertId}
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
            {entity.alertId}
          </Id>
        );
      },
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      exportData: 'priority',
      width: 100,
      valueType: 'text',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: 'Alert age',
      dataIndex: 'age',
      exportData: 'age',
      hideInSearch: true,
      width: 100,
      sorter: true,
    },
    {
      title: '#TX',
      dataIndex: 'numberOfTransactionsHit',
      exportData: 'numberOfTransactionsHit',
      width: 100,
      valueType: 'text',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: 'User name',
      dataIndex: 'caseUserName',
      exportData: 'caseUserName',
      width: 100,
      hideInSearch: true,
    },
    {
      title: 'Rule name',
      dataIndex: 'ruleName',
      exportData: 'ruleName',
      width: 100,
      valueType: 'text',
      hideInSearch: true,
    },
    {
      title: 'Rule description',
      dataIndex: 'ruleDescription',
      exportData: 'ruleDescription',
      width: 100,
      valueType: 'text',
      hideInSearch: true,
    },
    {
      title: 'Rule action',
      dataIndex: 'ruleAction',
      exportData: 'ruleAction',
      width: 100,
      valueType: 'text',
      hideInSearch: true,
      render: (_, entity) => {
        return entity.ruleAction ? <RuleActionTag ruleAction={entity.ruleAction} /> : '-';
      },
    },
    {
      title: 'Alert status',
      dataIndex: 'alertStatus',
      exportData: 'alertStatus',
      width: 100,
      valueType: 'text',
      hideInSearch: true,
      render: (_, entity) => {
        return entity.alertStatus ? <CaseStatusTag caseStatus={entity.alertStatus} /> : '-';
      },
    },
    {
      title: 'Case ID',
      dataIndex: 'caseId',
      exportData: 'caseId',
      width: 100,
      valueType: 'text',
      hideInSearch: hideCaseIdFilter,
      render: (dom, entity) => {
        if (!entity.caseId) {
          return <>No ID</>;
        }
        return (
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
        );
      },
    },
    {
      title: 'Case created at',
      dataIndex: 'caseCreatedTimestamp',
      valueType: 'dateRange',
      hideInSearch: true,
      exportData: (entity) =>
        dayjs.dayjs(entity.caseCreatedTimestamp).format(DEFAULT_DATE_TIME_FORMAT),
      width: 100,
      render: (_, entity) => {
        return <TimestampDisplay timestamp={entity.caseCreatedTimestamp} />;
      },
    },
    {
      title: 'Assigned to',
      dataIndex: '_assigneeName',
      exportData: 'assignments',
      hideInSearch: true,
      width: 100,
      sorter: true,
      render: (_, entity) => {
        return (
          users &&
          entity.assignments?.map((assignment) => {
            const user = users[assignment.assigneeUserId]?.name ?? assignment.assigneeUserId;

            return (
              <Tooltip key={user} title={user}>
                <Avatar key={user} size="small">
                  {user.substring(0, 2).toUpperCase()}
                </Avatar>
              </Tooltip>
            );
          })
        );
      },
    },
  ];
};

type ConfirmModalProps = {
  selectedEntities: string[];
  caseId: string;
  setSelectedEntities: (selectedEntities: string[]) => void;
};

const CreateCaseConfirmModal = ({
  selectedEntities,
  caseId,
  setSelectedEntities,
}: ConfirmModalProps) => {
  const createNewCaseMutation = useCreateNewCaseMutation({ setSelectedEntities });

  return (
    <Confirm
      title="Are you sure you want to create a new Case?"
      text="Please note that creating a new case would create a new case for this user with a new Case ID with the selected Alerts."
      res={getMutationAsyncResource(createNewCaseMutation)}
      onConfirm={() => {
        createNewCaseMutation.mutate({
          sourceCaseId: caseId,
          alertIds: selectedEntities,
        });
      }}
    >
      {({ onClick }) => (
        <Button type="TETRIARY" onClick={onClick}>
          Create new case
        </Button>
      )}
    </Confirm>
  );
};

export default function AlertTable(props: Props) {
  const {
    params,
    onChangeParams,
    hideCaseIdFilter = false,
    disableInternalPadding = false,
    hideScopeSelector = false,
    isEmbedded = false,
  } = props;
  const showActions = !hideScopeSelector;

  const api = useApi();
  const user = useAuth0User();
  const isPulseEnabled = useFeatureEnabled('PULSE');
  const [users, _] = useUsers({ includeBlockedUsers: true });

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
      } = params;
      const [sortField, sortOrder] = sort[0] ?? [];

      let filterAssignmentsIds: string[] | undefined = undefined;

      if (showCases === 'MY_ALERTS') {
        filterAssignmentsIds = [user.userId];
      } else if (assignedTo?.length) {
        filterAssignmentsIds = assignedTo;
      }

      const result = await api.getAlertList({
        page,
        pageSize,
        filterAlertId: alertId,
        filterCaseId: caseId,
        filterOutAlertStatus: showActions
          ? alertStatus === 'CLOSED'
            ? undefined
            : 'CLOSED'
          : undefined,
        filterAlertStatus: showActions
          ? alertStatus === 'CLOSED'
            ? 'CLOSED'
            : undefined
          : undefined,
        filterAssignmentsIds,
        filterTransactionState: transactionState ?? undefined,
        filterBusinessIndustries: businessIndustryFilter,
        filterTransactionTagKey: tagKey,
        filterTransactionTagValue: tagValue,
        filterUserId: userId,
        sortField: sortField === 'age' ? 'createdTimestamp' : sortField,
        sortOrder: sortOrder ?? undefined,
      });
      return {
        items: presentAlertData(result.data),
        total: result.total,
      };
    },
  );

  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [items, setItems] = useState<TableRow<TableAlertItem>[]>([]);

  const statusChangeButtonValue = useMemo(() => {
    const selectedStatuses = [
      ...new Set(
        items.map((item) => {
          return item.alertStatus === 'CLOSED' ? 'CLOSED' : 'OPEN';
        }),
      ),
    ];
    if (selectedStatuses.length === 1) {
      return selectedStatuses[0];
    }
    return undefined;
  }, [items]);

  const actionRef = useRef<TableActionType>(null);
  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const handleAssignTo = (account: Account) => {
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

  const columns = useMemo(() => mergedColumns(hideCaseIdFilter, users), [hideCaseIdFilter, users]);

  return (
    <QueryResultsTable<TableAlertItem, AlertTableParams>
      tableId={'my-alerts'}
      rowKey={'alertId'}
      hideFilters={isEmbedded ? true : false}
      actionRef={actionRef}
      columns={columns}
      queryResults={queryResults}
      params={params}
      onChangeParams={onChangeParams}
      extraFilters={extraFilters(isPulseEnabled)}
      actionsHeader={
        showActions && !isEmbedded
          ? [
              ({ params, setParams }) => (
                <ScopeSelector<AlertTableParams> params={params} onChangeParams={setParams} />
              ),
            ]
          : undefined
      }
      actionsHeaderRight={[
        ({ params, setParams }) => (
          <>
            <AssignToButton ids={selectedEntities} onSelect={handleAssignTo} />
            {statusChangeButtonValue && (
              <AlertsStatusChangeButton
                ids={selectedEntities}
                onSaved={reloadTable}
                status={params.alertStatus ?? statusChangeButtonValue}
              />
            )}
            {showActions && !isEmbedded && (
              <StatusButtons
                status={params.alertStatus ?? 'OPEN'}
                onChange={(newStatus) => {
                  setParams((state) => ({
                    ...state,
                    alertStatus: newStatus,
                  }));
                }}
                suffix="alerts"
              />
            )}
            {selectedEntities?.length > 0 && params.caseId && (
              <CreateCaseConfirmModal
                selectedEntities={selectedEntities}
                caseId={params.caseId}
                setSelectedEntities={setSelectedEntities}
              />
            )}
          </>
        ),
      ]}
      rowSelection={{
        selectedKeys: selectedEntities,
        onChange: setSelectedEntities,
        onChangeItems: setItems,
        items,
      }}
      expandable={{
        expandedRowRender: (record) => <ExpandedRowRenderer alertId={record.alertId ?? null} />,
      }}
      scroll={{ x: 1300 }}
      disableInternalPadding={disableInternalPadding}
    />
  );
}

function presentAlertData(data: AlertListResponseItem[]) {
  return data.map(({ alert, ...rest }) => {
    const caseUser = rest.caseUsers ?? {};
    const user = caseUser.origin ?? caseUser.destination ?? undefined;
    const duration = dayjs.duration(Date.now() - alert.createdTimestamp);
    return {
      ...alert,
      caseCreatedTimestamp: rest.caseCreatedTimestamp,
      caseUserName: getUserName(user),
      age: pluralize('day', Math.floor(duration.asDays()), true),
    };
  });
}
