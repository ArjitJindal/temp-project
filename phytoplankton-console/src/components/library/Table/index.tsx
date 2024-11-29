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
} from './types';
import Header from './Header';
import { DEFAULT_PAGE_SIZE, DEFAULT_PARAMS_STATE, SPACER_COLUMN_ID } from './consts';
import Sorter from './Sorter';
import { PersistedSettingsProvider, usePersistedSettingsContext } from './internal/settings';
import { useTanstackTable } from './internal/helpers';
import ScrollContainer from './ScrollContainer';
import { ToolsOptions } from './Header/Tools';
import { ExternalStateContext } from './internal/externalState';
import { AdditionalContext } from './internal/partialySelectedRows';
import Footer from './Footer';
import Pagination from '@/components/library/Pagination';
import { getPageCount, PaginationParams } from '@/utils/queries/hooks';
import { AsyncResource, getOr, isFailed, isLoading, success } from '@/utils/asyncResource';
import Tooltip from '@/components/library/Tooltip';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import Alert from '@/components/library/Alert';
import CursorPagination from '@/components/library/CursorPagination';
import { Cursor } from '@/utils/queries/types';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import { pickSortingParams } from '@/components/library/Table/paramsHelpers';
import { shouldShowSkeleton } from '@/components/library/Skeleton';
import { CY_LOADING_FLAG_CLASS } from '@/utils/cypress';
import { useIsChanged } from '@/utils/hooks';

type RowHeightMode = 'FIXED' | 'AUTO';

export interface Props<Item extends object, Params extends object = CommonParams> {
  innerRef?: React.Ref<TableRefType>;
  cursor?: AsyncResource<Cursor>;
  tableId?: string;
  rowKey: FieldAccessor<Item>;
  data: TableData<Item> | AsyncResource<TableData<Item>>;
  pagination?: boolean | 'HIDE_FOR_ONE_PAGE';
  selection?: boolean | ((row: TableRow<Item>) => boolean);
  selectionActions?: SelectionAction<Item, Params>[];
  onSelect?: (ids: string[]) => void;
  sizingMode?: 'FULL_WIDTH' | 'SCROLL';
  params?: AllParams<Params>;
  onEdit?: (rowKey: string, newValue: Item) => void;
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
  paginationBorder?: boolean;
  selectedIds?: string[];
  partiallySelectedIds?: string[];
  externalState?: unknown;
  selectionInfo?: SelectionInfo;
  expandedRowId?: string;
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
    paginationBorder = false,
    cursor,
    onExpandedMetaChange,
    isExpandable,
    selectionActions = [],
    selectionInfo,
    rowHeightMode = 'FIXED',
    expandedRowId,
    leftTools,
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

  const data = useMemo(() => getOr(dataRes, { items: [] }), [dataRes]);
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
    isRowSelectionEnabled: selection || selectionActions.length > 0,
    isExpandable: renderExpanded == null ? false : isExpandable == null ? true : isExpandable,
    isSortable: !disableSorting,
    defaultSorting: defaultSorting,
    onExpandedMetaChange: onExpandedMetaChange,
  });

  const handleResetSelection = useCallback(() => {
    onSelect?.([]);
    table.resetRowSelection();
  }, [onSelect, table]);

  const isDataResChanged = useIsChanged(dataRes.kind);
  useEffect(() => {
    if (isDataResChanged) {
      handleResetSelection();
    }
  }, [isDataResChanged, handleResetSelection]);

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

  const showPagination =
    typeof pagination === 'boolean'
      ? pagination
      : pagination === 'HIDE_FOR_ONE_PAGE' && getPageCount(params, data) > 1;

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
          const showSizer = sizingMode === 'SCROLL' && containerWidth > table.getTotalSize();
          const showSkeleton = shouldShowSkeleton(dataRes);
          const rows = table.getRowModel().rows;
          return (
            <table
              data-cy={cyId}
              className={cn(
                s.table,
                fitHeight === true && s.fitHeight,
                isLoading(dataRes) && CY_LOADING_FLAG_CLASS,
              )}
              style={{
                width: sizingMode === 'SCROLL' ? table.getTotalSize() : '100%',
              }}
            >
              <thead className={s.tableHead}>
                {table
                  .getHeaderGroups()
                  .filter((headerGroup) =>
                    headerGroup.headers.some((header) => !header.isPlaceholder),
                  )
                  .map((headerGroup) => {
                    const leftPinned = headerGroup.headers
                      .filter((header) => header.column.getIsPinned() === 'left')
                      .map((header) => ({ id: header.id, size: header.getSize() }));
                    const rightPinned = headerGroup.headers
                      .filter((header) => header.column.getIsPinned() === 'right')
                      .map((header) => ({ id: header.id, size: header.getSize() }));
                    return (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header, i) => {
                          const isPinned = header.column.getIsPinned();
                          let offset = 0;
                          if (isPinned === 'right') {
                            const pinnedIndex = rightPinned.findIndex(({ id }) => id === header.id);
                            offset = rightPinned
                              .slice(pinnedIndex + 1)
                              .reduce((acc, x) => acc + x.size, 0);
                          } else if (isPinned === 'left') {
                            const pinnedIndex = leftPinned.findIndex(({ id }) => id === header.id);
                            offset = leftPinned
                              .slice(0, pinnedIndex)
                              .reduce((acc, x) => acc + x.size, 0);
                          }

                          return header.column.id === SPACER_COLUMN_ID && !showSizer ? (
                            <React.Fragment key={header.id}></React.Fragment>
                          ) : (
                            <Th
                              key={header.id}
                              index={i}
                              header={header}
                              pinOffset={offset}
                              rowHeightMode={rowHeightMode}
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
                      <Alert type="error">{dataRes.message}</Alert>
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
                          {'No data to display'}
                        </td>
                      </tr>
                    )}
                    {rows.map((row) => {
                      const visibleCells = row.getVisibleCells();

                      const leftPinned = visibleCells
                        .filter((cell) => cell.column.getIsPinned() === 'left')
                        .map((cell) => ({ id: cell.id, size: cell.column.getSize() }));
                      const rightPinned = visibleCells
                        .filter((cell) => cell.column.getIsPinned() === 'right')
                        .map((cell) => ({ id: cell.id, size: cell.column.getSize() }));

                      return (
                        <React.Fragment key={row.id}>
                          <tr id={`row_${row.id}`} data-cy={`${cyId}-data-row`}>
                            {visibleCells.map((cell, i) => {
                              const isPinned = cell.column.getIsPinned();
                              let offset = 0;
                              if (isPinned === 'right') {
                                const pinnedIndex = rightPinned.findIndex(
                                  ({ id }) => id === cell.id,
                                );
                                offset = rightPinned
                                  .slice(pinnedIndex + 1)
                                  .reduce((acc, x) => acc + x.size, 0);
                              } else if (isPinned === 'left') {
                                const pinnedIndex = leftPinned.findIndex(
                                  ({ id }) => id === cell.id,
                                );
                                offset = leftPinned
                                  .slice(0, pinnedIndex)
                                  .reduce((acc, x) => acc + x.size, 0);
                              }

                              return cell.column.id === SPACER_COLUMN_ID && !showSizer ? (
                                <React.Fragment key={cell.id}></React.Fragment>
                              ) : (
                                <Td<Item>
                                  key={cell.id}
                                  index={i}
                                  cell={cell}
                                  offset={offset}
                                  rowHeightMode={rowHeightMode}
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
        }}
      </ScrollContainer>
      {cursor && (
        <CursorPagination
          pageSize={params?.pageSize ?? DEFAULT_PAGE_SIZE}
          cursorRes={cursor}
          isDisabled={isLoading(dataRes)}
          onPageChange={(pageSize) => handleChangeParamsPaginated({ ...params, pageSize })}
          onFromChange={(from) => handleChangeParamsPaginated({ ...params, from })}
        />
      )}
      <div data-cy={`${cyId}-pagination-wrapper`}>
        {!cursor && showPagination && (
          <Pagination
            isDisabled={isLoading(dataRes)}
            current={params?.page ?? 1}
            pageSize={params?.pageSize ?? DEFAULT_PAGE_SIZE}
            onChange={(page, pageSize) =>
              handleChangeParamsPaginated({ ...params, page, pageSize })
            }
            total={data.total ?? data.items.length}
            totalPages={data.totalPages}
            currentItems={data.items.length}
            paginationBorder={paginationBorder}
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
}) {
  const { cell, index, offset, rowHeightMode } = props;
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
        ...getSizingProps(cell.column, rowHeightMode),
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

function Th<Item>(props: {
  index: number;
  header: TanTable.Header<Item, unknown>;
  pinOffset: number;
  rowHeightMode: RowHeightMode;
}) {
  const { index, header, pinOffset, rowHeightMode } = props;
  const column = header.column;
  const isSortable = column.getCanSort();
  const isSorted = column.getIsSorted();
  const isPinned = column.getIsPinned();
  const isResizable = column.getCanResize();

  return (
    <th
      aria-label={`"${column.columnDef.header ?? 'unknown'}" column header`}
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
        ...getSizingProps(column, rowHeightMode),
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

function getSizingProps<Item>(column: TanTable.Column<Item>, rowHeightMode: RowHeightMode) {
  if (column.id === SPACER_COLUMN_ID) {
    return {};
  }
  const size = column.getSize();
  return {
    width: size,
    maxWidth: size,
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
    externalState = null,
    selectionInfo,
  } = props;

  return (
    <ExternalStateContext.Provider value={{ value: externalState }}>
      <AdditionalContext.Provider value={{ partiallySelectedIds, selectionInfo }}>
        <PersistedSettingsProvider
          tableId={tableId ?? null}
          columns={columns}
          extraFilters={extraFilters}
        >
          <Table {...props} />
        </PersistedSettingsProvider>
      </AdditionalContext.Provider>
    </ExternalStateContext.Provider>
  );
}
