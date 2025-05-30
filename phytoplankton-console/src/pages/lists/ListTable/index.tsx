import React, { useImperativeHandle, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import pluralize from 'pluralize';
import { ListHeaderInternal, ListMetadata, ListType } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import DeleteListModal from '@/pages/lists/ListTable/DeleteListModal';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { getErrorMessage } from '@/utils/lang';
import { TableColumn, ToolRenderer } from '@/components/library/Table/types';
import { useQuery } from '@/utils/queries/hooks';
import { map } from '@/utils/queries/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { LISTS_OF_TYPE } from '@/utils/queries/keys';
import { getListSubtypeTitle, stringifyListType } from '@/pages/lists/helpers';
import { useHasPermissions } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE } from '@/components/library/Table/standardDataTypes';
import { message } from '@/components/library/Message';
import Toggle from '@/components/library/Toggle';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

export type ListTableRef = React.Ref<{
  reload: () => void;
}>;

interface Props {
  listType: ListType;
  extraTools?: ToolRenderer[];
}

function ListTable(props: Props, ref: ListTableRef) {
  const { listType, extraTools } = props;
  const settings = useSettings();
  const api = useApi();
  const [listToDelete, setListToDelete] = useState<ListHeaderInternal | null>(null);
  const queryClient = useQueryClient();
  const queryResults = useQuery(LISTS_OF_TYPE(listType), () => {
    if (listType === 'WHITELIST') {
      return api.getWhitelist();
    }
    return api.getBlacklist();
  });

  const hasListWritePermissions = useHasPermissions(
    [listType === 'WHITELIST' ? 'lists:whitelist:write' : 'lists:blacklist:write'],
    [listType === 'WHITELIST' ? 'write:::lists/whitelist/*' : 'write:::lists/blacklist/*'],
  );

  useImperativeHandle(ref, () => ({
    reload: queryResults.refetch,
  }));

  const changeListMutation = useMutation<
    unknown,
    unknown,
    { listId: string; metadata: ListMetadata },
    { previousList: ListHeaderInternal[] | undefined }
  >(
    async (event) => {
      const { listId, metadata } = event;
      const hideMessage = message.loading('Updating list...');
      try {
        listType === 'WHITELIST'
          ? await api.patchWhiteList({ listId, ListData: { metadata } })
          : await api.patchBlacklist({ listId, ListData: { metadata } });

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
        const previousList = queryClient.getQueryData<ListHeaderInternal[]>(listsOfTypeKey);
        queryClient.setQueryData<ListHeaderInternal[]>(listsOfTypeKey, (prevState) =>
          prevState?.map((listHeader) =>
            listHeader.listId === listId ? { ...listHeader, metadata } : listHeader,
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

  const helper = new ColumnHelper<ListHeaderInternal>();
  const columns: TableColumn<ListHeaderInternal>[] = helper.list([
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
      title: 'List subtype',
      type: {
        render: (subtype) => (subtype ? <>{getListSubtypeTitle(subtype, settings)}</> : <></>),
      },
    }),
    helper.simple<'metadata.name'>({
      key: 'metadata.name',
      title: 'List name',
    }),
    helper.simple<'metadata.description'>({
      key: 'metadata.description',
      title: 'List description',
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
      defaultWidth: 80,
      type: {
        render: (status, { item: entity }) => (
          <Toggle
            value={status}
            isDisabled={!hasListWritePermissions}
            onChange={(value) => {
              changeListMutation.mutate({
                listId: entity.listId,
                metadata: { ...entity.metadata, status: value },
              });
            }}
          />
        ),
      },
    }),
    helper.simple<'metadata.ttl'>({
      key: 'metadata.ttl',
      title: 'Item expiration time',
      defaultWidth: 180,
      type: {
        render: (value) => {
          if (value?.value == null) {
            return <>-</>;
          }
          return <div>{pluralize(value.unit.toLocaleLowerCase(), value.value, true)}</div>;
        },
      },
    }),
    ...(hasListWritePermissions
      ? [
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
        ]
      : []),
  ]);

  return (
    <>
      <QueryResultsTable
        queryResults={map(queryResults, (items) => ({
          items,
        }))}
        extraTools={extraTools}
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
