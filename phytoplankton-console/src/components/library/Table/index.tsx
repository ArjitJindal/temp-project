import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import cn from 'clsx';
import * as TanTable from '@tanstack/react-table';
import { cloneDeep, isEqual, omit } from 'lodash';
import s from './index.module.less';
import {
  AllParams,
  CommonParams,
  FieldAccessor,
  SelectionAction,
  SortingParamsItem,
  TableColumn,
  TableData,
  TableRefType,
  TableRow,
  ToolRenderer,
  applyFieldAccessor,
} from './types';
import Header from './Header';
import { DEFAULT_PAGE_SIZE, DEFAULT_PARAMS_STATE } from './consts';
import Sorter from './Sorter';
import { PersistedSettingsProvider, usePersistedSettingsContext } from './internal/settings';
import { useTanstackTable } from './internal/helpers';
import ScrollContainer from './ScrollContainer';
import { ToolsOptions } from './Header/Tools';
import { AdditionalContext } from './internal/partialySelectedRows';
import Footer from './Footer';
import Pagination from '@/components/library/Pagination';
import { getPageCount, PaginationParams } from '@/utils/queries/hooks';
import { AsyncResource, getOr, isFailed, isLoading, success } from '@/utils/asyncResource';
import Tooltip from '@/components/library/Tooltip';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import Alert from '@/components/library/Alert';
import { Cursor } from '@/utils/queries/types';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import { pickSortingParams } from '@/components/library/Table/paramsHelpers';
import { shouldShowSkeleton } from '@/components/library/Skeleton';
import { CY_LOADING_FLAG_CLASS } from '@/utils/cypress';

type RowHeightMode = 'FIXED' | 'AUTO';

export interface Props<Item extends object, Params extends object = CommonParams> {
  innerRef?: React.Ref<TableRefType>;
  cursor?: AsyncResource<Cursor>;
  tableId?: string;
  rowKey: FieldAccessor<Item>;
  data: TableData<Item> | AsyncResource<TableData<Item>>;
  countResults?: AsyncResource<{ total: number }>;
  pagination?: boolean | 'HIDE_FOR_ONE_PAGE';
  selection?: boolean | ((row: TableRow<Item>) => boolean);
  selectionActions?: SelectionAction<Item, Params>[];
  onSelect?: (ids: string[]) => void;
  sizingMode?: 'FULL_WIDTH' | 'SCROLL';
  params?: AllParams<Params>;
  onEdit?: (rowKey: string, newValue: Item) => void | Promise<void>;
  onChangeParams?: (newParams: AllParams<Params>) => void;
  onExpandedMetaChange?: (meta: { isAllExpanded: boolean }) => void;
  columns: TableColumn<Item>[];
  showResultsInfo?: boolean; // todo:implement
  hideFilters?: boolean;
  rowHeightMode?: RowHeightMode;
  disableSorting?: boolean;
  readOnlyFilters?: boolean;
  extraFilters?: ExtraFilterProps<Params>[];
  leftTools?: React.ReactNode;
  extraTools?: ToolRenderer[];
  extraHeaderInfo?: React.ReactNode;
  isExpandable?: (item: TableRow<Item>) => boolean;
  renderExpanded?: (item: Item) => JSX.Element;
  fitHeight?: boolean | number;
  fixedExpandedContainer?: boolean;
  toolsOptions?: ToolsOptions | false;
  defaultSorting?: SortingParamsItem;
  externalHeader?: boolean;
  onPaginateData?: (params: PaginationParams) => Promise<TableData<Item>>;
  onReload?: () => void;
  selectedIds?: string[];
  partiallySelectedIds?: string[];
  // externalState removed
  selectionInfo?: SelectionInfo;
  expandedRowId?: string;
  emptyText?: string;
  createRow?: {
    item: Item | (() => Item);
    position?: 'TOP' | 'BOTTOM';
    visible?: boolean;
    onSubmit?: (item: Item) => void | Promise<void>;
  };
  rowEditing?: {
    mode?: 'single' | 'multiple';
    isEditable?: (item: Item) => boolean;
    onSave: (rowKey: string, item: Item) => void | Promise<void>;
    onCancel?: (rowKey: string, item: Item) => void;
  };
}

export type SelectionInfo = {
  entityName: string;
  entityCount: number;
};

function Table<Item extends object, Params extends object = CommonParams>(
  props: Props<Item, Params>,
) {
  const {
    tableId,
    innerRef,
    rowKey,
    columns,
    onSelect,
    params = DEFAULT_PARAMS_STATE as AllParams<Params>,
    extraFilters,
    extraTools,
    onChangeParams = () => {},
    onPaginateData,
    onEdit,
    pagination = 'HIDE_FOR_ONE_PAGE',
    selection = false,
    selectedIds,
    partiallySelectedIds,
    fitHeight = false,
    hideFilters = false,
    disableSorting = false,
    fixedExpandedContainer = false,
    externalHeader = false,
    readOnlyFilters = false,
    extraHeaderInfo,
    sizingMode = 'SCROLL',
    toolsOptions,
    renderExpanded,
    defaultSorting,
    onReload,
    cursor,
    onExpandedMetaChange,
    isExpandable,
    selectionActions = [],
    selectionInfo,
    rowHeightMode = 'FIXED',
    expandedRowId,
    leftTools,
    emptyText,
    createRow,
    rowEditing,
  } = props;
  const persistedSettingsContextValue = usePersistedSettingsContext();
  const [persistedSorting] = persistedSettingsContextValue.sort;

  useEffect(() => {
    if (params.sort.length === 0 && persistedSorting.length !== 0) {
      onChangeParams({
        ...params,
        sort: persistedSorting,
      });
    }
  }, [onChangeParams, params, persistedSorting]);

  const dataRes: AsyncResource<TableData<Item>> = useMemo(() => {
    return 'items' in props.data ? success(props.data) : props.data;
  }, [props.data]);

  const adaptedDataRes: AsyncResource<TableData<Item>> = useMemo(() => {
    const isVisible = createRow != null && (createRow.visible ?? true);
    if (!isVisible) {
      return dataRes;
    }
    if (!isLoading(dataRes) && !isFailed(dataRes)) {
      const base = getOr(dataRes, { items: [] });
      const creationItem: Item =
        typeof createRow?.item === 'function'
          ? (createRow?.item as () => Item)()
          : (createRow?.item as Item);
      const newItems =
        (createRow?.position ?? 'BOTTOM') === 'TOP'
          ? ([creationItem, ...(base.items ?? [])] as TableData<Item>['items'])
          : ([...(base.items ?? []), creationItem] as TableData<Item>['items']);
      return success({ ...base, items: newItems });
    }
    return dataRes;
  }, [dataRes, createRow]);

  const data = useMemo(() => getOr(adaptedDataRes, { items: [] }), [adaptedDataRes]);

  // Creation row draft state
  const creationInitialItem = useMemo(() => {
    const isVisible = createRow != null && (createRow.visible ?? true);
    if (!isVisible || createRow == null) {
      return null as unknown as Item | null;
    }
    return (
      typeof createRow.item === 'function'
        ? (createRow.item as () => Item)()
        : (createRow.item as Item)
    ) as Item;
  }, [createRow]);
  const [createDraft, setCreateDraft] = useState<Item | null>(creationInitialItem);
  useEffect(() => {
    setCreateDraft(creationInitialItem);
  }, [creationInitialItem]);

  // Inline editing drafts
  const [editDrafts, setEditDrafts] = useState<Record<string, Item>>({});

  const handleChangeParams = useCallback(
    (newParams: AllParams<Params>) => {
      if (newParams?.page != null && !isEqual(omit(newParams, 'page'), omit(params, 'page'))) {
        newParams.page = 1;
      }
      if (newParams?.from != null && !isEqual(omit(newParams, 'from'), omit(params, 'from'))) {
        newParams.from = '';
      }
      onChangeParams?.({ ...newParams });
    },
    [onChangeParams, params],
  );

  const handleChangeParamsPaginated = useCallback(
    (newParams: AllParams<Params>) => {
      onChangeParams?.(newParams);
    },
    [onChangeParams],
  );

  // Exclude creation row from selection and expansion
  const creationRowId = useMemo(() => {
    const isVisible = createRow != null && (createRow.visible ?? true);
    if (!isVisible || createRow == null) {
      return undefined as unknown as string | undefined;
    }
    try {
      const creationItem: Item =
        typeof createRow.item === 'function'
          ? (createRow.item as () => Item)()
          : (createRow.item as Item);
      return String(applyFieldAccessor(creationItem, rowKey as FieldAccessor<Item>));
    } catch (_e) {
      return undefined as unknown as string | undefined;
    }
  }, [createRow, rowKey]);

  const adaptedSelection = useMemo(() => {
    const original = selection;
    if (!creationRowId) {
      return original;
    }
    if (typeof original === 'function') {
      return (row: TableRow<Item>) => {
        const id = String(applyFieldAccessor(row.content, rowKey as FieldAccessor<Item>));
        if (id === creationRowId) {
          return false;
        }
        return original(row);
      };
    }
    if (original === true) {
      return (row: TableRow<Item>) => {
        const id = String(applyFieldAccessor(row.content, rowKey as FieldAccessor<Item>));
        return id !== creationRowId;
      };
    }
    return original;
  }, [selection, creationRowId, rowKey]);

  const computedIsExpandable = useMemo(() => {
    const base: boolean | ((row: TableRow<Item>) => boolean) =
      renderExpanded == null ? false : isExpandable == null ? true : isExpandable;
    if (!creationRowId) {
      return base;
    }
    if (typeof base === 'function') {
      return (row: TableRow<Item>) => {
        const id = String(applyFieldAccessor(row.content, rowKey as FieldAccessor<Item>));
        if (id === creationRowId) {
          return false;
        }
        return base(row);
      };
    }
    if (base === true) {
      return (row: TableRow<Item>) => {
        const id = String(applyFieldAccessor(row.content, rowKey as FieldAccessor<Item>));
        return id !== creationRowId;
      };
    }
    return base;
  }, [isExpandable, renderExpanded, creationRowId, rowKey]);

  const table = useTanstackTable<Item, Params>({
    dataRes: dataRes,
    rowKey: rowKey,
    columns: columns,
    params: params,
    onChangeParams: handleChangeParams,
    selectedIds,
    partiallySelectedIds,
    onSelect,
    onEdit,
    isRowSelectionEnabled: (adaptedSelection as any) || selectionActions.length > 0,
    isExpandable: computedIsExpandable as any,
    isSortable: !disableSorting,
    defaultSorting: defaultSorting,
    onExpandedMetaChange: onExpandedMetaChange,
    meta: {
      onEdit,
      getRowApi: (row: TanTable.Row<TableRow<Item>>) => {
        const original = row.original.content as Item;
        const id = String(applyFieldAccessor(original, rowKey as FieldAccessor<Item>));
        const isCreateRow = creationRowId != null && id === creationRowId;
        if (isCreateRow) {
          return {
            isEditing: true,
            isCreateRow: true,
            getDraft: () => createDraft ?? original,
            setDraft: (newValue: Item) => setCreateDraft(newValue),
            startEdit: () => {},
            cancelEdit: () => setCreateDraft(original),
            save: async () => {
              const draft = createDraft ?? original;
              const submit = createRow?.onSubmit;
              if (submit) {
                await submit(draft);
              }
              setCreateDraft(creationInitialItem);
            },
          } as any;
        }
        const isEditing = editDrafts[id] != null;
        return {
          isEditing,
          isCreateRow: false,
          getDraft: () => (isEditing ? (editDrafts[id] as Item) : original),
          setDraft: (newValue: Item) => setEditDrafts((prev) => ({ ...prev, [id]: newValue })),
          startEdit: () => setEditDrafts((prev) => (prev[id] ? prev : { ...prev, [id]: original })),
          cancelEdit: () => {
            const cancel = rowEditing?.onCancel;
            try {
              cancel?.(id, original);
            } finally {
              setEditDrafts((prev) => {
                const { [id]: _, ...rest } = prev;
                return rest as Record<string, Item>;
              });
            }
          },
          save: async () => {
            const draft = (editDrafts[id] ?? original) as Item;
            if (rowEditing?.onSave) {
              await rowEditing.onSave(id, draft);
            }
            setEditDrafts((prev) => {
              const { [id]: _, ...rest } = prev;
              return rest as Record<string, Item>;
            });
          },
        } as any;
      },
    },
  });

  const handleResetSelection = useCallback(() => {
    onSelect?.([]);
    table.resetRowSelection();
  }, [onSelect, table]);

  const handleReload = useCallback(() => {
    handleResetSelection();
    if (params != null) {
      handleChangeParamsPaginated(cloneDeep(params));
    }
    if (onReload) {
      onReload();
    }
  }, [onReload, handleChangeParamsPaginated, params, handleResetSelection]);

  useImperativeHandle<TableRefType, TableRefType>(
    innerRef,
    () => ({
      reload: handleReload,
      toggleExpanded: (value?: boolean) => {
        table.toggleAllRowsExpanded(value);
      },
      isAllExpanded: () => {
        return table.getIsAllRowsExpanded();
      },
      toggleSelected: (value?: boolean) => {
        table.toggleAllRowsSelected(value);
      },
      expandRow: (id: string | undefined) => {
        if (id !== undefined) {
          table.getRow(id).toggleExpanded(true);
        }
      },
      isRowExpanded: (id: string) => {
        return table.getRow(id)?.getIsExpanded() ?? false;
      },
    }),
    [handleReload, table],
  );

  const isResizing = table.getState().columnSizingInfo.isResizingColumn;
  useEffect(() => {
    window.document.body.classList.toggle(s.bodyBlockSelection, isResizing !== false);
  }, [isResizing]);

  const Rows = table.getRowModel();
  const [rowExpanded, setrowExpanded] = useState<boolean>(false);
  useEffect(() => {
    if (rowExpanded) {
      return;
    }
    if (expandedRowId === undefined) {
      return;
    }
    if (!Rows?.rowsById[expandedRowId]?.getCanExpand()) {
      return;
    }
    if (Rows?.rowsById[expandedRowId]?.getIsExpanded() === false) {
      Rows?.rowsById[expandedRowId]?.toggleExpanded(true);
      setrowExpanded(true);
      document
        .getElementById(`row_${expandedRowId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [Rows, expandedRowId, rowExpanded]);

  const cyId = tableId != null ? `table-${tableId}` : `table`;

  return (
    <div className={cn(s.root, s[`sizingMode-${sizingMode}`])} data-test="table">
      <Header<Item, Params>
        table={table}
        columns={columns}
        params={params}
        hideFilters={hideFilters}
        extraFilters={extraFilters}
        extraTools={extraTools}
        toolsOptions={toolsOptions}
        externalHeader={externalHeader}
        extraHeaderInfo={extraHeaderInfo}
        onChangeParams={(newParams) => {
          handleChangeParams({
            ...pickSortingParams(params),
            ...newParams,
          });
        }}
        onPaginateData={onPaginateData}
        onReload={onReload}
        cursorPagination={cursor != null}
        totalPages={getPageCount(params, data)}
        leftTools={leftTools}
        readOnlyFilters={readOnlyFilters}
      />
      <ScrollContainer
        maxHeight={typeof fitHeight === 'number' ? fitHeight : undefined}
        enableHorizontalScroll={sizingMode === 'SCROLL'}
      >
        {(containerWidth) => {
          return (
            <ScrollContainerChild
              rowKey={rowKey}
              containerWidth={containerWidth}
              columns={columns}
              table={table}
              dataRes={adaptedDataRes}
              cyId={cyId}
              sizingMode={sizingMode}
              fitHeight={fitHeight}
              rowHeightMode={rowHeightMode}
              fixedExpandedContainer={fixedExpandedContainer}
              renderExpanded={renderExpanded}
              emptyText={emptyText}
            />
          );
        }}
      </ScrollContainer>
      {cursor && (
        <Pagination
          cursorRes={cursor}
          pageSize={params?.pageSize ?? DEFAULT_PAGE_SIZE}
          isDisabled={isLoading(dataRes)}
          onPageChange={(pageSize) => handleChangeParamsPaginated({ ...params, pageSize })}
          onFromChange={(from) => handleChangeParamsPaginated({ ...params, from })}
        />
      )}
      <div data-cy={`${cyId}-pagination-wrapper`}>
        {!cursor && pagination && (
          <Pagination
            isLoading={
              props.countResults ? isLoading(props.countResults) : isLoading(adaptedDataRes)
            }
            current={params?.page ?? 1}
            pageSize={params?.pageSize ?? DEFAULT_PAGE_SIZE}
            onChange={(page, pageSize) =>
              handleChangeParamsPaginated({ ...params, page, pageSize })
            }
            total={
              props.countResults
                ? getOr(props.countResults, { total: 0 }).total
                : data.total ?? data.items.length
            }
            totalPages={data.totalPages}
            currentItems={data.items.length}
          />
        )}
      </div>
      {selectionActions.length > 0 && (
        <Footer
          table={table}
          selectionActions={selectionActions}
          params={params}
          onChangeParams={handleChangeParams}
          selectionInfo={selectionInfo}
        />
      )}
    </div>
  );
}

function Td<Item>(props: {
  cell: TanTable.Cell<TableRow<Item>, unknown>;
  index: number;
  offset: number;
  rowHeightMode: RowHeightMode;
  isLastColumn: boolean;
  remainingSpace: number;
}) {
  const { cell, index, offset, rowHeightMode, isLastColumn, remainingSpace } = props;
  const { column } = cell;
  const isPinned = column.getIsPinned();
  const columnId = column.id;
  const wrapMode = column.columnDef.meta?.wrapMode;

  const item: TableRow<Item> = cell.row.original;
  let rowSpan = 1;
  if (columnId != null && item.spanBy.includes(columnId) && item.rowsCount > 1) {
    rowSpan = item.isFirstRow ? item.rowsCount : 0;
  }

  if (rowSpan === 0) {
    return <></>;
  }

  return (
    <td
      data-cy={column.id}
      className={cn(
        s.td,
        isPinned && s[`pinned-${isPinned}`],
        s[`wrapMode-${wrapMode}`],
        s[`rowHeightMode-${rowHeightMode}`],
        item.itemIndex % 2 === 0 && s.isOdd,
      )}
      style={{
        ...getSizingProps(cell.column, rowHeightMode, isLastColumn, remainingSpace),
        ...getPinnedStyles(column.getIsPinned(), index, offset),
      }}
      rowSpan={rowSpan}
    >
      <div className={s.tdContentWrapper}>
        <div className={s.tdContent}>
          {TanTable.flexRender(column.columnDef.cell, cell.getContext())}
        </div>
      </div>
    </td>
  );
}

interface ScrollContainerChildProps<Item extends object> {
  rowKey: FieldAccessor<Item>;
  table: TanTable.Table<TableRow<Item>>;
  dataRes: AsyncResource<TableData<Item>>;
  containerWidth: number;
  cyId: string;
  sizingMode: 'SCROLL' | 'FULL_WIDTH';
  fitHeight: number | boolean;
  rowHeightMode: RowHeightMode;
  fixedExpandedContainer: boolean;
  renderExpanded?: (item: Item) => JSX.Element;
  columns: TableColumn<Item>[];
  emptyText?: string;
}

function ScrollContainerChild<Item extends object>(props: ScrollContainerChildProps<Item>) {
  const {
    table,
    dataRes,
    cyId,
    containerWidth,
    sizingMode,
    fitHeight,
    rowHeightMode,
    fixedExpandedContainer,
    rowKey,
    renderExpanded,
    emptyText,
  } = props;
  const showSkeleton = shouldShowSkeleton(dataRes);
  const rows = table.getRowModel().rows;

  const totalSize = table.getTotalSize();
  const remainingWidth =
    sizingMode === 'SCROLL' && totalSize < containerWidth ? containerWidth - totalSize - 5 : 0;

  return (
    <table
      key={`table-${showSkeleton ? 'skeleton' : ''}`}
      data-cy={cyId}
      className={cn(
        s.table,
        fitHeight === true && s.fitHeight,
        isLoading(dataRes) && CY_LOADING_FLAG_CLASS,
      )}
      style={{
        width: sizingMode === 'SCROLL' ? totalSize + remainingWidth : '100%',
      }}
    >
      <thead className={s.tableHead}>
        {table
          .getHeaderGroups()
          .filter((headerGroup) => headerGroup.headers.some((header) => !header.isPlaceholder))
          .map((headerGroup) => {
            const leftPinned = headerGroup.headers
              .filter((header) => header.column.getIsPinned() === 'left')
              .map((header) => ({ id: header.id, size: header.getSize() }));
            const rightPinned = headerGroup.headers
              .filter((header) => header.column.getIsPinned() === 'right')
              .map((header) => ({ id: header.id, size: header.getSize() }));
            const lastUnpinnedIndex = headerGroup.headers.findLastIndex(
              (header) => !header.column.getIsPinned(),
            );

            return (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, i) => {
                  const isPinned = header.column.getIsPinned();
                  let offset = 0;
                  if (isPinned === 'right') {
                    const pinnedIndex = rightPinned.findIndex(({ id }) => id === header.id);
                    offset = rightPinned.slice(pinnedIndex + 1).reduce((acc, x) => acc + x.size, 0);
                  } else if (isPinned === 'left') {
                    const pinnedIndex = leftPinned.findIndex(({ id }) => id === header.id);
                    offset = leftPinned.slice(0, pinnedIndex).reduce((acc, x) => acc + x.size, 0);
                  }

                  return (
                    <Th
                      key={header.id}
                      index={i}
                      header={header}
                      pinOffset={offset}
                      rowHeightMode={rowHeightMode}
                      isLastColumn={i === lastUnpinnedIndex}
                      remainingSpace={remainingWidth}
                    />
                  );
                })}
              </tr>
            );
          })}
      </thead>
      <tbody
        data-cy={`${cyId}${!isLoading(dataRes) ? '-body' : ''}`}
        className={cn(
          s.tableBody,
          !showSkeleton && isLoading(dataRes) && s.isLoading,
          showSkeleton && s.showSkeleton,
        )}
        aria-label="Table body"
      >
        {isFailed(dataRes) ? (
          <tr>
            <td colSpan={table.getAllFlatColumns().length} className={s.error}>
              <Alert type="ERROR">{dataRes.message}</Alert>
            </td>
          </tr>
        ) : (
          <>
            {!showSkeleton && !isLoading(dataRes) && rows.length === 0 && (
              <tr>
                <td
                  className={s.noData}
                  style={{ paddingLeft: containerWidth / 2 }}
                  colSpan={table.getAllFlatColumns().length}
                >
                  {emptyText ?? 'No data to display'}
                </td>
              </tr>
            )}
            {rows.map((row, index) => {
              const visibleCells = row.getVisibleCells();

              const leftPinned = visibleCells
                .filter((cell) => cell.column.getIsPinned() === 'left')
                .map((cell) => ({ id: cell.id, size: cell.column.getSize() }));
              const rightPinned = visibleCells
                .filter((cell) => cell.column.getIsPinned() === 'right')
                .map((cell) => ({ id: cell.id, size: cell.column.getSize() }));
              const lastUnpinnedIndex = visibleCells.findLastIndex(
                (header) => !header.column.getIsPinned(),
              );

              const rowId = showSkeleton
                ? `row-skeleton-${index}`
                : `row-${applyFieldAccessor(row.original.content, rowKey as FieldAccessor<Item>)}`;

              return (
                <React.Fragment key={rowId}>
                  <tr id={`row_${index}`} data-cy={`${cyId}-data-row`}>
                    {visibleCells.map((cell, i) => {
                      const isPinned = cell.column.getIsPinned();
                      let offset = 0;
                      if (isPinned === 'right') {
                        const pinnedIndex = rightPinned.findIndex(({ id }) => id === cell.id);
                        offset = rightPinned
                          .slice(pinnedIndex + 1)
                          .reduce((acc, x) => acc + x.size, 0);
                      } else if (isPinned === 'left') {
                        const pinnedIndex = leftPinned.findIndex(({ id }) => id === cell.id);
                        offset = leftPinned
                          .slice(0, pinnedIndex)
                          .reduce((acc, x) => acc + x.size, 0);
                      }

                      return (
                        <Td<Item>
                          key={i}
                          index={i}
                          cell={cell}
                          offset={offset}
                          rowHeightMode={rowHeightMode}
                          isLastColumn={i === lastUnpinnedIndex}
                          remainingSpace={remainingWidth}
                        />
                      );
                    })}
                  </tr>
                  {row.getIsExpanded() && (
                    <tr>
                      <td colSpan={visibleCells.length + 1} className={s.tdExpanded}>
                        <div
                          className={cn(
                            s.tdExpandedContent,
                            fixedExpandedContainer && s.fixedExpandedContainer,
                          )}
                          style={{
                            maxWidth: fixedExpandedContainer ? containerWidth : undefined,
                          }}
                          data-cy="expanded-content"
                        >
                          {renderExpanded?.(row.original.content)}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}
      </tbody>
    </table>
  );
}

function Th<Item>(props: {
  index: number;
  header: TanTable.Header<Item, unknown>;
  pinOffset: number;
  rowHeightMode: RowHeightMode;
  isLastColumn: boolean;
  remainingSpace: number;
}) {
  const { index, header, pinOffset, rowHeightMode, remainingSpace, isLastColumn } = props;
  const column = header.column;
  const isSortable = column.getCanSort();
  const isSorted = column.getIsSorted();
  const isPinned = column.getIsPinned();
  const isResizable = column.getCanResize() && !(isLastColumn && remainingSpace > 0);

  return (
    <th
      aria-label={`"${
        typeof column.columnDef.header === 'string' ? column.columnDef.header : 'unknown'
      }" column header`}
      className={cn(
        s.th,
        isPinned && s[`pinned-${isPinned}`],
        header.subHeaders.length > 0 && s.grouped,
        isSortable && s.isClickable,
      )}
      colSpan={header.colSpan}
      onClick={() => {
        if (isSortable) {
          column.toggleSorting();
        }
      }}
      style={{
        ...getSizingProps(column, rowHeightMode, isLastColumn, remainingSpace),
        ...getPinnedStyles(column.getIsPinned(), index, pinOffset),
      }}
    >
      {!header.isPlaceholder && (
        <div className={s.thContent}>
          <div className={s.titles}>
            <div className={s.title}>
              {TanTable.flexRender(column.columnDef.header, header.getContext())}
              {column.columnDef.meta?.tooltip && (
                <Tooltip title={column.columnDef.meta?.tooltip}>
                  <InformationLineIcon className={s.tooltipIcon} />
                </Tooltip>
              )}
            </div>
            {column.columnDef.meta?.subtitle && (
              <div className={s.subtitle}>{column.columnDef.meta?.subtitle}</div>
            )}
          </div>
          {isSortable && (
            <Sorter
              sorting={isSorted ? (isSorted === 'desc' ? 'descend' : 'ascend') : false}
              testName={column.columnDef.id ?? ''}
            />
          )}
        </div>
      )}
      {isResizable && (
        <div
          className={cn(s.resizer, column.getIsResizing() && s.isResizing)}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          style={{
            transform: column.getIsResizing()
              ? `translateX(${header.getContext().table.getState().columnSizingInfo.deltaOffset}px)`
              : '',
          }}
        />
      )}
    </th>
  );
}

function getPinnedStyles(isPinned: boolean | 'left' | 'right', index: number, pinOffset: number) {
  return {
    zIndex: isPinned ? (isPinned === 'left' ? index + 2 : 999 - index) : undefined,
    left: isPinned === 'left' ? pinOffset : undefined,
    right: isPinned === 'right' ? pinOffset : undefined,
  };
}

function getSizingProps<Item>(
  column: TanTable.Column<Item>,
  rowHeightMode: RowHeightMode,
  isLastColumn: boolean,
  remainingSpace: number,
) {
  const size = column.getSize();
  const adjustedSize = isLastColumn ? size + remainingSpace : size;
  return {
    width: adjustedSize,
    maxWidth: adjustedSize,
    height: rowHeightMode === 'FIXED' ? '64px' : undefined,
    maxHeight: rowHeightMode === 'FIXED' ? '64px' : undefined,
  };
}

export default function <Item extends object, Params extends object = CommonParams>(
  props: Props<Item, Params>,
) {
  const {
    tableId,
    extraFilters,
    columns,
    partiallySelectedIds,
    // externalState removed
    selectionInfo,
  } = props;

  return (
    <AdditionalContext.Provider value={{ partiallySelectedIds, selectionInfo }}>
      <PersistedSettingsProvider
        tableId={tableId ?? null}
        columns={columns}
        extraFilters={extraFilters}
      >
        <Table {...props} />
      </PersistedSettingsProvider>
    </AdditionalContext.Provider>
  );
}
