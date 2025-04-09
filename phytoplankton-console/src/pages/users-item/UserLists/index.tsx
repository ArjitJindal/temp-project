import s from './index.module.less';
import { ListHeader } from '@/apis';
import { useApi } from '@/api';
import Id from '@/components/ui/Id';
import { TableColumn } from '@/components/library/Table/types';
import { useQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { LISTS } from '@/utils/queries/keys';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE } from '@/components/library/Table/standardDataTypes';
import Toggle from '@/components/library/Toggle';
import * as Card from '@/components/ui/Card';
import { stringifyListType } from '@/pages/lists/helpers';
import { makeUrl } from '@/utils/routing';

interface Props {
  userId: string;
}

export default function UserLists(props: Props) {
  const { userId } = props;
  const api = useApi();

  const queryResults = useQuery([LISTS(), userId], async () => {
    const response = await api.getLists({ filterUserIds: [userId] });
    return {
      items: Array.isArray(response) ? response : [],
      total: Array.isArray(response) ? response.length : 0,
    };
  });

  const helper = new ColumnHelper<ListHeader>();
  const columns: TableColumn<ListHeader>[] = helper.list([
    helper.simple<'listId'>({
      key: 'listId',
      title: 'ID',
      type: {
        render: (listId, { item }) => (
          <Id
            to={makeUrl('/lists/:type/:listId', {
              type: stringifyListType(item.listType),
              listId: listId,
            })}
          >
            {listId}
          </Id>
        ),
      },
    }),
    helper.simple<'listType'>({
      key: 'listType',
      title: 'Type',
      type: {
        render: (listType) => <>{listType === 'WHITELIST' ? 'Whitelist' : 'Black list'}</>,
      },
    }),
    helper.simple<'metadata.name'>({
      key: 'metadata.name',
      title: 'Name',
    }),
    helper.simple<'metadata.description'>({
      key: 'metadata.description',
      title: 'Description',
    }),
    helper.simple<'metadata.ttl'>({
      key: 'metadata.ttl',
      title: 'Item expiration time',
      type: {
        render: (value) => {
          if (value?.value == null) {
            return <>-</>;
          }
          return (
            <>
              {value.value} {value.unit.toLowerCase()}
            </>
          );
        },
      },
    }),
    helper.simple<'size'>({
      key: 'size',
      title: 'Total records',
    }),
    helper.simple<'createdTimestamp'>({
      key: 'createdTimestamp',
      title: 'Created at',
      type: DATE,
    }),
    helper.simple<'metadata.status'>({
      key: 'metadata.status',
      title: 'Status',
      type: {
        render: (status) => <Toggle value={status} isDisabled={true} />,
      },
    }),
  ]);

  return (
    <Card.Root className={s.root}>
      <Card.Section>
        <QueryResultsTable
          queryResults={queryResults}
          rowKey="listId"
          columns={columns}
          pagination={false}
          fitHeight
          hideFilters={true}
          toolsOptions={false}
        />
      </Card.Section>
    </Card.Root>
  );
}
