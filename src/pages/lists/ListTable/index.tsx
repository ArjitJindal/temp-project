import React, { useImperativeHandle, useState } from 'react';
import { Switch } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ListHeader, ListMetadata, ListType } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import DeleteListModal from '@/pages/lists/ListTable/DeleteListModal';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { getErrorMessage } from '@/utils/lang';
import { TableColumn } from '@/components/library/Table/types';
import { useQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { LISTS_OF_TYPE } from '@/utils/queries/keys';
import { map } from '@/utils/asyncResource';
import { getListSubtypeTitle, stringifyListType } from '@/pages/lists/helpers';
import { useApiTime } from '@/utils/tracker';
import { useHasPermissions } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME } from '@/components/library/Table/standardDataTypes';
import { message } from '@/components/library/Message';

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

  const hasListWritePermissions = useHasPermissions(['lists:all:write']);
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
      const hideMessage = message.loading('Updating list...');
      try {
        await api.patchList({
          listId,
          ListData: {
            metadata,
          },
        });
        message.success('List state saved!');
      } catch (e) {
        message.fatal(`Unable to save list! ${getErrorMessage(e)}`, e);
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

  const helper = new ColumnHelper<ListHeader>();
  const columns: TableColumn<ListHeader>[] = helper.list([
    helper.simple<'listId'>({
      key: 'listId',
      title: 'List ID',
      type: {
        render: (listId) => (
          <Id
            to={makeUrl('/lists/:type/:listId', {
              type: stringifyListType(listType),
              listId: listId,
            })}
          >
            {listId}
          </Id>
        ),
      },
    }),
    helper.simple<'subtype'>({
      key: 'subtype',
      title: 'List Subtype',
      type: {
        render: (subtype) => (subtype ? <>{getListSubtypeTitle(subtype)}</> : <></>),
      },
    }),
    helper.simple<'metadata.name'>({
      key: 'metadata.name',
      title: 'List Name',
    }),
    helper.simple<'metadata.description'>({
      key: 'metadata.description',
      title: 'List Description',
    }),
    helper.simple<'size'>({
      key: 'size',
      title: 'Total Records',
    }),
    helper.simple<'createdTimestamp'>({
      key: 'createdTimestamp',
      title: 'Created On',
      type: DATE_TIME,
    }),
    helper.simple<'metadata.status'>({
      key: 'metadata.status',
      title: 'Status',
      defaultWidth: 80,
      type: {
        render: (status, _, entity) => (
          <Switch
            checked={status ?? false}
            disabled={!hasListWritePermissions}
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
    }),
    helper.display({
      title: 'Actions',
      defaultWidth: 100,
      render: (entity) => {
        return (
          <Button
            type="SECONDARY"
            onClick={() => {
              setListToDelete(entity);
            }}
            isDisabled={!hasListWritePermissions}
          >
            Delete
          </Button>
        );
      },
    }),
  ]);

  return (
    <>
      <QueryResultsTable
        queryResults={{
          data: map(queryResults.data, (items) => ({ items })),
          refetch: queryResults.refetch,
        }}
        rowKey="listId"
        columns={columns}
        pagination={false}
        fitHeight
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
