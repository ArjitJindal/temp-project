import React, { useCallback, useMemo, useRef, useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { Input } from 'antd';
import { UseMutationResult } from '@tanstack/react-query';
import s from './index.module.less';
import { ListHeader, ListType, Permission } from '@/apis';
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
import CountryDisplay from '@/components/ui/CountryDisplay';
import { StatePair } from '@/utils/state';
import {
  DefaultApiGetWhiteListItemsRequest,
  DefaultApiPostWhiteListItemRequest,
} from '@/apis/types/ObjectParamAPI';
import { AsyncResource, getOr, map } from '@/utils/asyncResource';
import { notEmpty } from '@/utils/array';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
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
  listId: string;
  listType: ListType;
  listHeaderRes: AsyncResource<ListHeader>;
  clearListMutation: UseMutationResult<unknown, unknown, void, unknown>;
  onImportCsv: () => void;
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
  const { listId, listType, listHeaderRes, clearListMutation, onImportCsv } = props;
  const settings = useSettings();

  const api = useApi();
  const [editUserData, setEditUserData] = useState<ExistedTableItemData | null>(null);
  const [newUserData, setNewUserData] = useState<NewTableItemData>({
    value: [],
    reason: '',
    meta: {},
  });
  const requiredWritePermissions: Permission[] = useMemo(
    () => (listType === 'WHITELIST' ? ['lists:whitelist:write'] : ['lists:blacklist:write']),
    [listType],
  );

  const tableRef = useRef<TableRefType>(null);

  const isNewUserValid = newUserData.value.length > 0;
  const [isAddUserLoading, setAddUserLoading] = useState(false);

  const handleAddItem = useCallback(() => {
    const hideMessage = message.loading('Adding item to a list...');

    if (isNewUserValid) {
      setAddUserLoading(true);
      Promise.all(
        newUserData.value.map((itemValue) => {
          const payload: DefaultApiPostWhiteListItemRequest = {
            listId,
            ListItem: {
              key: itemValue,
              metadata: { reason: newUserData.reason, ...newUserData.meta },
            },
          };

          return listType === 'WHITELIST'
            ? api.postWhiteListItem(payload)
            : api.postBlacklistItem(payload);
        }),
      )
        .then(() => {
          hideMessage();
          setNewUserData({ value: [], reason: '', meta: {} });
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
  }, [isNewUserValid, newUserData, listId, api, listType]);

  const [isEditUserLoading, setEditUserLoading] = useState(false);
  const isEditUserValid = !!editUserData?.reason;

  const handleSaveItem = () => {
    if (isEditUserValid) {
      setEditUserLoading(true);
      const payload: DefaultApiPostWhiteListItemRequest = {
        listId,
        ListItem: {
          key: editUserData.value ?? '',
          metadata: { ...editUserData.meta, reason: editUserData.reason },
        },
      };

      const promise =
        listType === 'WHITELIST' ? api.postWhiteListItem(payload) : api.postBlacklistItem(payload);

      promise
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
      const promise =
        listType === 'WHITELIST'
          ? api.deleteWhiteListItem({ listId, key: userId })
          : api.deleteBlacklistItem({ listId, key: userId });

      promise
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
    [api, listId, listType],
  );
  const [params, setParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);

  const listResult = useCursorQuery(LISTS_ITEM_TYPE(listId, listType, params), async ({ from }) => {
    const payload: DefaultApiGetWhiteListItemsRequest = {
      listId,
      start: params.from || from,
      pageSize: params.pageSize,
    };

    const response =
      listType === 'WHITELIST'
        ? await api.getWhiteListItems(payload)
        : await api.getBlacklistItems(payload);

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

  const listSubtype = getOr(
    map(listHeaderRes, ({ subtype }) => subtype),
    null,
  );
  const columns = useMemo(() => {
    return helper.list(
      [
        listSubtype != null &&
          helper.derived<string | string[]>({
            title: getListSubtypeTitle(listSubtype, settings),
            value: (item) => item.value,
            type: {
              render: (value, context) => {
                const { item: entity } = context;
                const externalState: ExternalState = context.external as ExternalState;

                const [newUserData, setNewUserData] = externalState.newUserData;

                if (entity.type === 'NEW') {
                  return (
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
                      listSubtype={listSubtype}
                    />
                  );
                } else if (listSubtype === 'COUNTRY' && value != null) {
                  const valueArray = Array.isArray(value) ? value : [value];
                  return (
                    <>
                      {valueArray.map((code) => (
                        <CountryDisplay key={code} isoCode={code} />
                      ))}
                    </>
                  );
                }
                return <>{value}</>;
              },
            },
          }),
        ...(listSubtype === 'USER_ID'
          ? helper.list([
              helper.simple<'meta.userFullName'>({
                title: `${firstLetterUpper(settings.userAlias)} name`,
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
          defaultWidth: 170,
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
                    requiredPermissions={requiredWritePermissions}
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
                      requiredPermissions={requiredWritePermissions}
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
                    requiredPermissions={requiredWritePermissions}
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
                    requiredPermissions={requiredWritePermissions}
                  >
                    Remove
                  </Button>
                </div>
              );
            }
          },
        }),
      ].filter(notEmpty),
    );
  }, [
    isAddUserLoading,
    isEditUserValid,
    isNewUserValid,
    listSubtype,
    requiredWritePermissions,
    settings,
  ]);

  return (
    <>
      <QueryResultsTable<TableItem, CommonParams>
        leftTools={<Button onClick={onImportCsv}>Import CSV</Button>}
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
        extraTools={[
          () => (
            <Button
              type="TETRIARY"
              onClick={() => clearListMutation.mutate()}
              isDisabled={clearListMutation.isLoading}
              requiredPermissions={requiredWritePermissions}
            >
              Clear list
            </Button>
          ),
        ]}
      />
    </>
  );
}
