import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './index.module.less';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import { useApi } from '@/api';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { ID, NUMBER, TAG } from '@/components/library/Table/standardDataTypes';
import { ColumnDataType } from '@/components/library/Table/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import Id from '@/components/ui/Id';
import { WorkflowItem } from '@/utils/api/workflows';
import { useQuery } from '@/utils/queries/hooks';
import { WORKFLOWS_LIST } from '@/utils/queries/keys';
import { map } from '@/utils/queries/types';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/library/Button';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';

export default function WorkflowsList() {
  const api = useApi();
  const workflowsQueryResult = useQuery(WORKFLOWS_LIST({}), async (): Promise<WorkflowItem[]> => {
    const workflowResponse = await api.getAllWorkflowTypes();
    return workflowResponse.workflows ?? [];
  });

  const navigate = useNavigate();

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
      }),
      helper.simple<'workflowType'>({
        title: 'Category',
        key: 'workflowType',
        type: TAG as ColumnDataType<'case' | 'alert' | 'risk-levels-approval' | 'rule-approval'>,
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
      // helper.simple<'description'>({ title: 'Description', key: 'description' }),
      // helper.simple<'workflowType'>({
      //   title: 'Type',
      //   key: 'workflowType',
      //   type: TAG as ColumnDataType<'case' | 'alert'>,
      // }),
      // helper.simple<'createdAt'>({ title: 'Created At', key: 'createdAt' }),
      // helper.simple<'status'>({ title: 'Status', key: 'status' }),
      helper.display({
        title: 'Actions',
        defaultSticky: 'RIGHT',
        render: (item) => {
          return (
            <div className={s.actions}>
              <Button
                type="TETRIARY"
                icon={<EditLineIcon />}
                onClick={() => {
                  navigate(
                    makeUrl(`/workflows/:type/item/:id`, {
                      type: item.workflowType.toLowerCase(),
                      id: item.id,
                    }),
                  );
                }}
              />
            </div>
          );
        },
      }),
    ];
  }, [navigate]);

  return (
    <QueryResultsTable<WorkflowItem>
      rowKey="id"
      queryResults={map(workflowsQueryResult, (workflows) => ({
        items: workflows,
        total: workflows.length,
      }))}
      columns={columns}
      pagination={false}
    />
  );
}
