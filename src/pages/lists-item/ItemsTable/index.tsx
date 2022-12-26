import React, { useCallback, useRef, useState } from 'react';
import { Input, message } from 'antd';
import s from './index.module.less';
import { CommonParams, DEFAULT_PARAMS_STATE, TableActionType } from '@/components/ui/Table';
import { ListHeader } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import { getErrorMessage } from '@/utils/lang';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { LISTS_ITEM_TYPE } from '@/utils/queries/keys';
import { getListSubtypeTitle, Metadata } from '@/pages/lists/helpers';
import { TableColumn } from '@/components/ui/Table/types';
import NewValueInput from '@/pages/lists/NewListDrawer/NewValueInput';

interface ExistedTableItemData {
  value: string;
  reason: string;
  meta: Metadata;
}

interface NewTableItemData {
  value: string[];
  reason: string;
  meta: Metadata;
}

interface ExistedTableItem extends ExistedTableItemData {
  type: 'EXISTED';
}

interface NewTableItem extends NewTableItemData {
  type: 'NEW';
}

type TableItem = ExistedTableItem | NewTableItem;

export type UserListTableRef = React.Ref<{
  reload: () => void;
}>;

interface Props {
  listHeader: ListHeader;
}

function UserListTable(props: Props) {
  const { listHeader } = props;
  const { listId, listType, size } = listHeader;

  const api = useApi();
  const [editUserData, setEditUserData] = useState<ExistedTableItemData | null>(null);
  const [newUserData, setNewUserData] = useState<NewTableItemData>({
    value: [],
    reason: '',
    meta: {},
  });

  console.log('editUserData', editUserData);
  const tableRef = useRef<TableActionType>(null);

  const isNewUserValid = newUserData.value.length > 0;
  const [isAddUserLoading, setAddUserLoading] = useState(false);

  const handleAddItem = useCallback(() => {
    const hideMessage = message.loading('Adding item to a list...', 0);
    if (isNewUserValid) {
      setAddUserLoading(true);
      Promise.all(
        newUserData.value.map((itemValue) =>
          api.postListItem({
            listId,
            ListItem: {
              key: itemValue ?? '',
              metadata: {
                reason: newUserData.reason,
                ...newUserData.meta,
              },
            },
          }),
        ),
      )
        .then(() => {
          hideMessage();
          setNewUserData({
            value: [],
            reason: '',
            meta: {},
          });
          message.success(`Item successfully added!`);
          tableRef.current?.reload();
        })
        .catch((e) => {
          hideMessage();
          message.error(`Unable to add an item to a list! ${getErrorMessage(e)}`);
        })
        .finally(() => {
          setAddUserLoading(false);
        });
    }
  }, [isNewUserValid, newUserData, listId, api]);

  const [isEditUserLoading, setEditUserLoading] = useState(false);
  const isEditUserValid = !!editUserData?.reason;
  const handleSaveItem = () => {
    if (isEditUserValid) {
      setEditUserLoading(true);
      api
        .postListItem({
          listId,
          ListItem: {
            key: editUserData.value ?? '',
            metadata: {
              ...editUserData.meta,
              reason: editUserData.reason,
            },
          },
        })
        .then(() => {
          setEditUserData(null);
          tableRef.current?.reload();
        })
        .catch((e) => {
          message.error(`Unable to save user! ${getErrorMessage(e)}`);
        })
        .finally(() => {
          setEditUserLoading(false);
        });
    }
  };

  const [isUserDeleteLoading, setEditDeleteLoading] = useState(false);
  const handleDeleteUser = (userId: string) => {
    setEditDeleteLoading(true);
    api
      .deleteListItem({
        listId,
        key: userId,
      })
      .then(() => {
        tableRef.current?.reload();
      })
      .catch((e) => {
        message.error(`Unable to delete user from list! ${getErrorMessage(e)}`);
      })
      .finally(() => {
        setEditDeleteLoading(false);
      });
  };
  const [params, setParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);

  const listResult = usePaginatedQuery(LISTS_ITEM_TYPE(listId, listType), async ({ page }) => {
    const response = await api.getListItems({
      listId,
      page,
    });
    const data: TableItem[] = [
      ...response.map(
        ({ key, metadata }): TableItem => ({
          type: 'EXISTED',
          value: key,
          reason: metadata?.reason ?? '',
          meta: metadata ?? {},
        }),
      ),
      {
        type: 'NEW',
        value: [],
        reason: '',
        meta: {},
      },
    ];
    return {
      items: data,
      total: size + 1,
    };
  });

  return (
    <div className={s.root}>
      <QueryResultsTable<TableItem, CommonParams>
        rowKey="value"
        actionRef={tableRef}
        options={{
          reload: false,
          setting: false,
          density: false,
        }}
        search={false}
        columns={[
          {
            title: getListSubtypeTitle(listHeader.subtype),
            width: 220,
            search: false,
            render: (_, entity) =>
              entity.type === 'NEW' ? (
                <NewValueInput
                  value={newUserData.value}
                  onChange={(value) => {
                    setNewUserData((prevState) => ({
                      ...prevState,
                      value: value,
                    }));
                  }}
                  onChangeMeta={(meta) => {
                    setNewUserData((prevState) => ({
                      ...prevState,
                      meta,
                    }));
                  }}
                  listSubtype={listHeader.subtype}
                />
              ) : (
                entity.value
              ),
            onCell: (_) => {
              if (_.type === 'NEW' && listHeader.subtype === 'USER_ID') {
                return { colSpan: 2 };
              }
              return {};
            },
            exportData: (entity) => entity.value,
          },
          ...(listHeader.subtype === 'USER_ID'
            ? ([
                {
                  title: 'User name',
                  width: 120,
                  search: false,
                  render: (_, entity: TableItem) => entity.meta.userFullName ?? '-',
                  onCell: (_) => {
                    if (_.type === 'NEW') {
                      return { colSpan: 0 };
                    }
                    return {};
                  },
                  exportData: (entity: TableItem) => entity.meta.userFullName ?? '-',
                },
              ] as TableColumn<TableItem>[])
            : []),
          {
            title: 'Reason for adding to list',
            search: false,
            render: (_, entity) => {
              if (entity.type === 'NEW') {
                return (
                  <Input
                    disabled={isAddUserLoading}
                    value={newUserData.reason}
                    onChange={(e) => {
                      setNewUserData((prevState) => ({
                        ...prevState,
                        reason: e.currentTarget.value,
                      }));
                    }}
                  />
                );
              } else if (entity.value === editUserData?.value) {
                return (
                  <Input
                    disabled={isUserDeleteLoading}
                    value={editUserData.reason}
                    onChange={(e) => {
                      setEditUserData({
                        ...editUserData,
                        reason: e.currentTarget.value,
                      });
                    }}
                  />
                );
              }
              return entity.reason;
            },
            exportData: (entity) => entity.reason,
          },
          {
            title: 'Actions',
            search: false,
            width: 1,
            render: (_, entity) => {
              if (entity.type === 'NEW') {
                return (
                  <div className={s.actions}>
                    <Button
                      type="primary"
                      disabled={isAddUserLoading || !isNewUserValid}
                      onClick={handleAddItem}
                    >
                      Add
                    </Button>
                  </div>
                );
              } else if (entity.type === 'EXISTED') {
                if (editUserData?.value === entity.value) {
                  return (
                    <div className={s.actions}>
                      <Button
                        size="small"
                        type="primary"
                        onClick={handleSaveItem}
                        disabled={isEditUserLoading || !isEditUserValid}
                      >
                        Save
                      </Button>
                      <Button
                        size="small"
                        type="ghost"
                        disabled={isEditUserLoading}
                        onClick={() => {
                          setEditUserData(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  );
                }
                return (
                  <div className={s.actions}>
                    <Button
                      size="small"
                      type="ghost"
                      disabled={isUserDeleteLoading}
                      onClick={() => {
                        setEditUserData(entity);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      danger={true}
                      type="ghost"
                      disabled={isUserDeleteLoading}
                      onClick={() => {
                        handleDeleteUser(entity.value ?? '');
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                );
              }
            },
          },
        ]}
        params={params}
        onChangeParams={setParams}
        queryResults={listResult}
        autoAdjustHeight
      />
    </div>
  );
}

export default UserListTable;
