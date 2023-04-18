import { SetStateAction, useCallback, useMemo, useState } from 'react';
import * as TanTable from '@tanstack/react-table';
import { getFilteredRowModel, getPaginationRowModel } from '@tanstack/react-table';
import {
  AllParams,
  applyFieldAccessor,
  CommonParams,
  FieldAccessor,
  getColumnId,
  isDerivedColumn,
  isDisplayColumn,
  isMultiRows,
  isSimpleColumn,
  SortingParamsItem,
  TableColumn,
  TableData,
  TableDataItem,
  TableDataSimpleItem,
  TableRow,
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
import { getErrorMessage } from '@/utils/lang';
import { UNKNOWN } from '@/components/library/Table/standardDataTypes';
import { AsyncResource, getOr, init } from '@/utils/asyncResource';
import { applyUpdater, StatePair, Updater } from '@/utils/state';
import { getPageCount } from '@/utils/queries/hooks';

export function useLocalStorageOptionally<Value>(
  key: string | null,
  defaultValueFactory: () => Value,
): StatePair<Value> {
  const [state, setState] = useState<Value>(() => {
    if (key != null) {
      const storedValue: string | null = window.localStorage.getItem(key);
      try {
        if (storedValue != null) {
          // todo: validate parsed state and use default if invalid
          return {
            ...defaultValueFactory(),
            ...(JSON.parse(storedValue) as Value),
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

export function useTanstackTable<Item extends object, Params extends object = CommonParams>(
  dataRes: AsyncResource<TableData<Item>>,
  rowKey: FieldAccessor<Item>,
  columns: TableColumn<Item>[],
  params: AllParams<Params>,
  onChangeParams: (newParams: AllParams<Params>) => void,
  isRowSelectionEnabled: boolean,
  isExpandable: boolean,
  isSortable: boolean,
  defaultSorting?: SortingParamsItem,
): TanTable.Table<TableRow<Item>> {
  const extraTableContext = usePersistedSettingsContext();
  const [columnOrder] = extraTableContext.columnOrder;
  const [expanded, setExpanded] = useState<TanTable.ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<TanTable.RowSelectionState>({});
  const [columnPinning, setColumnPinning] = extraTableContext.columnPinning;
  const [columnSizing, setColumnSizing] = extraTableContext.columnSizing;
  const [columnVisibility, setColumnVisibility] = extraTableContext.columnVisibility;

  const columnDefs = useMemo(() => {
    const columnHelper = TanTable.createColumnHelper<TableRow<Item>>();

    function convertColumns(columns: TableColumn<Item>[]): TanTable.ColumnDef<TableRow<Item>>[] {
      return columns.filter((x) => !isSimpleColumn(x) || x.hideInTable !== true).map(convertColumn);
    }

    function convertColumn(column: TableColumn<Item>): TanTable.ColumnDef<TableRow<Item>> {
      if (isSimpleColumn(column)) {
        const columnDataType = {
          ...UNKNOWN,
          ...column.type,
        };
        const accessor = `content.${column.key}` as FieldAccessor<TableRow<Item>>;
        return columnHelper.accessor(accessor, {
          id: getColumnId(column),
          header: column.title,
          enableSorting: column.sorting === true || column.sorting === 'desc',
          sortDescFirst: column.sorting === 'desc',
          cell: (props: TanTable.CellContext<TableRow<Item>, unknown>) => {
            const value = props.getValue();
            return (
              <>
                {columnDataType.render?.(
                  value as any,
                  {
                    isSupported: false,
                    onChange: () => {
                      // todo: implement
                    },
                    statusRes: init(),
                  },
                  props.row.original.content,
                )}
              </>
            );
          },
          meta: {
            key: column.key as string,
            wrapMode: columnDataType.defaultWrapMode ?? DEFAULT_COLUMN_WRAP_MODE,
            tooltip: column.tooltip,
          },
        }) as TanTable.ColumnDef<TableRow<Item>>;
      } else if (isDisplayColumn(column)) {
        return columnHelper.display({
          id: getColumnId(column),
          header: column.title,
          cell: (props) => {
            return <>{column.render(props.row.original.content)}</>;
          },
          meta: {
            wrapMode: DEFAULT_COLUMN_WRAP_MODE,
            tooltip: column.tooltip,
          },
        });
      } else if (isDerivedColumn(column)) {
        const columnDataType = {
          ...UNKNOWN,
          ...column.type,
        };
        return columnHelper.display({
          id: getColumnId(column),
          header: column.title,
          cell: (props) => {
            const columnValue = column.value(props.row.original.content);
            return (
              <>
                {columnDataType.render?.(
                  columnValue as any,
                  {
                    isSupported: false,
                    onChange: () => {
                      // todo: implement
                    },
                    statusRes: init(),
                  },
                  props.row.original.content,
                )}
              </>
            );
          },
          meta: {
            wrapMode: DEFAULT_COLUMN_WRAP_MODE,
            tooltip: column.tooltip,
          },
        });
      } else {
        return columnHelper.group({
          id: getColumnId(column),
          header: column.title,
          columns: convertColumns(column.children),
          meta: {
            wrapMode: DEFAULT_COLUMN_WRAP_MODE,
            tooltip: column.tooltip,
          },
        });
      }
    }

    return convertColumns(columns);
  }, [columns]);

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
      ...(isExpandable ? [EXPAND_COLUMN_ID] : []),
      ...(isRowSelectionEnabled ? [SELECT_COLUMN_ID] : []),
      ...result,
    ];
  }, [isRowSelectionEnabled, isExpandable, columnDefs, columnOrder]);

  const allColumns = useMemo(
    (): TanTable.ColumnDef<TableRow<Item>>[] => [
      ...(isExpandable ? [EXPAND_COLUMN as TanTable.ColumnDef<TableDataItem<Item>>] : []),
      ...(isRowSelectionEnabled ? [SELECT_COLUMN as TanTable.ColumnDef<TableDataItem<Item>>] : []),
      ...(columnDefs as any), // todo: fix any
      SPACER_COLUMN,
    ],
    [isExpandable, isRowSelectionEnabled, columnDefs],
  );
  const data = getOr(dataRes, { items: [] });

  const preparedData: TableRow<Item>[] = useMemo(() => {
    let rowIndex = 0;
    return data.items.flatMap((item, itemIndex): TableRow<Item>[] => {
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

  const paginationState = {
    pageSize: params.pageSize,
    pageIndex: params.page - 1,
  };

  const table = TanTable.useReactTable<TableRow<Item>>({
    data: preparedData,
    columns: allColumns,
    getRowId: (originalRow): string => {
      return `${applyFieldAccessor(originalRow.content, rowKey as FieldAccessor<Item>)}`;
    },
    getCoreRowModel: TanTable.getCoreRowModel(),
    getRowCanExpand: () => isExpandable,
    manualSorting: isSortable,
    enableSorting: isSortable,
    manualPagination: true,
    enableColumnResizing: true,
    enablePinning: true,
    enableHiding: true,
    pageCount: getPageCount(params, data),
    enableRowSelection: isRowSelectionEnabled,
    enableExpanding: isExpandable,
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
    onRowSelectionChange: setRowSelection,
  });
  return table;
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
