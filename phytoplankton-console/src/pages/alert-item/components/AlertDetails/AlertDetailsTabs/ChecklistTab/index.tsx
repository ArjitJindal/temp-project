import { humanizeAuto, humanizeConstant } from '@flagright/lib/utils/humanize';
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
import { TableRefType, ColumnDataType } from '@/components/library/Table/types';
import Button from '@/components/library/Button';
import * as Card from '@/components/ui/Card';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { statusInReview } from '@/utils/case-utils';
import { ChecklistItem, HydratedChecklist, useAlertChecklist } from '@/utils/checklist-templates';
import { useQaMode } from '@/utils/qa-mode';
import { ALERT_CHECKLIST } from '@/utils/queries/keys';

interface Props {
  alert: Alert;
}

const CHECKLIST_STATUS_TYPE: ColumnDataType<ChecklistDoneStatus, ChecklistItem> = {
  render: (value) => <>{value === 'NOT_STARTED' ? '-' : humanizeConstant(value ?? '')}</>,
  renderEdit: (context) => {
    const [state] = context.edit.state;
    return (
      <Dropdown<ChecklistDoneStatus>
        options={(['DONE', 'NOT_DONE', 'NOT_APPLICABLE'] as const).map((s) => ({
          label: humanizeConstant(s),
          value: s,
        }))}
        arrow={'LINE'}
        bordered
        disabled={context.edit.isBusy}
        selectedKeys={[state ?? '']}
        onSelect={(e) => context.edit.onConfirm(e.value)}
        minWidth={150}
        writeResources={['write:::case-management/case-overview/*']}
      >
        <div>{humanizeConstant(state ?? 'SELECT_STATUS')}</div>
      </Dropdown>
    );
  },
};

const QA_STATUS_TYPE: ColumnDataType<ChecklistStatus | undefined, ChecklistItem> = {
  render: (value) => {
    switch (value) {
      case 'PASSED':
        return <>Pass</>;
      case 'FAILED':
        return <>Fail</>;
      case 'NOT_APPLICABLE':
        return <>Not applicable</>;
      default:
        return <>-</>;
    }
  },
  renderEdit: (context) => {
    const [state] = context.edit.state;
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
        disabled={context.edit.isBusy}
        onSelect={(e) => context.edit.onConfirm(e.value)}
        minWidth={200}
        selectedKeys={state ? [state] : undefined}
        writeResources={['write:::case-management/qa/*']}
      >
        <div>
          {state == null
            ? 'Select status'
            : state === 'PASSED'
            ? 'Pass'
            : state === 'FAILED'
            ? 'Fail'
            : state === 'NOT_APPLICABLE'
            ? 'Not applicable'
            : '-'}
        </div>
      </Dropdown>
    );
  },
};

const COMMENT_TYPE: ColumnDataType<string | undefined, ChecklistItem> = {
  render: (value) => <div>{value}</div>,
  renderEdit: (context) => {
    const [state] = context.edit.state;
    return (
      <EditableComment
        value={state}
        onChange={(value) => context.edit.onConfirm(value)}
        onBlur={() => {}}
        isDisabled={context.edit.isBusy}
      />
    );
  },
};

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
          message.success(`Checklist item marked as ${humanizeAuto(changes.done)} successfully`);
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
      helper.simple<'done'>({
        key: 'done',
        title: 'Checklist status',
        defaultWidth: 200,
        type: CHECKLIST_STATUS_TYPE as any,
      }),
    ]);

    if (qaModeSet) {
      columns.push(
        helper.simple<'qaStatus'>({
          title: 'QA status',
          key: 'qaStatus',
          defaultWidth: 220,
          type: QA_STATUS_TYPE as any,
        }),
      );
      columns.push(
        helper.simple<'comment'>({
          key: 'comment',
          title: 'Comment',
          type: COMMENT_TYPE as any,
        }),
      );
      columns.push(
        helper.display({
          title: 'Actions',
          id: 'rowActions',
          defaultWidth: 160,
          render: (item, context) => {
            const rowApi = context.rowApi;
            const canEdit = isStatusEditable || qaModeSet;
            if (rowApi?.isEditing) {
              return (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    size="SMALL"
                    type="PRIMARY"
                    isLoading={Boolean(rowApi?.isBusy)}
                    onClick={() => {
                      rowApi.save?.();
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    size="SMALL"
                    type="SECONDARY"
                    isLoading={Boolean(rowApi?.isBusy)}
                    onClick={() => rowApi.cancelEdit?.()}
                  >
                    Cancel
                  </Button>
                </div>
              );
            }
            return (
              <Button
                size="SMALL"
                type="SECONDARY"
                isLoading={Boolean(rowApi?.isBusy)}
                isDisabled={!canEdit}
                onClick={() => rowApi?.startEdit?.()}
              >
                Edit
              </Button>
            );
          },
        }),
      );
    }

    return columns;
  }, [qaModeSet, isStatusEditable]);

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
                rowEditing={{
                  mode: 'multiple',
                  isEditable: () => isStatusEditable || qaModeSet,
                  onSave: async (rowKey, edited) => {
                    const item = items.find((i) => i.id === rowKey);
                    if (item != null && item.id != null) {
                      const newItem = edited as ChecklistItem;
                      const promises: Promise<any>[] = [];
                      if (newItem.comment !== item.comment || newItem.done !== item.done) {
                        promises.push(
                          checklistItemChangeMutation.mutateAsync({
                            item,
                            changes: { comment: newItem.comment, done: newItem.done },
                          }),
                        );
                      }
                      if (newItem.qaStatus != null && newItem.qaStatus !== item.qaStatus) {
                        promises.push(
                          onQaStatusChange.mutateAsync({
                            checklistItemIds: [item.id],
                            status: newItem.qaStatus,
                          }),
                        );
                      }
                      await Promise.all(promises);
                    }
                  },
                }}
              />
            </Card.Section>
          </Card.Root>
        );
      }}
    </AsyncResourceRenderer>
  );
}
