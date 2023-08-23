import React, { useMemo, useState } from 'react';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import { useMutation } from '@tanstack/react-query';
import * as Card from '@/components/ui/Card';
import { ChecklistStatus } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { ChecklistItem, HydratedChecklist, useAlertChecklist } from '@/utils/checklist-templates';
import SegmentedControl from '@/components/library/SegmentedControl';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import Select from '@/components/library/Select';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { CHECKLIST_STATUSS } from '@/apis/models-custom/ChecklistStatus';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { SimpleColumn } from '@/components/library/Table/types';

interface Props {
  alertId: string;
}

export default function Checklist(props: Props) {
  const { alertId } = props;
  const checklistQueryResult = useAlertChecklist(alertId);
  const [category, setCategory] = useState<string | undefined>();
  const qaEnabled = useFeatureEnabled('QA');
  const api = useApi();
  const onQaStatusChange = useMutation(
    async ({ status, checklistItemId }: { status: ChecklistStatus; checklistItemId: string }) => {
      await api.patchAlertsQaStatus({
        alertId,
        checklistItemId,
        AlertChecklistQaUpdateRequest: {
          status,
        },
      });
      checklistQueryResult.refetch();
    },
    {
      onError: (err: Error) => {
        message.error(`Failed to update QA status: ${err}`);
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
    ];

    if (qaEnabled) {
      columns.push(
        helper.simple({
          key: 'qaStatus',
          title: 'QA Status',
          type: {
            render: (status, entity) => {
              return (
                <Select
                  options={CHECKLIST_STATUSS.map((status) => ({
                    value: status,
                    label: sentenceCase(status),
                  }))}
                  style={{ width: 140 }}
                  placeholder={'Select status'}
                  value={status}
                  onChange={(status) =>
                    onQaStatusChange.mutate({
                      status: status as ChecklistStatus,
                      checklistItemId: entity.item.id as string,
                    })
                  }
                ></Select>
              );
            },
          },
        }),
      );
    }
    return columns;
  }, [onQaStatusChange, qaEnabled]);

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
            ></Table>
          </Card.Section>
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
}
