import { useMutation } from '@tanstack/react-query';
import { humanizeAuto, humanizeConstant } from '@flagright/lib/utils/humanize';
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
import * as Card from '@/components/ui/Card';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { statusInReview } from '@/utils/case-utils';
import { useAlertChecklist, useAlertUpdates } from '@/utils/api/alerts';
import { useQaMode } from '@/utils/qa-mode';
import { ChecklistItem, HydratedChecklist } from '@/utils/api/alerts/types';
interface Props {
  alert: Alert;
}

export default function ChecklistTab(props: Props) {
  const { alert } = props;
  const checklistQueryResult = useAlertChecklist(alert.alertId);
  const [category, setCategory] = useState<string | undefined>();
  const [qaModeSet] = useQaMode();
  const api = useApi();
  const { updateAlertChecklistData } = useAlertUpdates();

  const actionRef = useRef<TableRefType>(null);

  const updateQueryData = useCallback(
    (alertId: string, checklistItemIds: string[], data: Partial<ChecklistItem>) => {
      updateAlertChecklistData(alertId, (checklist) => {
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
    [updateAlertChecklistData],
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
    const canEdit = (_item?: ChecklistItem) => isStatusEditable || qaModeSet;

    const DONE_TYPE: ColumnDataType<ChecklistDoneStatus, ChecklistItem> = {
      render: (value) => <>{value === 'NOT_STARTED' ? '-' : humanizeConstant(value ?? '')}</>,
      renderEdit: (context) => {
        const [state] = context.edit.state;
        const item = context.item;
        return (
          <Dropdown<ChecklistDoneStatus>
            options={(['DONE', 'NOT_DONE', 'NOT_APPLICABLE'] as const).map((s) => ({
              label: humanizeConstant(s),
              value: s,
            }))}
            arrow={'LINE'}
            bordered
            disabled={context.edit.isBusy || !canEdit(item)}
            selectedKeys={[state ?? '']}
            onSelect={(e) => {
              // Persist immediately (no actions column)
              if (item && item.id) {
                checklistItemChangeMutation.mutate({
                  item,
                  changes: { done: e.value },
                });
              }
              context.edit.onConfirm(e.value);
            }}
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
        const item = context.item;
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
            disabled={context.edit.isBusy || !canEdit(item)}
            onSelect={(e) => {
              if (item && item.id) {
                onQaStatusChange.mutate({
                  status: e.value,
                  checklistItemIds: [item.id],
                });
              }
              context.edit.onConfirm(e.value);
            }}
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
        const item = context.item;
        return (
          <EditableComment
            value={state}
            onChange={(value) => context.edit.onConfirm(value)}
            onBlur={() => {
              if (item && item.id && canEdit(item)) {
                checklistItemChangeMutation.mutate({
                  item,
                  changes: { comment: state },
                });
              }
            }}
            isDisabled={context.edit.isBusy || !canEdit(item)}
          />
        );
      },
    };
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
        defaultEditState: isStatusEditable,
        type: DONE_TYPE,
      }),
    ]);

    if (qaModeSet) {
      columns.push(
        helper.simple<'qaStatus'>({
          title: 'QA status',
          key: 'qaStatus',
          defaultWidth: 220,
          defaultEditState: true,
          type: QA_STATUS_TYPE as any,
        }),
      );
      columns.push(
        helper.simple<'comment'>({
          key: 'comment',
          title: 'Comment',
          defaultEditState: true,
          type: COMMENT_TYPE as any,
        }),
      );
    }

    return columns;
  }, [qaModeSet, isStatusEditable, checklistItemChangeMutation, onQaStatusChange]);

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
