import { COUNTRIES } from '@flagright/lib/constants';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { UseMutationResult } from '@tanstack/react-query';
import { Input } from 'antd';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { queryAdapter } from './helpers';
import s from './index.module.less';
import { TableParams } from './types';
import { useApi } from '@/api';
import { ListHeaderInternal, ListSubtypeInternal, ListType, Permission } from '@/apis';
import {
  DefaultApiGetWhiteListItemsRequest,
  DefaultApiPostWhiteListItemRequest,
} from '@/apis/types/ObjectParamAPI';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import { message } from '@/components/library/Message';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  AllParams,
  CommonParams,
  TableColumn,
  TableRefType,
} from '@/components/library/Table/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import CountryDisplay from '@/components/ui/CountryDisplay';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import NewValueInput from '@/pages/lists/NewListDrawer/NewValueInput';
import { Metadata, getListSubtypeTitle, stringifyListType } from '@/pages/lists/helpers';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import { notEmpty } from '@/utils/array';
import { AsyncResource, getOr, map } from '@/utils/asyncResource';
import { getErrorMessage } from '@/utils/lang';
import { CursorPaginatedData, useCursorQuery } from '@/utils/queries/hooks';
import { LISTS_ITEM_TYPE } from '@/utils/queries/keys';
import { QueryResult } from '@/utils/queries/types';
import { makeUrl, useNavigationParams } from '@/utils/routing';
import { StatePair } from '@/utils/state';
import { Resource } from '@/utils/user-utils';

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
  listHeaderRes: AsyncResource<ListHeaderInternal>;
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

const DEFAULT_LIST_DATA: CursorPaginatedData<TableItem> = {
  items: [],
  count: 0,
  limit: 0,
  hasNext: false,
  hasPrev: false,
  next: undefined,
  prev: undefined,
  last: undefined,
};

export default function ItemsTable(props: Props) {
  const { listId, listType, listHeaderRes, clearListMutation, onImportCsv } = props;

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

  const requiredWriteResources: Resource[] = useMemo(
    () =>
      listType === 'WHITELIST' ? ['write:::lists/whitelist/*'] : ['write:::lists/blacklist/*'],
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

  const [params, setParams] = useNavigationParams<AllParams<TableParams>>({
    queryAdapter: queryAdapter,
    makeUrl: (rawQueryParams) =>
      makeUrl(
        '/lists/:type/:listId',
        {
          type: stringifyListType(listType),
          listId: listId,
        },
        rawQueryParams,
      ),
    replace: true,
  });

  const listSubtype = getOr(
    map(listHeaderRes, ({ subtype }) => subtype),
    null,
  );

  const filterKeys = useMemo(() => {
    if (listSubtype === 'USER_ID' && params.userId != null) {
      return [params.userId];
    } else if (listSubtype === 'COUNTRY' && params.country != null) {
      return params.country;
    } else if (params.search != null) {
      return [params.search];
    }
    return undefined;
  }, [listSubtype, params.userId, params.country, params.search]);

  const listResult: QueryResult<CursorPaginatedData<TableItem>> = useCursorQuery(
    LISTS_ITEM_TYPE(listId, listType, listSubtype, { ...params, filterKeys }),
    async ({ from }) => {
      const payload: DefaultApiGetWhiteListItemsRequest = {
        listId,
        start: params.from || from,
        pageSize: params.pageSize,
        filterKeys,
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
        ...(filterKeys == null
          ? [
              {
                rowKey: 'NEW',
                type: 'NEW' as const,
                value: [],
                reason: '',
                meta: {},
              },
            ]
          : []),
      ];
      return {
        ...response,
        items: data,
        total: response.count,
      };
    },
  );

  const externalState: ExternalState = {
    editUserData: [editUserData, setEditUserData],
    newUserData: [newUserData, setNewUserData],
    isEditUserLoading: [isEditUserLoading, setEditUserLoading],
    isUserDeleteLoading: [isUserDeleteLoading, setEditDeleteLoading],
    onAdd: handleAddItem,
    onSave: handleSaveItem,
    onDelete: handleDeleteUser,
  };

  const extraFilters = useExtraFilters(listSubtype);

  const columns = useColumns({
    listSubtype,
    listResult,
    isAddUserLoading,
    isNewUserValid,
    isEditUserValid,
    requiredWritePermissions,
    requiredWriteResources,
  });

  return (
    <AsyncResourceRenderer resource={listHeaderRes}>
      {(listHeader) => {
        const listSubtype = listHeader.subtype;
        return (
          <QueryResultsTable<TableItem, CommonParams>
            tableId={`list-items-table-${listSubtype}`}
            rowKey="rowKey"
            innerRef={tableRef}
            columns={columns}
            params={params}
            onChangeParams={setParams}
            queryResults={listResult}
            fitHeight
            sizingMode="SCROLL"
            externalState={externalState}
            extraFilters={extraFilters}
            extraTools={[
              () => <Button onClick={onImportCsv}>Import CSV</Button>,
              () => (
                <Button
                  type="TETRIARY"
                  onClick={() => clearListMutation.mutate()}
                  isDisabled={clearListMutation.isLoading}
                  requiredPermissions={requiredWritePermissions}
                  requiredResources={requiredWriteResources}
                >
                  Clear list
                </Button>
              ),
            ]}
          />
        );
      }}
    </AsyncResourceRenderer>
  );
}

/*
  Helpers
*/
function useColumns(options: {
  listSubtype: ListSubtypeInternal | null;
  listResult: QueryResult<CursorPaginatedData<TableItem>>;
  isAddUserLoading: boolean;
  isNewUserValid: boolean;
  isEditUserValid: boolean;
  requiredWritePermissions: Permission[];
  requiredWriteResources: Resource[];
}): TableColumn<TableItem>[] {
  const {
    listSubtype,
    listResult,
    isAddUserLoading,
    isNewUserValid,
    isEditUserValid,
    requiredWritePermissions,
    requiredWriteResources,
  } = options;
  const settings = useSettings();

  const currentItems = getOr(listResult.data, DEFAULT_LIST_DATA).items;

  const existingCountryCodes = useMemo(() => {
    if (listSubtype !== 'COUNTRY') {
      return new Set<string>();
    }
    const codes = new Set<string>();
    currentItems.forEach((item) => {
      if (item.type === 'EXISTED' && item.value) {
        const values = Array.isArray(item.value) ? item.value : [item.value];
        values.forEach((code) => codes.add(code));
      }
    });
    return codes;
  }, [currentItems, listSubtype]);

  return useMemo(() => {
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
                      excludeCountries={existingCountryCodes}
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
                    autoFocus
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
                    autoFocus
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
                    requiredResources={requiredWriteResources}
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
                      requiredResources={requiredWriteResources}
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
                      const editTarget: ExistedTableItemData = {
                        value: entity.value,
                        reason: entity.reason,
                        meta: entity.meta,
                      };
                      setEditUserData(editTarget);
                    }}
                    requiredPermissions={requiredWritePermissions}
                    requiredResources={requiredWriteResources}
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
                    requiredResources={requiredWriteResources}
                  >
                    Remove
                  </Button>
                </div>
              );
            }
            return null;
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
    requiredWriteResources,
    settings,
    existingCountryCodes,
  ]);
}

function useExtraFilters(listSubtype: ListSubtypeInternal | null): ExtraFilterProps<TableParams>[] {
  const settings = useSettings();
  return useMemo((): ExtraFilterProps<TableParams>[] => {
    if (listSubtype === 'USER_ID') {
      return [
        {
          kind: 'EXTRA',
          title: `${firstLetterUpper(settings.userAlias)} ID/name`,
          key: 'userId',
          showFilterByDefault: true,
          renderer: ({ params, setParams }) => (
            <UserSearchButton
              userId={params.userId ?? null}
              onConfirm={(userId) => {
                setParams((state) => ({
                  ...state,
                  userId: userId ?? undefined,
                }));
              }}
            />
          ),
        },
      ];
    } else if (listSubtype === 'COUNTRY') {
      return [
        {
          kind: 'EXTRA',
          title: 'Country',
          key: 'country',
          showFilterByDefault: true,
          renderer: {
            kind: 'select',
            options: Object.entries(COUNTRIES).map(([isoCode, country]) => ({
              value: isoCode,
              label: country,
            })),
            mode: 'MULTIPLE',
            displayMode: 'select',
          },
        },
      ];
    }
    return [
      {
        kind: 'EXTRA',
        title: listSubtype ? getListSubtypeTitle(listSubtype, settings) : 'Search',
        key: 'search',
        showFilterByDefault: true,
        renderer: {
          kind: 'string',
        },
      },
    ];
  }, [listSubtype, settings]);
}
