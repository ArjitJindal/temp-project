import React, { useCallback, useMemo, useRef } from 'react';
import { Tag } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams, TableData, TableRefType } from '@/components/library/Table/types';
import { QueryResult } from '@/utils/queries/types';
import { TableAlertItem } from '@/pages/case-management/AlertTable/types';
import { TableSearchParams } from '@/pages/case-management/types';
import { useCaseAlertFilters } from '@/pages/case-management/helpers';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import {
  ALERT_ID,
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
import { AssignmentButton } from '@/pages/case-management/components/AssignmentButton';
import { CLOSING_REASONS } from '@/components/Narrative';
import { statusEscalated, statusInReview } from '@/utils/case-utils';
import { useQaMode } from '@/utils/qa-mode';
import Button from '@/components/library/Button';
import { getAlertUrl } from '@/utils/routing';

interface Props {
  params: AllParams<TableSearchParams>;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
}

export default function QaTable(props: Props) {
  const { params, onChangeParams } = props;
  const queryResults: QueryResult<TableData<TableAlertItem>> = useAlertQuery(params);
  const user = useAuth0User();
  const [qaMode] = useQaMode();
  const tableRef = useRef<TableRefType>(null);
  const qaAssigneesUpdateMutation = useAlertQaAssignmentUpdateMutation(tableRef);

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
      type: ALERT_ID,
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
    }),
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
            {entity.lastStatusChange?.reason?.map((reason) => (
              <Tag>{reason}</Tag>
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
            enableResizing: false,
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
                <Link to={getAlertUrl(caseId, alertId)}>
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
    'assignedTo',
    'ruleQueueIds',
  ]);
  const extraFilters = useMemo(() => {
    const closingReasonOptions = [...CLOSING_REASONS, 'Other'].map((reason) => {
      return {
        value: reason,
        label: reason,
      };
    });
    return filters.concat([
      {
        key: 'qaAssignment',
        title: 'QA assigned to',
        showFilterByDefault: true,
        renderer: ({ params, setParams }) => (
          <AssignmentButton
            users={params.qaAssignment ?? []}
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
          options: closingReasonOptions,
        },
      },
    ]);
  }, [filters]);
  const handleChangeParams = useCallback(
    (params: AllParams<TableSearchParams>) => {
      onChangeParams(params);
    },
    [onChangeParams],
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
