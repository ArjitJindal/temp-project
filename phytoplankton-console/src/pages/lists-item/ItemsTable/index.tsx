import { COUNTRIES } from '@flagright/lib/constants';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { UseMutationResult } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Resource } from '@flagright/lib/utils';
import ImportCsvModal from '../ImportCsvModal';
import { queryAdapter } from './helpers';
import s from './index.module.less';
import { TableParams } from './types';
import { useApi } from '@/api';
import { ColumnType, ListHeaderInternal, ListSubtypeInternal, ListType } from '@/apis';
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
import TextInput from '@/components/library/TextInput';
import { dayjs, YEAR_MONTH_DATE_FORMAT } from '@/utils/dayjs';
import NumberInput from '@/components/library/NumberInput';
import DatePicker from '@/components/ui/DatePicker';
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
  const [newUserData, setNewUserData] = useState<NewTableItemData>({
    value: [],
    reason: '',
    meta: {},
  });

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

  const isNewUserValid = useMemo(() => {
    if (!newUserData) {
      return false;
    }

    if (listSubtype === 'CUSTOM') {
      return validateMetaFields(newUserData.meta);
    }

    return newUserData.value.length > 0;
  }, [newUserData, listSubtype, validateMetaFields]);

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
    }
  }, [isNewUserValid, newUserData, listId, api, listType]);

  const [isEditUserLoading, setEditUserLoading] = useState(false);

  const handleSaveItem = () => {
    if (isEditUserDataValid && editUserData) {
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
    isEditUserValid: isEditUserDataValid,
    requiredWriteResources,
    listHeaderRes,
  });

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
              externalState={externalState}
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
  isNewUserValid: boolean;
  isEditUserValid: boolean;
  listHeaderRes: AsyncResource<ListHeaderInternal>;
  requiredWriteResources: Resource[];
}): TableColumn<TableItem>[] {
  const {
    listSubtype,
    listResult,
    isAddUserLoading,
    isNewUserValid,
    isEditUserValid,
    requiredWriteResources,
    listHeaderRes,
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
    if (listSubtype === 'CUSTOM') {
      const customColumns =
        listHeader?.metadata?.columns?.map((column) =>
          helper.derived({
            title: column.key || '',
            value: (item) => item.meta[column.key || ''] || '',
            type: {
              render: (value, context) => {
                const { item: entity } = context;
                const externalState: ExternalState = context.external as ExternalState;
                const [newUserData, setNewUserData] = externalState.newUserData;
                const [editUserData, setEditUserData] = externalState.editUserData;
                const columnName = column.key || '';

                if (entity.type === 'NEW') {
                  return renderInputForColumnType(
                    column.type,
                    newUserData.meta[columnName] || '',
                    (newValue) => {
                      setNewUserData((prevState) => ({
                        ...prevState,
                        value: prevState.value.length === 0 ? [uuidv4()] : prevState.value,
                        meta: {
                          ...prevState.meta,
                          [columnName]: newValue,
                        },
                      }));
                    },
                    isAddUserLoading,
                    columnName,
                  );
                } else if (editUserData?.value === entity.value) {
                  return renderInputForColumnType(
                    column.type,
                    editUserData.meta[columnName] || '',
                    (newValue) => {
                      setEditUserData({
                        ...editUserData,
                        meta: { ...editUserData.meta, [columnName]: newValue },
                      });
                    },
                    false,
                    columnName,
                  );
                }
                return (
                  <>
                    {column.type === 'DATE' ? dayjs(value).format(YEAR_MONTH_DATE_FORMAT) : value}
                  </>
                );
              },
            },
          }),
        ) || [];

      return helper.list([
        ...customColumns,
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
                    isDisabled={!isNewUserValid || !!editUserData}
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
                    isDisabled={isUserDeleteLoading}
                    onClick={() => {
                      const editTarget: ExistedTableItemData = {
                        value: entity.value,
                        reason: entity.reason,
                        meta: entity.meta,
                      };
                      setEditUserData(editTarget);
                    }}
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
                  <FocusRetainingInput
                    uniqueKey="new-reason-input"
                    isDisabled={isAddUserLoading}
                    value={newUserData.reason}
                    autoFocus
                    onChange={(value) => {
                      setNewUserData((prevState) => ({
                        ...prevState,
                        reason: value,
                      }));
                    }}
                  />
                );
              } else if (entity.value === editUserData?.value) {
                return (
                  <FocusRetainingInput
                    uniqueKey={`edit-reason-${entity.value}`}
                    isDisabled={isUserDeleteLoading}
                    value={editUserData.reason}
                    autoFocus
                    onChange={(value) => {
                      setEditUserData({ ...editUserData, reason: value });
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
    requiredWriteResources,
    settings,
    existingCountryCodes,
    listHeader?.metadata?.columns,
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

function FocusRetainingInput({
  value,
  onChange,
  isDisabled,
  autoFocus,
  uniqueKey,
}: {
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  autoFocus?: boolean;
  uniqueKey?: string;
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!isTypingRef.current && value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value, inputValue]);

  return (
    <TextInput
      key={uniqueKey}
      isDisabled={isDisabled}
      value={inputValue}
      autoFocus={autoFocus}
      onChange={(e) => {
        isTypingRef.current = true;
        setInputValue(e || '');
      }}
      onBlur={() => {
        setTimeout(() => {
          isTypingRef.current = false;
          onChange(inputValue);
        }, 50);
      }}
    />
  );
}

function FocusRetainingNumberInput({
  value,
  onChange,
  isDisabled,
  uniqueKey,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  isDisabled?: boolean;
  uniqueKey?: string;
}) {
  const [inputValue, setInputValue] = useState<number | undefined>(value);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!isTypingRef.current && value !== inputValue) {
      setInputValue(value);
    }
  }, [value, inputValue]);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <NumberInput
        key={uniqueKey}
        isDisabled={isDisabled}
        value={inputValue}
        onChange={(newValue) => {
          isTypingRef.current = true;
          setInputValue(newValue);
        }}
        onBlur={() => {
          setTimeout(() => {
            isTypingRef.current = false;
            onChange(inputValue);
          }, 50);
        }}
      />
    </div>
  );
}

function renderInputForColumnType<T>(
  columnType: ColumnType,
  value: T,
  onChange: (newValue: T) => void,
  isDisabled: boolean = false,
  columnName?: string,
) {
  switch (columnType) {
    case 'NUMBER':
      return (
        <FocusRetainingNumberInput
          uniqueKey={`column-number-${columnName || 'unknown'}`}
          isDisabled={isDisabled}
          value={value !== undefined ? Number(value) : undefined}
          onChange={(val) => onChange(val as T)}
        />
      );
    case 'DATE': {
      const dateValue = value ? dayjs(value as string) : null;
      return (
        <DatePicker
          disabled={isDisabled}
          value={dateValue}
          onChange={(date) => {
            onChange((date ? date.toISOString() : undefined) as T);
          }}
        />
      );
    }
    case 'STRING':
      return (
        <FocusRetainingInput
          uniqueKey={`column-${columnName || 'unknown'}-fallback`}
          isDisabled={isDisabled}
          value={value as string}
          onChange={(val) => onChange(val as T)}
        />
      );
  }
}
