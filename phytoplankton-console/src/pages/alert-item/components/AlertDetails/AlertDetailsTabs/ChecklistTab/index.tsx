import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import EditableComment from './EditableComment';
import { useApi } from '@/api';
import { Alert, ChecklistDoneStatus, ChecklistStatus } from '@/apis';
import { CHECKLIST_STATUSS } from '@/apis/models-custom/ChecklistStatus';
import Dropdown from '@/components/library/Dropdown';
import { message } from '@/components/library/Message';
import SegmentedControl from '@/components/library/SegmentedControl';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { TableRefType } from '@/components/library/Table/types';
import * as Card from '@/components/ui/Card';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { statusInReview } from '@/utils/case-utils';
import { ChecklistItem, HydratedChecklist, useAlertChecklist } from '@/hooks/api';
import { useQaMode } from '@/utils/qa-mode';
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
        message.success(`Checklist items marked as ${status} successfully`);
        updateQueryData(alert.alertId, checklistItemIds, { qaStatus: status });
      },
      onError: (err: Error) => {
        message.error(`Failed to update checklist items QA status. ${err}`);
      },
    },
  );

  const checklistItemChangeMutation = useMutation(
    async (variables: {
      item: ChecklistItem;
      changes: {
        done?: ChecklistDoneStatus;
        comment?: string;
      };
    }) => {
      const { item, changes } = variables;
      const { done, comment } = changes;
      if (alert.alertId == null) {
        throw new Error(`Unable to update status, alertId is null`);
      }
      if (item.id == null) {
        throw new Error(`Unable to update status, itemId is null`);
      }
      await api.patchAlertsChecklistStatus({
        alertId: alert.alertId,
        AlertChecklistUpdateRequest: {
          done: done ?? item.done,
          checklistItemIds: [item.id],
          comment: comment ?? item.comment,
        },
      });
    },
    {
      onSuccess: (_, { item, changes }) => {
        if (changes.done != null && changes.done != item.done) {
          message.success(
            `Checklist item marked as ${changes.done ? 'done' : 'not done'} successfully`,
          );
        } else if (changes.comment != null && changes.comment != item.comment) {
          message.success('Checklist item comment updated successfully');
        }
        if (alert.alertId != null && item.id != null) {
          updateQueryData(alert.alertId, [item.id], {
            done: changes.done ?? item.done,
            comment: changes.comment ?? item.comment,
          });
        }
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
        defaultWidth: 600,
      }),
      helper.simple({
        key: 'level',
        title: 'Type',
      }),
      helper.display({
        id: 'actions',
        title: 'Checklist status',
        defaultWidth: 200,
        defaultEditState: isStatusEditable,
        render(item, context) {
          const { edit } = context;
          if (edit.isEditing) {
            const [state, setState] = edit.state;
            return (
              <Dropdown<ChecklistDoneStatus>
                disabled={edit.isBusy}
                options={(['DONE', 'NOT_DONE', 'NOT_APPLICABLE'] as const).map((s) => ({
                  label: humanizeConstant(s),
                  value: s,
                }))}
                arrow={'LINE'}
                bordered
                selectedKeys={[state.done]}
                onSelect={(e) => {
                  // Using last item state instead of eit state to sync state between multiple cells
                  const newState = {
                    ...item,
                    done: e.value as ChecklistDoneStatus,
                  };
                  setState(newState);
                  edit.onConfirm(newState);
                }}
                minWidth={150}
                writeResources={['write:::case-management/case-overview/*']}
              >
                <div>
                  {humanizeConstant(state.done === 'NOT_STARTED' ? 'SELECT_STATUS' : state.done)}
                </div>
              </Dropdown>
            );
          }
          return <>{item.done === 'NOT_STARTED' ? '-' : humanizeConstant(item.done)}</>;
        },
      }),
    ]);

    if (qaModeSet) {
      columns.push(
        helper.display({
          title: 'QA status',
          id: 'qaStatus',
          defaultWidth: 220,
          defaultEditState: !alert.ruleQaStatus,
          render: (item, context) => {
            const { edit } = context;
            let label = !alert.ruleQaStatus ? 'Select status' : '-';
            switch (item?.qaStatus) {
              case 'PASSED':
                label = 'Pass';
                break;
              case 'FAILED':
                label = 'Fail';
                break;
              case 'NOT_APPLICABLE':
                label = 'Not applicable';
                break;
              default:
            }
            if (edit.isEditing) {
              const [state, setState] = edit.state;
              return (
                <Dropdown<ChecklistStatus>
                  options={CHECKLIST_STATUSS.map((s) => ({
                    label:
                      s === 'NOT_APPLICABLE'
                        ? 'Not applicable'
                        : s === 'PASSED'
                        ? 'Pass'
                        : s === 'FAILED'
                        ? 'Fail'
                        : 'Select status',
                    value: s,
                  }))}
                  arrow={'LINE'}
                  bordered
                  onSelect={(e) => {
                    // Using last item state instead of eit state to sync state between multiple cells
                    const newState = {
                      ...item,
                      qaStatus: e.value,
                    };
                    setState(newState);
                    edit.onConfirm(newState);
                  }}
                  minWidth={200}
                  selectedKeys={state?.qaStatus ? [state?.qaStatus] : undefined}
                  writeResources={['write:::case-management/qa/*']}
                >
                  <div>{label}</div>
                </Dropdown>
              );
            }
            return <>{label}</>;
          },
        }),
      );
      // columns.push(
      //   helper.simple({
      //     key: 'comment',
      //     title: 'Comment',
      //     type: LONG_TEXT,
      //     // defaultEditState: true,
      //   }),
      // );
      columns.push(
        helper.display({
          id: 'comment',
          title: 'Comment',
          defaultEditState: true,
          render(item, context) {
            const { edit } = context;
            const [state, setState] = edit.state;
            if (edit.isEditing) {
              return (
                <EditableComment
                  value={state.comment}
                  onChange={(value) => {
                    setState({ ...item, comment: value });
                  }}
                  onBlur={() => {
                    edit.onConfirm();
                  }}
                />
              );
            }
            return <div>{item.comment}</div>;
          },
        }),
      );
    }

    return columns;
  }, [qaModeSet, alert.ruleQaStatus, isStatusEditable]);

  return (
    <AsyncResourceRenderer<HydratedChecklist> resource={checklistQueryResult.data}>
      {(checklistRes) => {
        const items =
          checklistRes.find((cl) => (category ? cl.name === category : true))?.items || [];
        return (
          <Card.Root>
            <Card.Section>
              <SegmentedControl
                size="LARGE"
                active={category ?? checklistRes[0]?.name}
                onChange={(category) => {
                  setCategory(category);
                }}
                items={checklistRes.map((c) => ({ label: c.name, value: c.name }))}
              />
              <Table<ChecklistItem>
                tableId="checklist-table"
                data={{
                  items,
                }}
                externalHeader={true}
                columns={columns}
                rowKey={'id'}
                toolsOptions={false}
                innerRef={actionRef}
                rowHeightMode="AUTO"
                onEdit={async (rowKey, newItem) => {
                  const item = items.find((i) => i.id === rowKey);
                  if (item != null && item.id != null) {
                    if (newItem.comment != item.comment || newItem.done != item.done) {
                      await checklistItemChangeMutation.mutateAsync({
                        item,
                        changes: {
                          comment: newItem.comment,
                          done: newItem.done,
                        },
                      });
                    }
                    if (newItem.qaStatus != null && newItem.qaStatus != item.qaStatus) {
                      await onQaStatusChange.mutateAsync({
                        checklistItemIds: [item.id],
                        status: newItem.qaStatus,
                      });
                    }
                  }
                }}
              />
            </Card.Section>
          </Card.Root>
        );
      }}
    </AsyncResourceRenderer>
  );
}
