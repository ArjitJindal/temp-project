import React, { useImperativeHandle, useState } from 'react';
import { message, Switch } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ListHeader, ListMetadata, ListType } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import DeleteListModal from '@/pages/lists/ListTable/DeleteListModal';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { getErrorMessage } from '@/utils/lang';
import { TableColumn } from '@/components/ui/Table/types';
import { useQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { LISTS_OF_TYPE } from '@/utils/queries/keys';
import { map } from '@/utils/asyncResource';
import { getListSubtypeTitle, stringifyListType } from '@/pages/lists/helpers';
import { useApiTime } from '@/utils/tracker';

export type ListTableRef = React.Ref<{
  reload: () => void;
}>;

interface Props {
  listType: ListType;
}

function ListTable(props: Props, ref: ListTableRef) {
  const { listType } = props;
  const api = useApi();
  const [listToDelete, setListToDelete] = useState<ListHeader | null>(null);
  const queryClient = useQueryClient();
  const measure = useApiTime();
  const queryResults = useQuery(LISTS_OF_TYPE(listType), () =>
    measure(() => api.getLists({ listType }), `Get List ${stringifyListType(listType)}`),
  );

  useImperativeHandle(ref, () => ({
    reload: queryResults.refetch,
  }));

  const changeListMutation = useMutation<
    unknown,
    unknown,
    { listId: string; metadata: ListMetadata },
    { previousList: ListHeader[] | undefined }
  >(
    async (event) => {
      const { listId, metadata } = event;
      const hideMessage = message.loading('Updating list...', 0);
      try {
        await api.patchList({
          listId,
          ListData: {
            metadata,
          },
        });
        message.success('List state saved!');
      } catch (e) {
        message.error(`Unable to save list! ${getErrorMessage(e)}`);
        throw e;
      } finally {
        hideMessage();
      }
    },
    {
      onMutate: async (event) => {
        const { listId, metadata } = event;
        const listsOfTypeKey = LISTS_OF_TYPE(listType);
        const previousList = queryClient.getQueryData<ListHeader[]>(listsOfTypeKey);
        queryClient.setQueryData<ListHeader[]>(listsOfTypeKey, (prevState) =>
          prevState?.map((listHeader) =>
            listHeader.listId === listId
              ? {
                  ...listHeader,
                  metadata,
                }
              : listHeader,
          ),
        );
        return { previousList };
      },
      // If the mutation fails, use the context we returned above
      onError: (err, event, context) => {
        queryClient.setQueryData(LISTS_OF_TYPE(listType), context?.previousList);
      },
    },
  );

  const columns: TableColumn<ListHeader>[] = [
    {
      title: 'List ID',
      width: 50,
      search: false,
      render: (_, entity) => (
        <Id
          to={makeUrl('/lists/:type/:listId', {
            type: stringifyListType(listType),
            listId: entity.listId,
          })}
        >
          {entity.listId}
        </Id>
      ),
    },
    {
      title: 'List Subtype',
      width: 150,
      search: false,
      render: (_, entity) => getListSubtypeTitle(entity.subtype),
    },
    {
      title: 'List Name',
      width: 150,
      search: false,
      render: (_, entity) => entity.metadata?.name,
    },
    {
      title: 'List Description',
      width: 200,
      search: false,
      render: (_, entity) => entity.metadata?.description,
    },
    {
      title: 'Total Records',
      width: 80,
      search: false,
      render: (_, entity) => entity.size,
    },
    {
      title: 'Created On',
      width: 120,
      search: false,
      render: (_, entity) => <TimestampDisplay timestamp={entity.createdTimestamp} />,
    },
    {
      title: 'Status',
      search: false,
      width: 1,
      render: (_, entity) => (
        <Switch
          checked={entity.metadata?.status ?? false}
          onChange={(value) => {
            changeListMutation.mutate({
              listId: entity.listId,
              metadata: {
                ...entity.metadata,
                status: value,
              },
            });
          }}
        />
      ),
    },
    {
      title: 'Actions',
      search: false,
      width: 1,
      render: (_, entity) => {
        return (
          <Button
            danger
            onClick={() => {
              setListToDelete(entity);
            }}
          >
            Delete
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <QueryResultsTable
        queryResults={{
          data: map(queryResults.data, (items) => ({ items })),
          refetch: queryResults.refetch,
        }}
        rowKey="listId"
        search={false}
        columns={columns}
        pagination={false}
      />
      <DeleteListModal
        listType={listType}
        list={listToDelete}
        onCancel={() => {
          setListToDelete(null);
        }}
        onSuccess={() => {
          setListToDelete(null);
          queryResults.refetch();
        }}
      />
    </>
  );
}

export default React.forwardRef(ListTable);
