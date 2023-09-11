import React, { useCallback, useRef, useState } from 'react';
import { Input } from 'antd';
import s from './index.module.less';
import { ListHeader } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import { getErrorMessage } from '@/utils/lang';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { LISTS_ITEM_TYPE } from '@/utils/queries/keys';
import { getListSubtypeTitle, Metadata } from '@/pages/lists/helpers';
import NewValueInput from '@/pages/lists/NewListDrawer/NewValueInput';
import { CommonParams, TableRefType } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { message } from '@/components/library/Message';

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

const helper = new ColumnHelper<TableItem>();

export default function ItemsTable(props: Props) {
  const { listHeader } = props;
  const { listId, listType, size } = listHeader;

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

  const [focusOnReasonInput, setFocusOnReasonInput] = useState(false);
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

  const listResult = usePaginatedQuery(LISTS_ITEM_TYPE(listId, listType), async ({ page }) => {
    const response = await api.getListItems({ listId, page });
    const data: TableItem[] = [
      ...response.map(
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
      items: data,
      total: size + 1,
    };
  });

  return (
    <QueryResultsTable<TableItem, CommonParams>
      tableId="list-items-table"
      rowKey="rowKey"
      innerRef={tableRef}
      columns={helper.list([
        helper.derived<string | string[]>({
          title: getListSubtypeTitle(listHeader.subtype),
          value: (item) => item.value,
          type: {
            render: (value, { item: entity }) =>
              entity.type === 'NEW' ? (
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
              ),
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
        helper.simple({
          title: 'Reason for adding to list',
          key: 'reason',
          type: {
            render: (reason, { item: entity }) => {
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
                    onFocus={() => {
                      setFocusOnReasonInput(true);
                    }}
                    autoFocus={focusOnReasonInput}
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
                    onFocus={() => {
                      setFocusOnReasonInput(false);
                    }}
                    autoFocus={!focusOnReasonInput}
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
          render: (entity) => {
            if (entity.type === 'NEW') {
              return (
                <div className={s.actions}>
                  <Button
                    type="PRIMARY"
                    isLoading={isAddUserLoading}
                    isDisabled={!isNewUserValid}
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
                      size="SMALL"
                      type="PRIMARY"
                      onClick={handleSaveItem}
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
                      handleDeleteUser(entity.value ?? '');
                    }}
                  >
                    Remove
                  </Button>
                </div>
              );
            }
          },
        }),
      ])}
      params={params}
      onChangeParams={setParams}
      queryResults={listResult}
      fitHeight
      sizingMode="FULL_WIDTH"
    />
  );
}
