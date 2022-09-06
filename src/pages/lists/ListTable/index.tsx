import { ProColumns } from '@ant-design/pro-table';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { message, Switch } from 'antd';
import { Table } from '@/components/ui/Table';
import { ListHeader, ListMetadata, ListType } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import DeleteListModal from '@/pages/lists/ListTable/DeleteListModal';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import { getErrorMessage } from '@/utils/lang';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isLoading,
  isSuccess,
  loading,
  success,
} from '@/utils/asyncResource';

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

  const [dataRes, setDataRes] = useState<AsyncResource<ListHeader[]>>(init());
  const triggerFetch = useCallback(() => {
    let isCanceled = false;
    setDataRes((prevState) => loading(getOr(prevState, [])));
    api.getLists({ listType }).then(
      (lists) => {
        if (isCanceled) {
          return;
        }
        setDataRes(success(lists));
      },
      (e) => {
        if (isCanceled) {
          return;
        }
        const errorMsg = `Failed to load lists! ${getErrorMessage(e)}`;
        message.error(errorMsg);
        setDataRes(failed(errorMsg));
      },
    );
    return () => {
      isCanceled = true;
    };
  }, [api, listType]);

  useEffect(() => {
    triggerFetch();
  }, [triggerFetch]);

  useImperativeHandle(ref, () => ({
    reload: triggerFetch,
  }));

  const handleChangeList = (listId: string, metadata: ListMetadata) => {
    // Optimistically update current state
    setDataRes((prevState) =>
      isSuccess(prevState)
        ? success(
            prevState.value.map((listHeader) =>
              listHeader.listId === listId
                ? {
                    ...listHeader,
                    metadata,
                  }
                : listHeader,
            ),
          )
        : prevState,
    );
    const hideMessage = message.loading('Updating list...', 0);
    api
      .patchList({
        listType,
        listId,
        ListData: {
          metadata,
        },
      })
      .then(() => {
        hideMessage();
        message.success('List state saved!');
      })
      .catch((e) => {
        hideMessage();
        message.error(`Unable to save user! ${getErrorMessage(e)}`);
        triggerFetch();
      });
  };

  const columns: ProColumns<ListHeader>[] = [
    {
      title: 'List ID',
      width: 50,
      search: false,
      render: (_, entity) => (
        <Id
          to={makeUrl('/lists/:type/:listId', {
            type: listType,
            listId: entity.listId,
          })}
        >
          {entity.listId}
        </Id>
      ),
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
      title: 'Total Users',
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
            handleChangeList(entity.listId, {
              ...entity.metadata,
              status: value,
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
      <Table<ListHeader>
        options={{
          reload: false,
        }}
        loading={isLoading(dataRes)}
        rowKey="listId"
        search={false}
        columns={columns}
        pagination={false}
        dataSource={getOr(dataRes, [])}
      />
      <DeleteListModal
        listType={listType}
        list={listToDelete}
        onCancel={() => {
          setListToDelete(null);
        }}
        onSuccess={() => {
          setListToDelete(null);
          triggerFetch();
        }}
      />
    </>
  );
}

export default React.forwardRef(ListTable);
