import React, { useEffect, useMemo, useState } from 'react';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { ID, NUMBER, TAG } from '@/components/library/Table/standardDataTypes';
import { ColumnDataType } from '@/components/library/Table/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import Id from '@/components/ui/Id';
import {
  useAllWorkflowList,
  useChangeWorkflowEnableMutation,
  WorkflowItem,
  WorkflowType,
} from '@/utils/api/workflows';
import { map } from '@/utils/queries/types';
import { makeUrl } from '@/utils/routing';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import Toggle from '@/components/library/Toggle';
import { isLoading } from '@/utils/asyncResource';

export default function WorkflowsList() {
  const workflowsQueryResult = useAllWorkflowList();

  const columns = useMemo(() => {
    const helper = new ColumnHelper<WorkflowItem>();
    return [
      helper.simple<'id'>({
        title: 'ID',
        type: {
          ...ID,
          render: (id, entity) => {
            return (
              <Id
                to={makeUrl(`/workflows/:type/item/:id`, {
                  type: entity.item.workflowType.toLowerCase(),
                  id,
                })}
              >
                {id}
              </Id>
            );
          },
        },
        key: 'id',
        defaultWidth: 100,
      }),
      helper.simple<'workflowType'>({
        title: 'Category',
        key: 'workflowType',
        type: TAG as ColumnDataType<
          'case' | 'alert' | 'change-approval' // Unified approval workflow type
        >,
        defaultWidth: 180,
      }),
      helper.simple<'version'>({
        title: 'Last version',
        key: 'version',
        type: {
          ...NUMBER,
          link: (value) => {
            return makeUrl(`/workflows/:type/item/:id`, {
              type: 'case',
              id: value,
            });
          },
          stringify: (value) => String(value),
          render: (timestamp) => {
            const parsedTimestamp = timestamp ? Number(timestamp) : null;
            if (parsedTimestamp == null || Number.isNaN(parsedTimestamp)) {
              return <span>{timestamp}</span>;
            }
            return <span>{dayjs(parsedTimestamp).format(DEFAULT_DATE_TIME_FORMAT)}</span>;
          },
        },
      }),
      // helper.simple<'category'>({ title: 'Category', key: 'category' }),
      helper.simple<'name'>({ title: 'Name', key: 'name' }),
      helper.simple<'description'>({
        title: 'Description',
        key: 'description',
        defaultWidth: 350,
      }),
      // helper.simple<'workflowType'>({
      //   title: 'Type',
      //   key: 'workflowType',
      //   type: TAG as ColumnDataType<'case' | 'alert'>,
      // }),
      // helper.simple<'createdAt'>({ title: 'Created At', key: 'createdAt' }),
      helper.simple<'enabled'>({
        title: 'Status',
        key: 'enabled',
        defaultEditState: true,
        defaultSticky: 'RIGHT',
        defaultWidth: 80,
        enableResizing: false,
        type: {
          render: (value, item) => {
            return (
              <StatusToggle
                workflowId={item.item.id}
                workflowType={item.item.workflowType}
                value={value}
              />
            );
          },
        },
      }),
    ];
  }, []);

  return (
    <QueryResultsTable<WorkflowItem>
      tableId={'workflow-list'}
      rowKey="id"
      queryResults={map(workflowsQueryResult, (workflows) => ({
        items: workflows,
        total: workflows.length,
      }))}
      columns={columns}
      pagination={false}
      rowEditing={{
        isEditable: () => true,
        onSave: () => {},
      }}
    />
  );
}

/*
  Helpers
 */
function StatusToggle(props: {
  workflowId: string;
  workflowType: WorkflowType;
  value: boolean | undefined;
}) {
  const statePair = useState<boolean | undefined>(props.value);
  const [value, setValue] = statePair;

  useEffect(() => {
    setValue(props.value);
  }, [props.value, setValue]);

  const enabledStatusMutation = useChangeWorkflowEnableMutation(statePair);

  return (
    <Toggle
      isLoading={isLoading(enabledStatusMutation.dataResource)}
      value={value}
      onChange={(newValue) => {
        setValue(newValue);
        enabledStatusMutation.mutateAsync({
          workflowType: props.workflowType,
          workflowId: props.workflowId,
          enabled: newValue ?? false,
        });
      }}
    />
  );
}
