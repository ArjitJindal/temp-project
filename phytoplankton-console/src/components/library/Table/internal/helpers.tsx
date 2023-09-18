import React, {
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as TanTable from '@tanstack/react-table';
import {
  getFilteredRowModel,
  getPaginationRowModel,
  RowSelectionState,
} from '@tanstack/react-table';
import { sortBy } from 'lodash';
import {
  AllParams,
  applyFieldAccessor,
  ColumnDataType,
  CommonParams,
  DerivedColumn,
  DisplayColumn,
  EditContext,
  FieldAccessor,
  getColumnId,
  isDerivedColumn,
  isDisplayColumn,
  isMultiRows,
  isSimpleColumn,
  setByFieldAccessor,
  SimpleColumn,
  SortingParamsItem,
  TableColumn,
  TableData,
  TableDataItem,
  TableDataSimpleItem,
  TableRow,
  ValueOf,
} from '../types';
import {
  DEFAULT_COLUMN_WRAP_MODE,
  EXPAND_COLUMN,
  EXPAND_COLUMN_ID,
  SELECT_COLUMN,
  SELECT_COLUMN_ID,
  SPACER_COLUMN,
} from '../consts';
import { ColumnOrder, usePersistedSettingsContext } from './settings';
import { ExternalStateContext } from './externalState';
import { getErrorMessage, isEqual } from '@/utils/lang';
import { UNKNOWN } from '@/components/library/Table/standardDataTypes';
import { AsyncResource, getOr } from '@/utils/asyncResource';
import { applyUpdater, StatePair, Updater } from '@/utils/state';
import { getPageCount } from '@/utils/queries/hooks';

export function useLocalStorageOptionally<Value>(
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
          const defaultValues = defaultValueFactory() as any;
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
          parsedValue.columnOrder = parsedValue.columnOrder.filter(
            (id: string) => !parsedValue.columnOrderRestrictions.includes(id),
          );
          return {
            ...(defaultValues as Value),
            ...(parsedValue as Value),
          };
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
  onEdit: ((rowKey: string, newValue: Item) => void) | undefined;
  selectedIds?: string[];
  partiallySelectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  isRowSelectionEnabled: boolean | ((row: TableRow<Item>) => boolean);
  isExpandable: boolean | ((row: TableRow<Item>) => boolean);
  isSortable: boolean;
  defaultSorting?: SortingParamsItem;
  onExpandedMetaChange?: (meta: { isAllExpanded: boolean }) => void;
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
  } = options;
  const extraTableContext = usePersistedSettingsContext();
  const [columnOrder] = extraTableContext.columnOrder;
  const [expanded, setExpanded] = useState<TanTable.ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<TanTable.RowSelectionState>({});
  const [columnPinning, setColumnPinning] = extraTableContext.columnPinning;
  const [columnSizing, setColumnSizing] = extraTableContext.columnSizing;
  const [columnVisibility, setColumnVisibility] = extraTableContext.columnVisibility;
  const [columnOrderRestrictions] = extraTableContext.columnOrderRestrictions;

  const data = getOr(dataRes, { items: [] });
  const preparedData: TableRow<Item>[] = useMemo(() => {
    let rowIndex = 0;
    return (data.items ?? []).flatMap((item, itemIndex): TableRow<Item>[] => {
      if (isMultiRows(item)) {
        const rows = item.rows ?? [];
        return rows.map((row, i) => ({
          spanBy: item.spanBy,
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
  }, [data.items]);

  const isAnythingExpandable =
    typeof isExpandable === 'boolean' ? isExpandable : preparedData.some((x) => isExpandable(x));
  const isAnythingSelectable =
    typeof isRowSelectionEnabled === 'boolean'
      ? isRowSelectionEnabled
      : preparedData.some((x) => isRowSelectionEnabled(x));

  const columnDefs = useMemo(() => {
    const columnHelper = TanTable.createColumnHelper<TableRow<Item>>();

    function convertColumns(columns: TableColumn<Item>[]): TanTable.ColumnDef<TableRow<Item>>[] {
      return columns.filter((x) => !isSimpleColumn(x) || x.hideInTable !== true).map(convertColumn);
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
          cell: makeSimpleColumnCellComponent({ column, rowKey }),
          meta: {
            wrapMode: columnDataType.defaultWrapMode ?? DEFAULT_COLUMN_WRAP_MODE,
            tooltip: column.tooltip,
            subtitle: column.subtitle,
          },
        }) as TanTable.ColumnDef<TableRow<Item>>;
      } else if (isDisplayColumn(column)) {
        return columnHelper.display({
          id: columnId,
          header: column.title,
          cell: makeDisplayColumnCellComponent({ column, rowKey }),
          enableResizing: column.enableResizing ?? true,
          meta: {
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
          cell: makeDerivedColumnCellComponent({ column }),
          meta: {
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
  }, [rowKey, columns]);

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
      onChangeParams({
        ...params,
        sort:
          newState.length === 0 && defaultSorting != null
            ? [defaultSorting]
            : newState.map(({ id, desc }) => [id, desc ? 'descend' : 'ascend']),
      });
    },
    [sorting, onChangeParams, params, defaultSorting],
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
    (): TanTable.ColumnDef<TableRow<Item>>[] => [
      ...(isAnythingExpandable ? [EXPAND_COLUMN as TanTable.ColumnDef<TableDataItem<Item>>] : []),
      ...(isAnythingSelectable ? [SELECT_COLUMN as TanTable.ColumnDef<TableDataItem<Item>>] : []),
      ...columnDefs.filter((column) => columnOrderRestrictions.includes(column.id as string)),
      ...(columnDefs.filter(
        (column) => !columnOrderRestrictions.includes(column.id as string),
      ) as any),
      SPACER_COLUMN,
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
    },
    data: preparedData,
    columns: allColumns,
    getRowId: (originalRow: TableRow<Item>): string => {
      return `${applyFieldAccessor(originalRow.content, rowKey as FieldAccessor<Item>)}`;
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
    onExpandedChange: setExpanded,
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
type CellComponent<Item> = React.FunctionComponent<CellComponentProps<Item>>;

function makeSimpleColumnCellComponent<
  Item extends object,
  Accessor extends FieldAccessor<Item>,
>(options: { column: SimpleColumn<Item, Accessor>; rowKey: FieldAccessor<Item> }) {
  const { column, rowKey } = options;
  const columnDataType = {
    ...UNKNOWN,
    ...column.type,
  } as ColumnDataType<ValueOf<Accessor>, Item>;

  type Value = ValueOf<Accessor>;
  return (props: CellComponentProps<Item, Value>) => {
    const onEdit = props.table.options.meta.onEdit;
    const value: Value = props.getValue();
    const id = applyFieldAccessor(props.row.original.content, rowKey as FieldAccessor<Item>);

    const editContext = useEditContext<Value | undefined>(
      (onEdit != null && column.defaultEditState) ?? false,
      value,
      (newValue) => {
        const newItem = setByFieldAccessor(props.row.original.content, column.key, newValue);
        onEdit?.(id, newItem);
      },
    );

    const itemContext = {
      value: value,
      item: props.row.original.content,
      edit: editContext,
    };

    return (
      <>
        {editContext.isEditing && columnDataType.renderEdit
          ? columnDataType.renderEdit(itemContext)
          : columnDataType.render?.(value, itemContext)}
      </>
    );
  };
}

function makeDerivedColumnCellComponent<Item extends object>(options: {
  column: DerivedColumn<Item>;
}): CellComponent<Item> {
  const { column } = options;
  const columnDataType = {
    ...UNKNOWN,
    ...column.type,
  };

  return (props: CellComponentProps<Item>) => {
    const columnValue = column.value(props.row.original.content);
    const editContext = useEditContext<unknown>(
      false, // derived columns doesn't support editing
      props.row.original.content,
      () => {},
    );
    const cellContext = {
      value: columnValue,
      item: props.row.original.content,
      edit: editContext,
    };
    return (
      <>
        {editContext.isEditing && columnDataType.renderEdit
          ? columnDataType.renderEdit(cellContext)
          : columnDataType.render?.(columnValue, cellContext)}
      </>
    );
  };
}

function makeDisplayColumnCellComponent<Item extends object>(options: {
  column: DisplayColumn<Item>;
  rowKey: FieldAccessor<Item>;
}): CellComponent<Item> {
  const { column, rowKey } = options;
  return (props: CellComponentProps<Item>) => {
    const id = applyFieldAccessor(props.row.original.content, rowKey as FieldAccessor<Item>);
    const onEdit = props.table.options.meta.onEdit;
    const externalState = useContext(ExternalStateContext);
    const editContext = useEditContext<Item>(
      (onEdit != null && column.defaultEditState) ?? false,
      props.row.original.content,
      (state) => {
        onEdit?.(id, state);
      },
    );

    return (
      <>
        {column.render(props.row.original.content, {
          item: props.row.original.content,
          edit: editContext,
          external: externalState?.value ?? null,
        })}
      </>
    );
  };
}

function useEditContext<T>(
  isEditByDefault: boolean,
  defaultState: T,
  onConfirm: (state: T) => void,
): EditContext<T> {
  const [isEditing, setEditing] = useState(isEditByDefault ?? false);
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
    onConfirm: (value) => {
      onConfirm(value != null ? value : editState);
      if (value != null) {
        setEditState(value);
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
