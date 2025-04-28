import { useMemo } from 'react';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { useQuery } from '@/utils/queries/hooks';
import { WORKFLOWS_LIST } from '@/utils/queries/keys';
import { map } from '@/utils/queries/types';
import { ID } from '@/components/library/Table/standardDataTypes';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { WorkflowItem } from '@/utils/api/workflows';

export default function WorkflowsList() {
  const workflowsQueryResult = useQuery(WORKFLOWS_LIST({}), async (): Promise<WorkflowItem[]> => {
    return [
      {
        id: 'WF-001',
        category: 'category',
        name: 'name',
        description: 'description',
        type: 'type',
        createdAt: '2021-01-01',
        status: 'status',
      },
    ];
  });

  const columns = useMemo(() => {
    const helper = new ColumnHelper<WorkflowItem>();
    return [
      helper.simple<'id'>({
        title: 'ID',
        type: {
          ...ID,
          render: (id) => {
            return <Id to={makeUrl(`/workflows/item/${id}`)}>{id}</Id>;
          },
        },
        key: 'id',
      }),
      helper.simple<'category'>({ title: 'Category', key: 'category' }),
      helper.simple<'name'>({ title: 'Name', key: 'name' }),
      helper.simple<'description'>({ title: 'Description', key: 'description' }),
      helper.simple<'type'>({ title: 'Type', key: 'type' }),
      helper.simple<'createdAt'>({ title: 'Created At', key: 'createdAt' }),
      helper.simple<'status'>({ title: 'Status', key: 'status' }),
    ];
  }, []);

  return (
    <QueryResultsTable<WorkflowItem>
      rowKey="id"
      queryResults={map(workflowsQueryResult, (workflows) => ({
        items: workflows,
      }))}
      columns={columns}
    />
  );
}
