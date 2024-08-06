import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Input } from 'antd';
import s from './index.module.less';
import { ListHeader } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import { getErrorMessage } from '@/utils/lang';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { useCursorQuery } from '@/utils/queries/hooks';
import { LISTS_ITEM_TYPE } from '@/utils/queries/keys';
import { getListSubtypeTitle, Metadata } from '@/pages/lists/helpers';
import NewValueInput from '@/pages/lists/NewListDrawer/NewValueInput';
import { CommonParams, TableRefType } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { message } from '@/components/library/Message';
import { StatePair } from '@/utils/state';

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
  rowKey: string;
}

interface NewTableItem extends NewTableItemData {
  type: 'NEW';
  rowKey: string;
}

type TableItem = ExistedTableItem | NewTableItem;

export type UserListTableRef = React.Ref<{
  reload: () => void;
}>;

interface Props {
  listHeader: ListHeader;
}

type ExternalState = {
  editUserData: StatePair<ExistedTableItemData | null>;
  newUserData: StatePair<NewTableItemData>;
  isEditUserLoading: StatePair<boolean>;
  isUserDeleteLoading: StatePair<boolean>;
  onAdd: () => void;
  onSave: () => void;
  onDelete: (userId: string) => void;
};

const helper = new ColumnHelper<TableItem>();

export default function ItemsTable(props: Props) {
  const { listHeader } = props;
  const { listId, listType } = listHeader;

  const api = useApi();
  const [editUserData, setEditUserData] = useState<ExistedTableItemData | null>(null);
  const [newUserData, setNewUserData] = useState<NewTableItemData>({
    value: [],
    reason: '',
    meta: {},
  });

  const tableRef = useRef<TableRefType>(null);

  const isNewUserValid = newUserData.value.length > 0;
  const [isAddUserLoading, setAddUserLoading] = useState(false);

  const handleAddItem = useCallback(() => {
    const hideMessage = message.loading('Adding item to a list...');
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
          message.fatal(`Unable to add an item to a list! ${getErrorMessage(e)}`, e);
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
          message.fatal(`Unable to save user! ${getErrorMessage(e)}`, e);
        })
        .finally(() => {
          setEditUserLoading(false);
        });
    }
  };

  const [isUserDeleteLoading, setEditDeleteLoading] = useState(false);
  const handleDeleteUser = useCallback(
    (userId: string) => {
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
          message.fatal(`Unable to delete user from list! ${getErrorMessage(e)}`, e);
        })
        .finally(() => {
          setEditDeleteLoading(false);
        });
    },
    [api, listId],
  );
  const [params, setParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);

  const listResult = useCursorQuery(LISTS_ITEM_TYPE(listId, listType, params), async ({ from }) => {
    const response = await api.getListItems({ listId, start: from, pageSize: params.pageSize });

    const data: TableItem[] = [
      ...response.items.map(
        ({ key, metadata }): TableItem => ({
          rowKey: key,
          type: 'EXISTED',
          value: key,
          reason: metadata?.reason ?? '',
          meta: metadata ?? {},
        }),
      ),
      {
        rowKey: 'NEW',
        type: 'NEW',
        value: [],
        reason: '',
        meta: {},
      },
    ];
    return {
      ...response,
      items: data,
      total: response.count,
    };
  });

  const externalState: ExternalState = {
    editUserData: [editUserData, setEditUserData],
    newUserData: [newUserData, setNewUserData],
    isEditUserLoading: [isEditUserLoading, setEditUserLoading],
    isUserDeleteLoading: [isUserDeleteLoading, setEditDeleteLoading],
    onAdd: handleAddItem,
    onSave: handleSaveItem,
    onDelete: handleDeleteUser,
  };

  const columns = useMemo(() => {
    return helper.list([
      helper.derived<string | string[]>({
        title: getListSubtypeTitle(listHeader.subtype),
        value: (item) => item.value,
        type: {
          render: (value, context) => {
            const { item: entity } = context;
            const externalState: ExternalState = context.external as ExternalState;

            const [newUserData, setNewUserData] = externalState.newUserData;

            return entity.type === 'NEW' ? (
              <NewValueInput
                key={String(isAddUserLoading)}
                value={newUserData.value}
                onChange={(value) => {
                  setNewUserData((prevState) => ({
                    ...prevState,
                    value: value ?? [],
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
              <>{value}</>
            );
          },
        },
      }),
      ...(listHeader.subtype === 'USER_ID'
        ? helper.list([
            helper.simple<'meta.userFullName'>({
              title: 'User name',
              key: 'meta.userFullName',
            }),
          ])
        : []),
      helper.derived<string | string[]>({
        title: 'Reason for adding to list',
        value: (item) => item.reason,

        type: {
          render: (reason, context) => {
            const { item: entity } = context;
            const externalState: ExternalState = context.external as ExternalState;
            const [newUserData, setNewUserData] = externalState.newUserData;
            const [editUserData, setEditUserData] = externalState.editUserData;
            const [isUserDeleteLoading] = externalState.isUserDeleteLoading;

            if (entity.type === 'NEW') {
              return (
                <Input
                  disabled={isAddUserLoading}
                  value={newUserData.reason}
                  onChange={(e) => {
                    setNewUserData((prevState) => ({
                      ...prevState,
                      reason: e.target.value,
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
                      reason: e.target.value,
                    });
                  }}
                />
              );
            }
            return <>{reason}</>;
          },
          defaultWrapMode: 'WRAP',
        },
      }),
      helper.display({
        title: 'Actions',
        defaultWidth: 80,
        render: (entity, context) => {
          const externalState: ExternalState = context.external as ExternalState;
          const [editUserData, setEditUserData] = externalState.editUserData;
          const [isEditUserLoading] = externalState.isEditUserLoading;
          const [isUserDeleteLoading] = externalState.isUserDeleteLoading;
          const { onAdd, onSave, onDelete } = externalState;
          if (entity.type === 'NEW') {
            return (
              <div className={s.actions}>
                <Button
                  type="PRIMARY"
                  isLoading={isAddUserLoading}
                  isDisabled={!isNewUserValid}
                  onClick={onAdd}
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
                    size="SMALL"
                    type="PRIMARY"
                    onClick={onSave}
                    isDisabled={isEditUserLoading || !isEditUserValid}
                  >
                    Save
                  </Button>
                  <Button
                    size="SMALL"
                    type="SECONDARY"
                    isDisabled={isEditUserLoading}
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
                  size="SMALL"
                  type="SECONDARY"
                  isDisabled={isUserDeleteLoading}
                  onClick={() => {
                    setEditUserData(entity);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="SMALL"
                  type="SECONDARY"
                  isLoading={isUserDeleteLoading}
                  onClick={() => {
                    onDelete(entity.value ?? '');
                  }}
                >
                  Remove
                </Button>
              </div>
            );
          }
        },
      }),
    ]);
  }, [isAddUserLoading, isEditUserValid, isNewUserValid, listHeader.subtype]);

  return (
    <QueryResultsTable<TableItem, CommonParams>
      tableId="list-items-table"
      rowKey="rowKey"
      innerRef={tableRef}
      columns={columns}
      params={params}
      onChangeParams={setParams}
      queryResults={listResult}
      fitHeight
      sizingMode="SCROLL"
      externalState={externalState}
    />
  );
}
