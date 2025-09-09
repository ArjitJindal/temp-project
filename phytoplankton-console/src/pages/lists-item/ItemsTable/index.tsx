import { COUNTRIES } from '@flagright/lib/constants';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { UseMutationResult } from '@tanstack/react-query';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Resource } from '@flagright/lib/utils';
import ImportCsvModal from '../ImportCsvModal';
import { queryAdapter } from './helpers';
import s from './index.module.less';
import { TableParams } from './types';
import { useApi } from '@/api';
import { ListHeaderInternal, ListSubtypeInternal, ListType } from '@/apis';
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
import { NUMBER, DATE, STRING } from '@/components/library/Table/standardDataTypes';
import { download } from '@/utils/browser';

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
  isCustomList: boolean;
  setIsFlatFileProgressLoading: (isLoading: boolean) => void;
}

// ExternalState removed

const helper = new ColumnHelper<TableItem>();

function isNewItem(value: unknown): value is NewTableItem {
  return typeof value === 'object' && value != null && (value as any).type === 'NEW';
}
function isExistedItem(value: unknown): value is ExistedTableItem {
  return typeof value === 'object' && value != null && (value as any).type === 'EXISTED';
}
function isNewDraft(value: unknown): value is NewTableItemData {
  if (typeof value !== 'object' || value == null) {
    return false;
  }
  const v: any = value;
  return Array.isArray(v.value) && typeof v.reason === 'string' && typeof v.meta === 'object';
}

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
  const {
    listId,
    listType,
    listHeaderRes,
    clearListMutation,
    isCustomList,
    setIsFlatFileProgressLoading,
  } = props;
  const api = useApi();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const generateTemplateMutation = useCallback(async () => {
    const columns = getOr<Partial<ListHeaderInternal>>(listHeaderRes, {}).metadata?.columns ?? [];
    const listId = getOr<Partial<ListHeaderInternal>>(listHeaderRes, {}).listId ?? '';
    const response = await api.postFlatFilesGenerateTemplate({
      FlatFileTemplateRequest: {
        format: 'CSV',
        schema: 'CUSTOM_LIST_UPLOAD',
        metadata: { items: columns, listId },
      },
    });

    download(`${listId}-template.csv`, response.fileString ?? '');
  }, [listHeaderRes, api]);

  const [editUserData, setEditUserData] = useState<ExistedTableItemData | null>(null);
  // creation row state managed by Table via rowApi

  const requiredWriteResources: Resource[] = useMemo(() => {
    if (listType === 'WHITELIST') {
      return ['write:::lists/whitelist/*'];
    } else if (listType === 'BLACKLIST') {
      return ['write:::lists/blacklist/*'];
    }
    return [];
  }, [listType]);

  const tableRef = useRef<TableRefType>(null);

  const listSubtype = getOr(
    map(listHeaderRes, ({ subtype }) => subtype),
    null,
  );

  const getColumns = useMemo(
    () =>
      getOr(
        map(listHeaderRes, (header) => header.metadata?.columns),
        [],
      ),
    [listHeaderRes],
  );

  const validateMetaFields = useCallback(
    (meta: Record<string, any> | undefined) => {
      const columns = getColumns;
      if (!columns || columns.length === 0) {
        return true;
      }

      return columns.every((column) => {
        const columnName = column?.key;
        if (!columnName) {
          return true;
        }

        if (!meta) {
          return false;
        }

        return meta[columnName] != null && meta[columnName] != '';
      });
    },
    [getColumns],
  );

  const isEditUserDataValid = useMemo(() => {
    if (!editUserData) {
      return false;
    }

    if (listSubtype === 'CUSTOM') {
      return validateMetaFields(editUserData.meta);
    }

    return true;
  }, [editUserData, listSubtype, validateMetaFields]);

  // validation for creation row handled inline using rowApi draft

  const [isAddUserLoading, setAddUserLoading] = useState(false);

  const handleAddItemFromDraft = useCallback(
    (newUserData: NewTableItemData) => {
      const hideMessage = message.loading('Adding item to a list...');
      const isValid =
        listSubtype === 'CUSTOM'
          ? validateMetaFields(newUserData.meta)
          : (Array.isArray(newUserData.value)
              ? newUserData.value.length
              : (newUserData.value as unknown as string | undefined)?.trim()?.length ?? 0) > 0;
      if (!isValid) {
        hideMessage();
        return;
      }
      setAddUserLoading(true);
      const values: string[] = Array.isArray(newUserData.value)
        ? (newUserData.value as string[])
        : [String(newUserData.value ?? '')];
      Promise.all(
        values.map((itemValue) => {
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
          message.success(`Item added successfully`);
          tableRef.current?.reload();
        })
        .catch((e) => {
          hideMessage();
          message.fatal(`Unable to add an item to a list! ${getErrorMessage(e)}`, e);
        })
        .finally(() => {
          setAddUserLoading(false);
        });
    },
    [listSubtype, validateMetaFields, listId, api, listType],
  );

  const handleSaveItem = () => {
    if (isEditUserDataValid && editUserData) {
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
        });
    }
  };

  const handleDeleteUser = useCallback(
    (userId: string) => {
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

      const data: TableItem[] = response.items.map(
        ({ key, metadata }): TableItem => ({
          rowKey: key,
          type: 'EXISTED',
          value: key,
          reason: metadata?.reason ?? '',
          meta: metadata ?? {},
        }),
      );
      return {
        ...response,
        items: data,
        total: response.count,
      };
    },
  );

  const extraFilters = useExtraFilters(listSubtype);

  const columns = useColumns({
    listSubtype,
    listResult,
    isAddUserLoading,
    isEditUserValid: isEditUserDataValid,
    requiredWriteResources,
    listHeaderRes,
    isCustomList,
    onDelete: handleDeleteUser,
  });

  // externalState no longer used; kept locally for in-file helpers only

  return (
    <AsyncResourceRenderer resource={listHeaderRes}>
      {(listHeader) => {
        const listSubtype = listHeader.subtype;
        return (
          <>
            <QueryResultsTable<TableItem, CommonParams>
              tableId={`list-items-table-${listSubtype}`}
              rowKey="rowKey"
              innerRef={tableRef}
              columns={columns}
              hideFilters={listSubtype === 'CUSTOM'}
              sizingMode="FULL_WIDTH"
              params={params}
              onChangeParams={setParams}
              queryResults={listResult}
              fitHeight
              createRow={{
                item: {
                  rowKey: 'NEW',
                  type: 'NEW' as const,
                  value: [],
                  reason: '',
                  meta: {},
                },
                visible: true,
                position: 'BOTTOM',
                onSubmit: (newItem: TableItem) => {
                  if (isNewItem(newItem)) {
                    handleAddItemFromDraft(newItem);
                  }
                },
              }}
              rowEditing={{
                onSave: (_id, edited: TableItem) => {
                  if (isExistedItem(edited)) {
                    setEditUserData(edited);
                  }
                  handleSaveItem();
                },
                onCancel: () => setEditUserData(null),
              }}
              extraFilters={extraFilters}
              extraTools={[
                () => <Button onClick={() => setIsImportModalOpen(true)}>Import CSV</Button>,
                ...(listSubtype === 'CUSTOM' && listHeader?.metadata?.columns?.length
                  ? [
                      () => (
                        <Button type="SECONDARY" onClick={generateTemplateMutation}>
                          Generate template
                        </Button>
                      ),
                    ]
                  : []),
                () => (
                  <Button
                    type="TETRIARY"
                    onClick={() => clearListMutation.mutate()}
                    isDisabled={clearListMutation.isLoading}
                    requiredResources={requiredWriteResources}
                  >
                    Clear list
                  </Button>
                ),
              ]}
            />
            <ImportCsvModal
              listId={listId}
              isOpen={isImportModalOpen}
              onClose={() => {
                setIsImportModalOpen(false);
                listResult.refetch();
              }}
              listType={listType as 'WHITELIST' | 'BLACKLIST'}
              isCustomList={isCustomList}
              setIsFlatFileProgressLoading={setIsFlatFileProgressLoading}
            />
          </>
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
  isEditUserValid: boolean;
  listHeaderRes: AsyncResource<ListHeaderInternal>;
  requiredWriteResources: Resource[];
  isCustomList: boolean;
  onDelete: (userId: string) => void;
}): TableColumn<TableItem>[] {
  const {
    listSubtype,
    listResult,
    isAddUserLoading,
    isEditUserValid,
    requiredWriteResources,
    listHeaderRes,
    isCustomList,
    onDelete,
  } = options;
  const settings = useSettings();
  const listHeader = getOr(listHeaderRes, null);

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
    if (isCustomList) {
      const customColumns =
        (listHeader?.metadata?.columns ?? []).map((column) =>
          helper.simple<`meta.${string}`>({
            title: column.key || '',
            key: `meta.${column.key || ''}` as `meta.${string}`,
            type: (column.type === 'NUMBER'
              ? NUMBER
              : column.type === 'DATE'
              ? DATE
              : STRING) as any,
          }),
        ) || [];

      return helper.list([
        ...customColumns,
        helper.display({
          title: 'Actions',
          defaultWidth: 170,
          render: (entity, context) => {
            const rowApi = context.rowApi;
            if (rowApi?.isCreateRow) {
              const draft =
                (rowApi.getDraft?.() as NewTableItemData) ?? (entity as NewTableItemData);
              const isValid = (listHeader?.metadata?.columns ?? []).every((c) => {
                const key = c.key || '';
                const val = (draft.meta ?? {})[key];
                return val != null && String(val).trim() !== '';
              });
              return (
                <div className={s.actions}>
                  <Button
                    type="PRIMARY"
                    isLoading={isAddUserLoading}
                    isDisabled={!isValid}
                    onClick={() => rowApi?.save?.()}
                    requiredResources={requiredWriteResources}
                  >
                    Add
                  </Button>
                </div>
              );
            } else if (rowApi?.isEditing) {
              return (
                <div className={s.actions}>
                  <Button
                    size="SMALL"
                    type="PRIMARY"
                    onClick={() => rowApi?.save?.()}
                    isDisabled={!isEditUserValid}
                    requiredResources={requiredWriteResources}
                  >
                    Save
                  </Button>
                  <Button
                    size="SMALL"
                    type="SECONDARY"
                    onClick={() => rowApi?.cancelEdit?.()}
                    requiredResources={requiredWriteResources}
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
                  onClick={() => rowApi?.startEdit?.()}
                  requiredResources={requiredWriteResources}
                >
                  Edit
                </Button>
                <Button
                  size="SMALL"
                  type="SECONDARY"
                  onClick={() => onDelete(String(entity.value ?? ''))}
                  requiredResources={requiredWriteResources}
                >
                  Remove
                </Button>
              </div>
            );
          },
        }),
      ]);
    }

    return helper.list(
      [
        listSubtype != null &&
          helper.derived<string | string[]>({
            title: getListSubtypeTitle(listSubtype, settings),
            value: (item) => item.value,
            type: {
              render: (value, context) => {
                const { item: entity } = context;

                const rowApi = context.rowApi;
                if (rowApi?.isCreateRow) {
                  const maybe = rowApi?.getDraft?.();
                  const draft: NewTableItemData = isNewDraft(maybe)
                    ? maybe
                    : isNewItem(entity)
                    ? entity
                    : { value: [], reason: '', meta: {} };
                  return (
                    <NewValueInput
                      key={String(isAddUserLoading)}
                      value={draft.value}
                      onChange={(value) => {
                        rowApi?.setDraft?.({ ...draft, value: value ?? [] });
                      }}
                      onChangeMeta={(meta) => {
                        rowApi?.setDraft?.({ ...draft, meta });
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
        helper.simple<'reason'>({
          title: 'Reason for adding to list',
          key: 'reason',
          type: STRING,
        }),
        helper.display({
          title: 'Actions',
          defaultWidth: 170,
          render: (entity, context) => {
            const rowApi = context.rowApi;
            if (rowApi?.isCreateRow) {
              const maybe = rowApi.getDraft?.();
              const draft: NewTableItemData = isNewDraft(maybe)
                ? maybe
                : isNewItem(entity)
                ? entity
                : { value: [], reason: '', meta: {} };
              const isValid = (listHeader?.metadata?.columns ?? []).every((c) => {
                const key = c.key || '';
                const val = (draft.meta ?? {})[key];
                return val != null && String(val).trim() !== '';
              });
              return (
                <div className={s.actions}>
                  <Button
                    type="PRIMARY"
                    isLoading={isAddUserLoading}
                    isDisabled={!isValid}
                    onClick={() => rowApi?.save?.()}
                    requiredResources={requiredWriteResources}
                  >
                    Add
                  </Button>
                </div>
              );
            } else if (rowApi?.isEditing) {
              return (
                <div className={s.actions}>
                  <Button
                    size="SMALL"
                    type="PRIMARY"
                    onClick={() => rowApi?.save?.()}
                    isDisabled={!isEditUserValid}
                    requiredResources={requiredWriteResources}
                  >
                    Save
                  </Button>
                  <Button size="SMALL" type="SECONDARY" onClick={() => rowApi?.cancelEdit?.()}>
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
                  onClick={() => rowApi?.startEdit?.()}
                  requiredResources={requiredWriteResources}
                >
                  Edit
                </Button>
                <Button
                  size="SMALL"
                  type="SECONDARY"
                  onClick={() => onDelete(String(entity.value ?? ''))}
                  requiredResources={requiredWriteResources}
                >
                  Remove
                </Button>
              </div>
            );
          },
        }),
      ].filter(notEmpty),
    );
  }, [
    isAddUserLoading,
    isEditUserValid,
    listSubtype,
    isCustomList,
    requiredWriteResources,
    settings,
    existingCountryCodes,
    listHeader?.metadata?.columns,
    onDelete,
  ]);
}

function useExtraFilters(listSubtype: ListSubtypeInternal | null): ExtraFilterProps<TableParams>[] {
  const settings = useSettings();
  return useMemo((): ExtraFilterProps<TableParams>[] => {
    if (listSubtype === 'USER_ID') {
      return [
        {
          kind: 'EXTRA',
          title: `${firstLetterUpper(settings.userAlias)} ID`,
          key: 'userId',
          showFilterByDefault: true,
          renderer: ({ params, setParams }) => (
            <UserSearchButton
              userId={params.userId ?? null}
              params={params}
              onConfirm={setParams}
              filterType="id"
            />
          ),
        },
        {
          kind: 'EXTRA',
          title: `${firstLetterUpper(settings.userAlias)} name`,
          key: 'userName',
          showFilterByDefault: true,
          renderer: ({ params, setParams }) => (
            <UserSearchButton
              userId={params.userId ?? null}
              params={params}
              onConfirm={setParams}
              filterType="name"
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
