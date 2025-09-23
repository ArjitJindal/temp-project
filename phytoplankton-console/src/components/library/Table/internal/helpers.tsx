import * as TanTable from '@tanstack/react-table';
import {
  RowSelectionState,
  getFilteredRowModel,
  getPaginationRowModel,
} from '@tanstack/react-table';
import { ExpandedState } from '@tanstack/table-core';
import { sortBy } from 'lodash';
import React, { SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_COLUMN_WRAP_MODE,
  EXPAND_COLUMN,
  EXPAND_COLUMN_ID,
  SELECT_COLUMN,
  SELECT_COLUMN_ID,
} from '../consts';
import {
  AllParams,
  ColumnDataType,
  CommonParams,
  EditContext,
  FieldAccessor,
  SortingParamsItem,
  TableColumn,
  TableData,
  TableDataItem,
  TableDataSimpleItem,
  TableRow,
  ValueOf,
  applyFieldAccessor,
  flatColumns,
  getColumnId,
  isDerivedColumn,
  isDisplayColumn,
  isMultiRows,
  isSimpleColumn,
  setByFieldAccessor,
} from '../types';
import s from './index.module.less';
import { ColumnOrder, PersistedState, usePersistedSettingsContext } from './settings';
import { StatePair, Updater, applyUpdater } from '@/utils/state';
import { getPageCount } from '@/utils/queries/hooks';
import { makeRandomNumberGenerator } from '@/utils/prng';
import { getErrorMessage, isEqual } from '@/utils/lang';
import { AsyncResource, getOr, loading } from '@/utils/asyncResource';
import { UNKNOWN } from '@/components/library/Table/standardDataTypes';
import Skeleton, { shouldShowSkeleton } from '@/components/library/Skeleton';

export function useLocalStorageOptionally<Value extends PersistedState = PersistedState>(
  key: string | null,
  defaultValueFactory: () => Value,
  nonResizableColumns: string[],
): StatePair<Value> {
  const [state, setState] = useState<Value>(() => {
    if (key != null) {
      const storedValue: string | null = window.localStorage.getItem(key);
      try {
        if (storedValue != null) {
          // todo: validate parsed state and use default if invalid
          const parsedValue = JSON.parse(storedValue);
          const defaultValues = defaultValueFactory();
          if (parsedValue.columnSizing != null) {
            nonResizableColumns.forEach((columnId) => {
              parsedValue.columnSizing[columnId] = defaultValues.columnSizing[columnId];
            });
          }
          if (
            !isEqual(
              sortBy(parsedValue.columnOrderRestrictions),
              sortBy(defaultValues.columnOrderRestrictions),
            )
          ) {
            parsedValue.columnOrderRestrictions = defaultValues.columnOrderRestrictions;
          }

          if (!isEqual(sortBy(parsedValue.columnOrder), sortBy(defaultValues.columnOrder))) {
            parsedValue.columnOrder = defaultValues.columnOrder;
          }
          return { ...defaultValues, ...parsedValue };
        }
      } catch (e) {
        console.error(
          `Unable to parse localstorage state, use default value. ${getErrorMessage(e)}`,
        );
      }
    }
    return defaultValueFactory();
  });
  const setValue = useCallback(
    (action: SetStateAction<Value>) => {
      setState((prevState) => {
        const newState = applyUpdater(prevState, action);
        if (key != null) {
          window.localStorage.setItem(key, JSON.stringify(newState));
        }
        return newState;
      });
    },
    [key],
  );

  return [state, setValue];
}

export function useTanstackTable<
  Item extends object,
  Params extends object = CommonParams,
>(options: {
  dataRes: AsyncResource<TableData<Item>>;
  rowKey: FieldAccessor<Item>;
  columns: TableColumn<Item>[];
  params: AllParams<Params>;
  onChangeParams: (newParams: AllParams<Params>) => void;
  onEdit: ((rowKey: string, newValue: Item) => void | Promise<void>) | undefined;
  selectedIds?: string[];
  partiallySelectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  isRowSelectionEnabled: boolean | ((row: TableRow<Item>) => boolean);
  isExpandable: boolean | ((row: TableRow<Item>) => boolean);
  isSortable: boolean;
  defaultSorting?: SortingParamsItem;
  onExpandedMetaChange?: (meta: { isAllExpanded: boolean }) => void;
  meta?: {
    onEdit?: ((rowKey: string, newValue: Item) => void | Promise<void>) | undefined;
    getRowApi?: (row: TanTable.Row<TableRow<Item>>) => any;
  };
}): TanTable.Table<TableRow<Item>> {
  const {
    dataRes,
    rowKey,
    columns,
    params,
    onChangeParams,
    onSelect,
    selectedIds,
    onEdit,
    isRowSelectionEnabled,
    isExpandable,
    isSortable,
    defaultSorting,
    onExpandedMetaChange,
    meta,
  } = options;
  const extraTableContext = usePersistedSettingsContext();
  const [columnOrder] = extraTableContext.columnOrder;
  const [__, setSortingPersisted] = extraTableContext.sort;
  const [expanded, setExpanded] = useState<TanTable.ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<TanTable.RowSelectionState>({});
  const [columnPinning, setColumnPinning] = extraTableContext.columnPinning;
  const [columnSizing, setColumnSizing] = extraTableContext.columnSizing;
  const [columnVisibility, setColumnVisibility] = extraTableContext.columnVisibility;
  const [columnOrderRestrictions] = extraTableContext.columnOrderRestrictions;

  const showSkeleton = shouldShowSkeleton(dataRes);
  const data = showSkeleton
    ? {
        items: [...new Array(10)].map(() => {
          return {} as Item;
        }),
      }
    : getOr(dataRes, { items: [] });

  const preparedData: TableRow<Item>[] = useMemo(() => {
    const visibleColumns = flatColumns(columns).filter((x) => {
      if ((isSimpleColumn(x) || isDerivedColumn(x)) && x.hideInTable) {
        return false;
      }
      return columnVisibility?.[getColumnId(x)] ?? true;
    });

    let rowIndex = 0;
    return (data.items ?? []).flatMap((item, itemIndex): TableRow<Item>[] => {
      if (isMultiRows(item)) {
        const rows = item.rows ?? [];
        // If all visible columns are spanned, no need to add empty rows - collapse into single row
        const allVisibleColumnsAreSpanned = visibleColumns.every((column) => {
          return item.spanBy.includes(getColumnId(column));
        });
        if (allVisibleColumnsAreSpanned) {
          const firstRow = rows[0];
          return firstRow
            ? [
                {
                  spanBy: [],
                  content: rows[0],
                  rowsCount: 1,
                  rowIndex: rowIndex++,
                  itemIndex: itemIndex,
                  isFirstRow: true,
                  isLastRow: true,
                },
              ]
            : [];
        }

        return rows.map((row, i) => ({
          spanBy: [...item.spanBy, 'SELECT_COLUMN_ID'],
          content: row,
          rowsCount: rows.length,
          rowIndex: rowIndex++,
          itemIndex: itemIndex,
          isFirstRow: i === 0,
          isLastRow: i === rows.length - 1,
        }));
      } else {
        return [
          {
            spanBy: [],
            content: item,
            rowsCount: 1,
            rowIndex: rowIndex++,
            itemIndex: itemIndex,
            isFirstRow: true,
            isLastRow: true,
          },
        ];
      }
    });
  }, [data.items, columns, columnVisibility]);

  const isAnythingExpandable =
    !showSkeleton &&
    (typeof isExpandable === 'boolean' ? isExpandable : preparedData.some((x) => isExpandable(x)));
  const isAnythingSelectable =
    !showSkeleton &&
    (typeof isRowSelectionEnabled === 'boolean'
      ? isRowSelectionEnabled
      : preparedData.some((x) => isRowSelectionEnabled(x)));

  const columnDefs = useMemo(() => {
    const columnHelper = TanTable.createColumnHelper<TableRow<Item>>();

    function convertColumns(columns: TableColumn<Item>[]): TanTable.ColumnDef<TableRow<Item>>[] {
      return columns
        .filter((x) => (!isSimpleColumn(x) && !isDerivedColumn(x)) || x.hideInTable !== true)
        .map(convertColumn);
    }

    function convertColumn(column: TableColumn<Item>): TanTable.ColumnDef<TableRow<Item>> {
      const columnId = getColumnId(column);
      if (isSimpleColumn(column)) {
        const columnDataType = {
          ...UNKNOWN,
          ...column.type,
        };
        const accessor = `content.${column.key}` as FieldAccessor<TableRow<Item>>;
        return columnHelper.accessor(accessor, {
          id: columnId,
          header: column.title,
          enableResizing: column.enableResizing ?? true,
          enableSorting: column.sorting === true || column.sorting === 'desc',
          sortDescFirst: column.sorting === 'desc',
          cell: (showSkeleton ? SkeletonCell : SimpleColumnCellComponent) as any,
          meta: {
            rowKey: rowKey,
            column: column,
            wrapMode: columnDataType.defaultWrapMode ?? DEFAULT_COLUMN_WRAP_MODE,
            tooltip: column.tooltip,
            subtitle: column.subtitle,
          },
        }) as TanTable.ColumnDef<TableRow<Item>>;
      } else if (isDisplayColumn(column)) {
        return columnHelper.display({
          id: columnId,
          header: column.title,
          cell: showSkeleton ? SkeletonCell : DisplayColumnCellComponent,
          enableResizing: column.enableResizing ?? true,
          meta: {
            rowKey: rowKey,
            column: column,
            wrapMode: DEFAULT_COLUMN_WRAP_MODE,
            tooltip: column.tooltip,
            subtitle: column.subtitle,
          },
        });
      } else if (isDerivedColumn(column)) {
        const columnDataType = {
          ...UNKNOWN,
          ...column.type,
        };
        return columnHelper.display({
          id: columnId,
          header: column.title,
          enableResizing: column.enableResizing ?? true,
          cell: showSkeleton ? SkeletonCell : DerivedColumnCellComponent,
          meta: {
            column: column,
            wrapMode: columnDataType.defaultWrapMode ?? DEFAULT_COLUMN_WRAP_MODE,
            tooltip: column.tooltip,
            subtitle: column.subtitle,
          },
        });
      } else {
        return columnHelper.group({
          id: columnId,
          header: column.title,
          columns: convertColumns(column.children),
          enableResizing: column.enableResizing ?? true,
          meta: {
            wrapMode: DEFAULT_COLUMN_WRAP_MODE,
            tooltip: column.tooltip,
            subtitle: column.subtitle,
          },
        });
      }
    }

    return convertColumns(columns);
  }, [showSkeleton, rowKey, columns]);

  const sorting = useMemo(
    () =>
      params.sort.map(([id, sortOrder]) => ({
        id,
        desc: sortOrder === 'descend',
      })),
    [params.sort],
  );

  const handleChangeSorting = useCallback(
    (changes: Updater<TanTable.SortingState>) => {
      const newState: TanTable.SortingState = applyUpdater(sorting, changes);
      const newSort: SortingParamsItem[] =
        newState.length === 0 && defaultSorting != null
          ? [defaultSorting]
          : newState.map(({ id, desc }) => [id, desc ? 'descend' : 'ascend']);
      onChangeParams({
        ...params,
        sort: newSort,
      });
      setSortingPersisted(newSort);
    },
    [sorting, onChangeParams, params, defaultSorting, setSortingPersisted],
  );

  const columnOrderAdapted: ColumnOrder = useMemo(() => {
    const result = columnOrder.flatMap((id): string[] => {
      const columnDef = columnDefs.find((columnDef) => columnDef.id === id);
      if (columnDef == null || !('columns' in columnDef)) {
        return [id ?? ''];
      }
      return columnDef.columns?.map((column): string => column.id ?? '') ?? [];
    });
    return [
      ...(isAnythingExpandable ? [EXPAND_COLUMN_ID] : []),
      ...(isAnythingSelectable ? [SELECT_COLUMN_ID] : []),
      ...columnOrderRestrictions,
      ...result,
    ];
  }, [
    isAnythingSelectable,
    isAnythingExpandable,
    columnDefs,
    columnOrder,
    columnOrderRestrictions,
  ]);

  const allColumns = useMemo(
    (): TanTable.ColumnDef<TableRow<Item>, any>[] => [
      ...(isAnythingExpandable ? [EXPAND_COLUMN<Item>()] : []),
      ...(isAnythingSelectable ? [SELECT_COLUMN<Item>()] : []),
      ...columnDefs.filter((column) => column.id && columnOrderRestrictions.includes(column.id)),
      ...columnDefs.filter((column) => column.id && !columnOrderRestrictions.includes(column.id)),
    ],
    [isAnythingExpandable, isAnythingSelectable, columnDefs, columnOrderRestrictions],
  );
  const paginationState = {
    pageSize: params.pageSize,
    pageIndex: params.page ? params.page - 1 : 0,
  };

  useEffect(() => {
    setRowSelection((prev) => {
      return selectedIds?.reduce((r, id) => ({ ...r, [id]: true }), {}) ?? prev;
    });
  }, [setRowSelection, selectedIds]);

  const table = TanTable.useReactTable<TableRow<Item>>({
    meta: {
      onEdit,
      ...(meta ?? {}),
    },
    data: preparedData,
    columns: allColumns,
    getRowId: (originalRow: TableRow<Item>, index): string => {
      return showSkeleton
        ? `skeleton_${index}`
        : `${applyFieldAccessor(originalRow.content, rowKey as FieldAccessor<Item>)}`;
    },

    getCoreRowModel: TanTable.getCoreRowModel(),
    getRowCanExpand: (row: TanTable.Row<TableRow<Item>>) => {
      return typeof isExpandable === 'boolean' ? isExpandable : isExpandable(row.original);
    },
    manualSorting: isSortable,
    enableSorting: isSortable,
    manualPagination: true,
    enableColumnResizing: true,
    enablePinning: true,
    enableHiding: true,
    pageCount: getPageCount(params, data),
    enableRowSelection:
      typeof isRowSelectionEnabled === 'boolean'
        ? isRowSelectionEnabled
        : (row) => isRowSelectionEnabled(row.original),
    enableExpanding: isAnythingExpandable,
    state: {
      sorting: sorting,
      expanded: expanded,
      pagination: paginationState,
      rowSelection: rowSelection,
      columnVisibility: columnVisibility,
      columnSizing: columnSizing,
      columnPinning: columnPinning,
      columnOrder: columnOrderAdapted,
    },
    getExpandedRowModel: TanTable.getExpandedRowModel(),
    onSortingChange: handleChangeSorting,
    onColumnOrderChange: () => {
      throw new Error(
        `This operation is a noop, column order is controlled manually. Use ExtraTableContext instead`,
      );
    },
    onExpandedChange: (updater: Updater<ExpandedState>) => {
      setExpanded((prevState) => {
        const newState = applyUpdater(prevState, updater);
        if (typeof newState === 'boolean' || typeof prevState === 'boolean') {
          return newState;
        }
        return Object.entries(newState)
          .filter(([key, isExpanded]) => isExpanded && !(key in prevState))
          .reduce((acc, [key, isExpanded]) => ({ ...acc, [key]: isExpanded }), {});
      });
    },
    columnResizeMode: 'onEnd',
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: setColumnPinning,
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: (updaterOrValue) => {
      const updatedState = applyUpdater(paginationState, updaterOrValue);
      onChangeParams({
        ...params,
        pageSize: updatedState.pageSize,
        page: updatedState.pageIndex + 1,
      });
    },
    onRowSelectionChange: (updater) => {
      if (isEqual(updater, {})) {
        return;
      }
      const selectFn = (newState: RowSelectionState) => {
        onSelect &&
          onSelect(
            Object.entries(newState)
              .filter(([_, selected]) => selected)
              .map(([id]) => id),
          );
      };
      if (typeof updater === 'function') {
        setRowSelection((prevState) => {
          const newState = updater(prevState);
          selectFn(newState);
          return newState;
        });
      } else {
        selectFn(updater);
        setRowSelection(updater);
      }
    },
  });

  const isAllExpanded = table.getIsAllRowsExpanded();
  const isAllExpandedPrev = table.getIsAllRowsExpanded();
  useEffect(() => {
    if (!isEqual(isAllExpanded, isAllExpandedPrev)) {
      onExpandedMetaChange?.({ isAllExpanded });
    }
  }, [isAllExpanded, isAllExpandedPrev, onExpandedMetaChange]);

  return table;
}

type CellComponentProps<Item, Value = unknown> = TanTable.CellContext<TableRow<Item>, Value>;

const SkeletonCell = (props: CellComponentProps<any>) => {
  const hashCode = props.cell.id
    .split('')
    .map((x) => x.charCodeAt(0))
    .reduce((acc, x) => acc * x, 1);
  const random = makeRandomNumberGenerator(hashCode % Number.MAX_SAFE_INTEGER);
  return <Skeleton length={4 + Math.round(10 * random())} res={loading()} />;
};

function SimpleColumnCellComponent<Item extends object, Accessor extends FieldAccessor<Item>>(
  props: CellComponentProps<Item, ValueOf<Accessor>>,
) {
  type Value = ValueOf<Accessor>;

  const { column, rowKey } = props.column.columnDef.meta;
  const onEdit = props.table.options.meta.onEdit;
  const value: Value = props.getValue();
  const id = applyFieldAccessor(props.row.original.content, rowKey as FieldAccessor<Item>);

  const columnDataType = {
    ...UNKNOWN,
    ...column.type,
  } as ColumnDataType<Value, Item>;

  const rowApi = props.table.options.meta?.getRowApi?.(props.cell.row);
  const isRowEditing = Boolean(rowApi?.isCreateRow || rowApi?.isEditing);
  const isBusy = Boolean(rowApi?.isBusy);
  const draftItem: Item = (rowApi?.getDraft?.() as Item) ?? props.row.original.content;
  const currentValue: Value = isRowEditing
    ? (applyFieldAccessor(draftItem, column.key as FieldAccessor<Item>) as Value)
    : value;

  const proxyEditContext = {
    isEditing: isRowEditing,
    toggleEditing: () => {},
    state: [currentValue, (_updater: any) => {}] as any,
    isBusy: isBusy,
    onConfirm: async (newValue: Value) => {
      if (rowApi?.setDraft) {
        const updated = setByFieldAccessor(draftItem, column.key, newValue as any);
        rowApi.setDraft(updated as any);
        return;
      }
      if (onEdit) {
        const newItem = setByFieldAccessor(props.row.original.content, column.key, newValue);
        const promise = onEdit?.(id as any, newItem as any);
        if (promise != null && promise instanceof Promise) {
          await promise;
        }
      }
    },
  } as EditContext<Value | undefined> as any;

  const legacyEditContext = useEditContext<Value | undefined>(
    (onEdit != null && column.defaultEditState) ?? false,
    value,
    async (newValue) => {
      const newItem = setByFieldAccessor(props.row.original.content, column.key, newValue);
      const promise = onEdit?.(id, newItem);
      if (promise != null && promise instanceof Promise) {
        await promise;
      }
    },
  );

  const itemContext = {
    value: currentValue,
    item: draftItem,
    edit: isRowEditing ? proxyEditContext : legacyEditContext,
    external: undefined,
    rowApi: rowApi,
  };

  return (
    <div className={s.columnCellComponentContainer}>
      {(isRowEditing || legacyEditContext.isEditing) && columnDataType.renderEdit
        ? columnDataType.renderEdit(itemContext)
        : columnDataType.render?.(value, itemContext)}
    </div>
  );
}

function DerivedColumnCellComponent<Item extends object>(props: CellComponentProps<Item>) {
  const { column } = props.column.columnDef.meta;
  const columnDataType = {
    ...UNKNOWN,
    ...column.type,
  };

  const columnValue = column.value(props.row.original.content);
  const editContext = useEditContext<unknown>(
    false, // derived columns doesn't support editing
    props.row.original.content,
    async () => {},
  );
  const cellContext = {
    value: columnValue,
    item: props.row.original.content,
    edit: editContext,
    external: undefined,
    rowApi: props.table.options.meta?.getRowApi?.(props.cell.row),
  };
  return (
    <div className={s.columnCellComponentContainer} key={`${props.row.id}-${columnValue}`}>
      {editContext.isEditing && columnDataType.renderEdit
        ? columnDataType.renderEdit(cellContext)
        : columnDataType.render?.(columnValue, cellContext)}
    </div>
  );
}

function DisplayColumnCellComponent<Item extends object>(props: CellComponentProps<Item>) {
  const { column, rowKey } = props.column.columnDef.meta;
  const id = applyFieldAccessor(props.row.original.content, rowKey);
  const onEdit = props.table.options.meta.onEdit;
  const editContext = useEditContext<Item>(
    (onEdit != null && column.defaultEditState) ?? false,
    props.row.original.content,
    async (state) => {
      await onEdit?.(id, state);
    },
  );

  return (
    <div className={s.columnCellComponentContainer}>
      {column.render(props.row.original.content, {
        item: props.row.original.content,
        edit: editContext,
        external: undefined,
        rowApi: props.table.options.meta?.getRowApi?.(props.cell.row),
      })}
    </div>
  );
}

function useEditContext<T>(
  isEditByDefault: boolean,
  defaultState: T,
  onConfirm: (state: T) => Promise<void>,
): EditContext<T> {
  const [isEditing, setEditing] = useState(isEditByDefault ?? false);
  const [isBusy, setIsBusy] = useState(false);
  const [editState, setEditState] = useState(defaultState);
  return {
    isEditing: isEditing,
    toggleEditing: (newValue) => {
      setEditing((oldValue) => (newValue == null ? !oldValue : newValue));
      if ((newValue == null && isEditing) || newValue === false) {
        setEditState(defaultState);
      }
    },
    state: [
      editState,
      (updater: Updater<T>) => {
        setEditState((state) => applyUpdater(state, updater));
      },
    ],
    isBusy,
    onConfirm: async (value) => {
      setIsBusy(true);
      try {
        await onConfirm(value != null ? value : editState);
        if (value != null) {
          setEditState(value);
        }
      } finally {
        setIsBusy(false);
      }
    },
  };
}

export function flatDataItems<T extends object>(
  data: Array<TableDataItem<T>>,
): TableDataSimpleItem<T>[] {
  const result: TableDataSimpleItem<T>[] = [];
  for (let i = 0; i < data.length; i += 1) {
    const datum = data[i];
    if (isMultiRows<T>(datum)) {
      for (let j = 0; j < datum.rows.length; j += 1) {
        const row: T = datum.rows[j];
        result.push(row);
      }
    } else {
      result.push(datum);
    }
  }
  return result;
}
