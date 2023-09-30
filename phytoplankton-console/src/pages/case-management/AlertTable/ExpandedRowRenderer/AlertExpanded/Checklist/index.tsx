import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as Card from '@/components/ui/Card';
import { ChecklistStatus } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { ChecklistItem, HydratedChecklist, useAlertChecklist } from '@/utils/checklist-templates';
import SegmentedControl from '@/components/library/SegmentedControl';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { SimpleColumn, TableRefType } from '@/components/library/Table/types';
import Button from '@/components/library/Button';
import { useQaMode } from '@/utils/qa-mode';

interface Props {
  alertId: string;
}

export default function Checklist(props: Props) {
  const { alertId } = props;
  const checklistQueryResult = useAlertChecklist(alertId);
  const [category, setCategory] = useState<string | undefined>();
  const [checklistItemIds, setChecklistItemIds] = useState<string[]>([]);
  const [qaModeSet] = useQaMode();
  const api = useApi();

  const actionRef = useRef<TableRefType>(null);

  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const onQaStatusChange = useMutation(
    async ({
      status,
      checklistItemIds,
    }: {
      status: ChecklistStatus;
      checklistItemIds: string[];
    }) => {
      await api.patchAlertsQaStatus({
        alertId,
        AlertChecklistQaUpdateRequest: {
          status,
          checklistItemIds,
        },
      });
    },
    {
      onSuccess: (_, { status }) => {
        checklistQueryResult.refetch();
        message.success(`Checklist items marked as ${status}`);
        reloadTable();
      },
      onError: (err: Error) => {
        message.error(`Failed to update checklist items QA status. ${err}`);
      },
    },
  );
  const onChecklistStatusChange = useMutation(
    async ({ done, checklistItemIds }: { done: boolean; checklistItemIds: string[] }) => {
      await api.patchAlertsChecklistStatus({
        alertId,
        AlertChecklistUpdateRequest: {
          done,
          checklistItemIds,
        },
      });
      checklistQueryResult.refetch();
    },
    {
      onSuccess: (_, { done }) => {
        checklistQueryResult.refetch();
        message.success(`Checklist items marked as ${done ? 'done' : 'not done'}`);
      },
      onError: (err: Error) => {
        message.error(`Failed to mark checklist items. ${err}`);
      },
    },
  );

  const columns = useMemo(() => {
    const helper = new ColumnHelper<ChecklistItem>();
    const columns: SimpleColumn<any, any>[] = [
      helper.simple({
        key: 'name',
        title: 'Checklist item',
        defaultWidth: 800,
      }),
      helper.simple({
        key: 'level',
        title: 'Type',
      }),
      helper.simple({
        key: 'done',
        title: 'Status',
        type: {
          render: (done) => {
            return <>{done ? 'Done' : 'Not done'}</>;
          },
        },
      }),
    ];

    if (qaModeSet) {
      columns.push(
        helper.simple({
          key: 'qaStatus',
          title: 'QA Status',
          defaultWidth: 160,
          tooltip:
            "To pass 'QA', an analyst must have no more than two 'P2' errors. P1 errors should be qualified as 'Fail'.",
          type: {
            render: (status) => {
              let label = '-';
              switch (status) {
                case 'PASSED':
                  label = 'QA passed';
                  break;
                case 'FAILED':
                  label = 'QA failed';
                  break;
              }
              return <>{label}</>;
            },
          },
        }),
      );
    }
    return columns;
  }, [qaModeSet]);

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
              selectedIds={checklistItemIds}
              onSelect={(ids) => setChecklistItemIds(ids)}
              selectionInfo={{
                entityCount: checklistItemIds.length,
                entityName: 'task',
              }}
              toolsOptions={false}
              selection={(row) => {
                return !row.content.qaStatus;
              }}
              selectionActions={
                qaModeSet
                  ? [
                      () => {
                        return (
                          <Button
                            type={'SECONDARY'}
                            onClick={() =>
                              onQaStatusChange.mutate({ status: 'PASSED', checklistItemIds })
                            }
                          >
                            QA pass
                          </Button>
                        );
                      },
                      () => {
                        return (
                          <Button
                            type={'SECONDARY'}
                            onClick={() =>
                              onQaStatusChange.mutate({ status: 'FAILED', checklistItemIds })
                            }
                          >
                            QA fail
                          </Button>
                        );
                      },
                    ]
                  : [
                      () => {
                        return (
                          <Button
                            type={'SECONDARY'}
                            onClick={() =>
                              onChecklistStatusChange.mutate({ done: true, checklistItemIds })
                            }
                          >
                            Mark done
                          </Button>
                        );
                      },
                      () => {
                        return (
                          <Button
                            type={'SECONDARY'}
                            onClick={() =>
                              onChecklistStatusChange.mutate({ done: false, checklistItemIds })
                            }
                          >
                            Mark not done
                          </Button>
                        );
                      },
                    ]
              }
              innerRef={actionRef}
            ></Table>
          </Card.Section>
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
}
