import React, { useCallback, useRef, useState } from 'react';
import pluralize from 'pluralize';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { Account, AlertListResponseItem } from '@/apis';
import { ALERT_LIST } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { TableColumn, TableData } from '@/components/ui/Table/types';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import { QueryResult } from '@/utils/queries/types';
import { AllParams, TableActionType } from '@/components/ui/Table';
import ScopeSelector from '@/pages/case-management/components/ScopeSelector';
import CaseStatusButtons from '@/pages/transactions/components/CaseStatusButtons';
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
import { useAuth0User } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { TableSearchParams } from '@/pages/case-management/types';
import { extraFilters } from '@/pages/case-management/helpers';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

type AlertTableParams = AllParams<TableSearchParams>;

interface Props {
  params: TableSearchParams;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
}

const mergedColumns: TableColumn<TableAlertItem>[] = [
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
      return <Id id={entity.alertId}>{entity.alertId}</Id>;
    },
  },
  // { title: 'Alert risk', dataIndex: '' },
  {
    title: 'Priority',
    dataIndex: 'priority',
    exportData: 'priority',
    width: 100,
    valueType: 'text',
    hideInSearch: true,
  },
  {
    title: 'Alert age',
    dataIndex: 'age',
    exportData: 'age',
    hideInSearch: true,
    width: 100,
  },
  {
    title: '#TX',
    dataIndex: 'numberOfTransactionsHit',
    exportData: 'numberOfTransactionsHit',
    width: 100,
    valueType: 'text',
    hideInSearch: true,
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
    hideInSearch: true,
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
];
export default function AlertTable(props: Props) {
  const { params, onChangeParams } = props;
  const api = useApi();
  const user = useAuth0User();
  const isPulseEnabled = useFeatureEnabled('PULSE');

  const queryResults: QueryResult<TableData<TableAlertItem>> = usePaginatedQuery(
    ALERT_LIST(params),
    async () => {
      const {
        page,
        pageSize,
        alertId,
        caseStatus,
        userId,
        transactionState,
        businessIndustryFilter,
        tagKey,
        tagValue,
        showCases,
      } = params;
      const result = await api.getAlertList({
        page,
        pageSize,
        filterAlertId: alertId,
        filterOutCaseStatus: caseStatus === 'CLOSED' ? undefined : 'CLOSED',
        filterCaseStatus: caseStatus === 'CLOSED' ? 'CLOSED' : undefined,
        filterAssignmentsIds: showCases === 'MY_ALERTS' ? [user.userId] : undefined,
        filterTransactionState: transactionState ?? undefined,
        filterBusinessIndustries: businessIndustryFilter,
        filterTransactionTagKey: tagKey,
        filterTransactionTagValue: tagValue,
        filterUserId: userId,
      });
      return {
        items: presentAlertData(result.data),
        total: result.total,
      };
    },
  );

  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

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

  return (
    <QueryResultsTable<TableAlertItem, AlertTableParams>
      tableId={'my-alerts'}
      rowKey={'alertId'}
      actionRef={actionRef}
      columns={mergedColumns}
      queryResults={queryResults}
      params={params}
      onChangeParams={onChangeParams}
      extraFilters={extraFilters(isPulseEnabled)}
      actionsHeader={[
        ({ params, setParams }) => (
          <ScopeSelector<AlertTableParams> params={params} onChangeParams={setParams} />
        ),
      ]}
      actionsHeaderRight={[
        ({ params, setParams }) => (
          <>
            <AssignToButton ids={selectedEntities} onSelect={handleAssignTo} />
            <AlertsStatusChangeButton
              ids={selectedEntities}
              onSaved={reloadTable}
              caseStatus={params.caseStatus}
            />
            <CaseStatusButtons
              status={params.caseStatus ?? 'OPEN'}
              onChange={(newStatus) => {
                setParams((state) => ({
                  ...state,
                  caseStatus: newStatus,
                }));
              }}
            />
          </>
        ),
      ]}
      rowSelection={{
        selectedKeys: selectedEntities,
        onChange: setSelectedEntities,
      }}
      expandable={{
        expandedRowRender: (record) => <ExpandedRowRenderer alert={record} />,
      }}
    />
  );
}

export const SimpleAlertTable = ({ caseId }: { caseId: string }) => {
  const actionRef = useRef<TableActionType>(null);
  const api = useApi();

  const queryResults: QueryResult<TableData<TableAlertItem>> = usePaginatedQuery(
    ALERT_LIST({ caseId }),
    async () => {
      const result = await api.getAlertList({
        page: 0,
        pageSize: 100,
        filterId: caseId,
      });
      return {
        items: presentAlertData(result.data).map((a) => ({ ...a, caseId })),
        total: result.total,
      };
    },
  );
  return (
    <QueryResultsTable<TableAlertItem, { page: number; pageSize: number; caseId: string }>
      tableId={'my-alerts'}
      pagination={false}
      rowKey={'alertId'}
      actionRef={actionRef}
      columns={mergedColumns}
      queryResults={queryResults}
      params={{ caseId, page: 0, pageSize: 100, sort: [['caseCreatedTimestamp', 'descend']] }}
    />
  );
};

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
