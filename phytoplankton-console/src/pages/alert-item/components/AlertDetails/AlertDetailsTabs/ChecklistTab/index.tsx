import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import * as Card from '@/components/ui/Card';
import { Alert, ChecklistDoneStatus, ChecklistStatus } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { ChecklistItem, HydratedChecklist, useAlertChecklist } from '@/utils/checklist-templates';
import SegmentedControl from '@/components/library/SegmentedControl';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { TableRefType } from '@/components/library/Table/types';
import { useQaMode } from '@/utils/qa-mode';
import Dropdown from '@/components/library/Dropdown';
import { CHECKLIST_STATUSS } from '@/apis/models-custom/ChecklistStatus';
import { statusInReview } from '@/utils/case-utils';
import { ALERT_CHECKLIST } from '@/utils/queries/keys';

interface Props {
  alert: Alert;
}

export default function ChecklistTab(props: Props) {
  const { alert } = props;
  const checklistQueryResult = useAlertChecklist(alert.alertId);
  const [category, setCategory] = useState<string | undefined>();
  const [qaModeSet] = useQaMode();
  const api = useApi();

  const actionRef = useRef<TableRefType>(null);
  const queryClient = useQueryClient();

  const updateQueryData = useCallback(
    (alertId: string, checklistItemIds: string[], data: Partial<ChecklistItem>) => {
      queryClient.setQueryData<HydratedChecklist>(ALERT_CHECKLIST(alertId), (checklist) => {
        if (!checklist) {
          return undefined;
        }

        return checklist.map((c) => {
          return {
            ...c,
            items: c.items.map((i) => {
              if (i.id != null && checklistItemIds.includes(i.id)) {
                return {
                  ...i,
                  ...data,
                };
              }
              return i;
            }),
          };
        });
      });
    },
    [queryClient],
  );

  const onQaStatusChange = useMutation(
    async ({
      status,
      checklistItemIds,
    }: {
      status: ChecklistStatus;
      checklistItemIds: string[];
    }) => {
      if (alert.alertId == null) {
        throw new Error(`Unable to update status, alertId is null`);
      }
      await api.patchAlertsQaStatus({
        alertId: alert.alertId,
        AlertChecklistQaUpdateRequest: {
          status,
          checklistItemIds,
        },
      });
    },
    {
      onSuccess: (_, { status, checklistItemIds }) => {
        if (alert.alertId == null) {
          throw new Error(`Unable to update status, alertId is null`);
        }
        message.success(`Checklist items marked as ${status}`);
        updateQueryData(alert.alertId, checklistItemIds, { qaStatus: status });
      },
      onError: (err: Error) => {
        message.error(`Failed to update checklist items QA status. ${err}`);
      },
    },
  );

  const onChecklistStatusChange = useMutation(
    async ({
      done,
      checklistItemIds,
    }: {
      done: ChecklistDoneStatus;
      checklistItemIds: string[];
    }) => {
      if (alert.alertId == null) {
        throw new Error(`Unable to update status, alertId is null`);
      }
      await api.patchAlertsChecklistStatus({
        alertId: alert.alertId,
        AlertChecklistUpdateRequest: {
          done,
          checklistItemIds,
        },
      });
    },
    {
      onSuccess: (_, { done, checklistItemIds }) => {
        if (alert.alertId == null) {
          throw new Error(`Unable to update status, alertId is null`);
        }
        message.success(`Checklist items marked as ${done ? 'done' : 'not done'}`);
        updateQueryData(alert.alertId, checklistItemIds, { done });
      },
      onError: (err: Error) => {
        message.error(`Failed to mark checklist items. ${err}`);
      },
    },
  );

  const isStatusEditable: boolean = useMemo(() => {
    return (
      (alert.alertStatus &&
        !statusInReview(alert.alertStatus) &&
        alert.alertStatus !== 'CLOSED' &&
        qaModeSet === false) ||
      false
    );
  }, [alert.alertStatus, qaModeSet]);

  const columns = useMemo(() => {
    const helper = new ColumnHelper<ChecklistItem>();
    const columns = helper.list([
      helper.simple({
        key: 'name',
        title: 'Checklist item',
        defaultWidth: 800,
      }),
      helper.simple({
        key: 'level',
        title: 'Type',
      }),
      helper.display({
        id: 'actions',
        title: 'Checklist status',
        defaultWidth: 200,
        render(item) {
          return isStatusEditable ? (
            <Dropdown<ChecklistDoneStatus>
              options={(['DONE', 'NOT_DONE'] as const).map((s) => ({
                label: humanizeConstant(s),
                value: s,
              }))}
              arrow={'LINE'}
              bordered
              onSelect={(e) => {
                if (item.id) {
                  onChecklistStatusChange.mutate({
                    checklistItemIds: [item.id],
                    done: e.value as ChecklistDoneStatus,
                  });
                }
              }}
              minWidth={150}
              writePermissions={['case-management:case-overview:write']}
            >
              <div>
                {humanizeConstant(item.done === 'NOT_STARTED' ? 'SELECT_STATUS' : item.done)}
              </div>
            </Dropdown>
          ) : (
            <>{item.done === 'NOT_STARTED' ? '-' : humanizeConstant(item.done)}</>
          );
        },
      }),
    ]);

    if (qaModeSet) {
      columns.push(
        helper.display({
          title: 'QA status',
          id: 'qaStatus',
          defaultWidth: 220,
          render: (status) => {
            let label = !alert.ruleQaStatus ? 'Select status' : '-';
            switch (status?.qaStatus) {
              case 'PASSED':
                label = 'Pass';
                break;
              case 'FAILED':
                label = 'Fail';
                break;
              default:
            }
            return !alert.ruleQaStatus ? (
              <Dropdown<ChecklistStatus>
                options={CHECKLIST_STATUSS.map((s) => ({
                  label: s === 'PASSED' ? 'Pass' : s === 'FAILED' ? 'Fail' : 'Select status',
                  value: s,
                }))}
                arrow={'LINE'}
                bordered
                onSelect={(e) => {
                  if (status.id) {
                    onQaStatusChange.mutate({
                      checklistItemIds: [status.id],
                      status: e.value,
                    });
                  }
                }}
                minWidth={200}
                writePermissions={['case-management:qa:write']}
              >
                <div>{label}</div>
              </Dropdown>
            ) : (
              <>{label}</>
            );
          },
        }),
      );
    }
    return columns;
  }, [qaModeSet, alert.ruleQaStatus, onQaStatusChange, onChecklistStatusChange, isStatusEditable]);

  return (
    <AsyncResourceRenderer<HydratedChecklist> resource={checklistQueryResult.data}>
      {(checklistRes) => (
        <Card.Root>
          <Card.Section>
            <SegmentedControl
              size="LARGE"
              active={category ?? checklistRes[0].name}
              onChange={(category) => {
                setCategory(category);
              }}
              items={checklistRes.map((c) => ({ label: c.name, value: c.name }))}
            />
            <Table<ChecklistItem>
              data={{
                items:
                  checklistRes.find((cl) => (category ? cl.name === category : true))?.items || [],
              }}
              externalHeader={true}
              columns={columns}
              rowKey={'id'}
              toolsOptions={false}
              innerRef={actionRef}
            />
          </Card.Section>
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
}
