import React, { useImperativeHandle, useState } from 'react';
import pluralize from 'pluralize';
import { ListHeaderInternal, ListType } from '@/apis';
import Button from '@/components/library/Button';
import DeleteListModal from '@/pages/lists/ListTable/DeleteListModal';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { TableColumn, ToolRenderer } from '@/components/library/Table/types';
import { map } from '@/utils/queries/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { getListSubtypeTitle, stringifyListType } from '@/pages/lists/helpers';
import { useHasResources } from '@/utils/user-utils';
import { useLists, usePatchListMetadata } from '@/hooks/api/lists';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE } from '@/components/library/Table/standardDataTypes';
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
  const [listToDelete, setListToDelete] = useState<ListHeaderInternal | null>(null);
  const queryResults = useLists(listType);

  const hasListWritePermissions = useHasResources([
    listType === 'WHITELIST' ? 'write:::lists/whitelist/*' : 'write:::lists/blacklist/*',
  ]);

  useImperativeHandle(ref, () => ({
    reload: queryResults.refetch,
  }));

  const changeListMutation = usePatchListMetadata(listType);

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
        sizingMode="FULL_WIDTH"
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
