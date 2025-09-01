import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import pluralize from 'pluralize';
import { UserOutlined } from '@ant-design/icons';
import { useAlertsSamplingCreateMutation, useAlertsSamplingUpdateMutation } from '../utils';
import { QAModal } from '../Modal';
import { AddToSampleModal } from '../AddToSampleModal';
import { QAFormValues } from '../types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { AllParams, TableData, TableRefType } from '@/components/library/Table/types';
import { QueryResult } from '@/utils/queries/types';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { TableSearchParams } from '@/pages/case-management/types';
import { useCaseAlertFilters } from '@/pages/case-management/helpers';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import {
  ASSIGNMENTS,
  DATE,
  PRIORITY,
  RULE_NATURE,
} from '@/components/library/Table/standardDataTypes';
import { useAlertQuery } from '@/pages/case-management/common';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import { message } from '@/components/library/Message';
import { useAuth0User } from '@/utils/user-utils';
import { useApi } from '@/api';
import { DefaultApiPatchAlertsQaAssignmentsRequest } from '@/apis/types/ObjectParamAPI';
import { AccountsFilter } from '@/components/library/AccountsFilter';
import { statusEscalated, statusInReview } from '@/utils/case-utils';
import { useQaMode } from '@/utils/qa-mode';
import Button from '@/components/library/Button';
import { getAlertUrl } from '@/utils/routing';
import Tag from '@/components/library/Tag';
import { addBackUrlToRoute } from '@/utils/backUrl';
import Id from '@/components/ui/Id';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import CalendarLineIcon from '@/components/ui/icons/Remix/business/calendar-line.react.svg';
import { useReasons } from '@/utils/reasons';

interface Props {
  params: AllParams<TableSearchParams>;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
  isSelectionEnabled: boolean;
  manuallyAddedAlerts?: string[];
}

export default function QaTable(props: Props) {
  const { params, onChangeParams, isSelectionEnabled, manuallyAddedAlerts } = props;
  const queryResults: QueryResult<TableData<TableAlertItem>> = useAlertQuery(params);
  const user = useAuth0User();
  const [qaMode] = useQaMode();
  const tableRef = useRef<TableRefType>(null);
  const qaAssigneesUpdateMutation = useAlertQaAssignmentUpdateMutation(tableRef);
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
  const alertDetailsPageEnabled = useFeatureEnabled('ALERT_DETAILS_PAGE');
  const closingResons = useReasons('CLOSURE');

  const helper = new ColumnHelper<TableAlertItem>();
  const columns = helper.list([
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
    helper.simple<'alertId'>({
      title: 'Alert ID',
      key: 'alertId',
      icon: <StackLineIcon />,
      showFilterByDefault: true,
      filtering: true,
      type: {
        render: (alertId, { item: entity }) => {
          return (
            <>
              {entity?.caseId && alertId && (
                <Id
                  to={addBackUrlToRoute(
                    getAlertUrl(entity.caseId, alertId, alertDetailsPageEnabled),
                  )}
                  testName="alert-id"
                >
                  {alertId}
                </Id>
              )}
              {alertId && manuallyAddedAlerts?.includes(alertId) && (
                <Tag color="gray">Manually added</Tag>
              )}
            </>
          );
        },
        stringify(value, item) {
          return `${item?.caseId ?? ''}`;
        },
        link(value, item) {
          return item?.caseId && value
            ? getAlertUrl(item.caseId, value, alertDetailsPageEnabled)
            : '';
        },
      },
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
    helper.simple<'ruleQaStatus'>({
      title: 'QA status',
      key: 'ruleQaStatus',
      type: {
        render: (status) => {
          if (status === 'PASSED') {
            return <>QA pass</>;
          }
          if (status === 'FAILED') {
            return <>QA fail</>;
          }
          return <>Not QA'd</>;
        },
      },
    }),
    helper.simple<'ruleName'>({
      title: 'Rule name',
      key: 'ruleName',
    }),
    helper.simple<'ruleDescription'>({
      title: 'Rule description',
      key: 'ruleDescription',
    }),
    helper.simple<'ruleNature'>({
      title: 'Rule nature',
      key: 'ruleNature',
      type: RULE_NATURE,
      filtering: true,
    }),
    ...(params.showCases === 'QA_PASSED_ALERTS' || params.showCases === 'QA_FAILED_ALERTS'
      ? [
          helper.derived<string>({
            title: 'QA reason',
            value: (entity) => {
              return entity.comments?.find((c) => c.body.startsWith('Alert QA status set to'))
                ?.otherReason;
            },
          }),
          helper.derived<string>({
            title: 'QA comment',
            value: (entity) => {
              return entity.comments?.find((c) => c.body.startsWith('Alert QA status set to'))
                ?.body;
            },
          }),
        ]
      : []),
    helper.simple<'updatedAt'>({
      title: 'Alert closed at',
      key: 'updatedAt',
      type: DATE,
      sorting: true,
      filtering: true,
    }),
    helper.display({
      title: 'Alert closing reason',
      enableResizing: false,
      defaultWidth: 200,
      render: (entity) => {
        return (
          <>
            {entity.lastStatusChange?.reason?.map((reason, index) => (
              <Tag key={index}>{reason}</Tag>
            ))}
          </>
        );
      },
    }),

    ...(qaMode
      ? [
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
              render: (assignments, __) => {
                return <AssigneesDropdown assignments={assignments || []} editing={false} />;
              },
            },
          }),
        ]
      : []),
    helper.simple<'assignments'>({
      title: 'QA assignees',
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
    ...(qaMode
      ? [
          helper.display({
            title: 'Action',
            render: (entity) => {
              const caseId = entity.caseId;
              const alertId = entity.alertId;
              if (!caseId || !alertId) {
                return null;
              }
              return (
                <Link to={getAlertUrl(caseId, alertId, alertDetailsPageEnabled)}>
                  <>
                    <Button type="PRIMARY">View</Button>
                  </>
                </Link>
              );
            },
          }),
        ]
      : []),
  ]);

  const filters = useCaseAlertFilters([
    'alertPriority',
    'caseTypesFilter',
    'rulesHitFilter',
    'userId',
    'userName',
    'assignedTo',
    'ruleQueueIds',
  ]);
  const extraFilters = useMemo(() => {
    return filters.concat([
      {
        key: 'qaAssignment',
        title: 'QA assigned to',
        showFilterByDefault: true,
        renderer: ({ params, setParams }) => (
          <AccountsFilter
            includeUnassigned={true}
            Icon={<UserOutlined />}
            users={params.qaAssignment ?? []}
            title="QA assigned to"
            onConfirm={(value) => {
              setParams((state) => ({
                ...state,
                qaAssignment: value ?? undefined,
              }));
            }}
          />
        ),
      },
      {
        title: 'Alert closing reason',
        key: 'filterClosingReason',
        showFilterByDefault: true,
        renderer: {
          kind: 'select',
          mode: 'MULTIPLE',
          displayMode: 'select',
          options: closingResons.map((r) => ({
            label: r,
            value: r,
          })),
        },
      },
    ]);
  }, [filters, closingResons]);

  const handleChangeParams = useCallback(
    (params: AllParams<TableSearchParams>) => {
      onChangeParams(params);
    },
    [onChangeParams],
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const mutation = useAlertsSamplingCreateMutation(setIsModalOpen);

  const onSubmit = useCallback(
    (values: QAFormValues) => {
      mutation.mutate({
        ...values,
        samplingData: {
          samplingType: 'MANUAL',
          alertIds: selectedAlerts,
        },
      });
    },
    [mutation, selectedAlerts],
  );

  const [isAddToSampleModalOpen, setIsAddToSampleModalOpen] = useState(false);

  const editMutation = useAlertsSamplingUpdateMutation(
    setIsAddToSampleModalOpen,
    {
      success: `${selectedAlerts.length} ${pluralize(
        'alert',
        selectedAlerts.length,
      )} added to sample`,
      error: 'Failed to add alerts to sample',
    },
    queryResults,
  );

  return (
    <>
      <QueryResultsTable<TableAlertItem, AllParams<TableSearchParams>>
        innerRef={tableRef}
        tableId={'qa-alert-list'}
        rowKey={'alertId'}
        fitHeight={true}
        hideFilters={false}
        columns={columns}
        queryResults={queryResults}
        params={params}
        onChangeParams={handleChangeParams}
        extraFilters={extraFilters}
        pagination={true}
        selection={isSelectionEnabled}
        onSelect={(selectedRowKeys) => {
          setSelectedAlerts(selectedRowKeys);
        }}
        selectedIds={selectedAlerts}
        selectionActions={
          isSelectionEnabled
            ? [
                () => (
                  <Button
                    type="TETRIARY"
                    onClick={() => setIsModalOpen(true)}
                    testName="create-sample-button"
                  >
                    Create sample
                  </Button>
                ),
                () => (
                  <Button
                    type="TETRIARY"
                    onClick={() => setIsAddToSampleModalOpen(true)}
                    testName="add-to-sample-button"
                  >
                    Add to sample
                  </Button>
                ),
              ]
            : []
        }
        selectionInfo={{
          entityCount: selectedAlerts.length,
          entityName: 'alert',
        }}
      />
      <QAModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        type="CREATE"
        onSubmit={onSubmit}
        sampleType="MANUAL"
      />
      <AddToSampleModal
        isModalOpen={isAddToSampleModalOpen}
        setIsModalOpen={setIsAddToSampleModalOpen}
        onAddToSample={(sampleId) => {
          editMutation.mutate({
            sampleId,
            body: { alertIds: selectedAlerts },
          });
        }}
      />
    </>
  );
}
const reloadTable = (ref: React.RefObject<TableRefType>) => {
  if (ref.current) {
    ref.current.reload();
  }
};
export const useAlertQaAssignmentUpdateMutation = (ref: React.RefObject<TableRefType>) => {
  const api = useApi();

  return useMutation<unknown, Error, DefaultApiPatchAlertsQaAssignmentsRequest>(
    async ({ alertId, AlertQaAssignmentsUpdateRequest: { assignments } }) =>
      await api.patchAlertsQaAssignments({
        alertId,
        AlertQaAssignmentsUpdateRequest: {
          assignments,
        },
      }),
    {
      onSuccess: () => {
        reloadTable(ref);
        message.success('Assignees updated successfully');
      },
      onError: () => {
        message.fatal('Failed to update assignees');
      },
    },
  );
};
