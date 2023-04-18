import React, { useCallback, useEffect, useImperativeHandle, useMemo } from 'react';
import cn from 'clsx';
import * as TanTable from '@tanstack/react-table';
import _ from 'lodash';
import { Spin } from 'antd';
import s from './index.module.less';
import {
  AllParams,
  CommonParams,
  ExtraFilter,
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
import { PersistedSettingsProvider } from './internal/settings';
import { useTanstackTable } from './internal/helpers';
import ScrollContainer from './ScrollContainer';
import { ToolsOptions } from './Header/Tools';
import Pagination from '@/components/library/Pagination';
import { getPageCount, PaginationParams } from '@/utils/queries/hooks';
import { AsyncResource, getOr, isFailed, isLoading, success } from '@/utils/asyncResource';
import Tooltip from '@/components/library/Tooltip';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import Alert from '@/components/library/Alert';

export interface Props<Item extends object, Params extends object = CommonParams> {
  innerRef?: React.Ref<TableRefType>;
  tableId?: string;
  rowKey: FieldAccessor<Item>;
  data: TableData<Item> | AsyncResource<TableData<Item>>;
  pagination?: boolean | 'HIDE_FOR_ONE_PAGE';
  selection?: boolean;
  selectionActions?: SelectionAction<Item, Params>[];
  sizingMode?: 'FULL_WIDTH' | 'SCROLL';
  params?: AllParams<Params>;
  onChangeParams?: (newParams: AllParams<Params>) => void;
  columns: TableColumn<Item>[];
  showResultsInfo?: boolean; // todo:implement
  hideFilters?: boolean;
  disableSorting?: boolean;
  extraFilters?: ExtraFilter<Params>[];
  extraTools?: ToolRenderer[];
  renderExpanded?: (item: Item) => JSX.Element;
  fitHeight?: boolean | number;
  fixedExpandedContainer?: boolean;
  toolsOptions?: ToolsOptions;
  defaultSorting?: SortingParamsItem;
  onPaginateData?: (params: PaginationParams) => Promise<TableData<Item>>;
  onReload?: () => void;
}

function Table<Item extends object, Params extends object = CommonParams>(
  props: Props<Item, Params>,
) {
  const {
    innerRef,
    rowKey,
    columns,
    selectionActions = [],
    params = DEFAULT_PARAMS_STATE as AllParams<Params>,
    extraFilters,
    extraTools,
    onChangeParams = () => {},
    onPaginateData,
    pagination = false,
    selection = false,
    fitHeight = false,
    hideFilters = false,
    disableSorting = false,
    fixedExpandedContainer = false,
    sizingMode = 'SCROLL',
    toolsOptions,
    renderExpanded,
    defaultSorting,
    onReload,
  } = props;

  const dataRes: AsyncResource<TableData<Item>> = useMemo(() => {
    return 'items' in props.data ? success(props.data) : props.data;
  }, [props.data]);

  const data = useMemo(() => getOr(dataRes, { items: [] }), [dataRes]);

  const handleChangeParams = useCallback(
    (newParams: AllParams<Params>) => {
      onChangeParams?.({
        ...newParams,
        page: 1,
      });
    },
    [onChangeParams],
  );
  const handleChangeParamsPaginated = useCallback(
    (newParams: AllParams<Params>) => {
      onChangeParams?.(newParams);
    },
    [onChangeParams],
  );

  const isExpandable = renderExpanded != null;
  const table = useTanstackTable(
    dataRes,
    rowKey,
    columns,
    params,
    handleChangeParams,
    selection || selectionActions.length > 0,
    isExpandable,
    !disableSorting,
    defaultSorting,
  );

  const handleResetSelection = useCallback(() => {
    table.resetRowSelection();
  }, [table]);

  const handleReload = useCallback(() => {
    handleResetSelection();
    if (params != null) {
      handleChangeParamsPaginated(_.cloneDeep(params));
    }
    if (onReload) {
      onReload();
    }
  }, [onReload, handleChangeParamsPaginated, params, handleResetSelection]);

  useImperativeHandle<TableRefType, TableRefType>(
    innerRef,
    () => ({
      reload: handleReload,
    }),
    [handleReload],
  );

  const isResizing = table.getState().columnSizingInfo.isResizingColumn;
  useEffect(() => {
    window.document.body.classList.toggle(s.bodyBlockSelection, isResizing !== false);
  }, [isResizing]);

  const showPagination =
    typeof pagination === 'boolean'
      ? pagination
      : pagination === 'HIDE_FOR_ONE_PAGE' && getPageCount(params, data) > 1;

  const rows = table.getRowModel().rows;
  return (
    <div className={cn(s.root, s[`sizingMode-${sizingMode}`])}>
      <Header<Item, Params>
        table={table}
        columns={columns}
        params={params}
        selectionActions={selectionActions}
        hideFilters={hideFilters}
        extraFilters={extraFilters}
        extraTools={extraTools}
        toolsOptions={toolsOptions}
        onChangeParams={handleChangeParams}
        onPaginateData={onPaginateData}
        onReload={onReload}
      />
      <ScrollContainer
        maxHeight={typeof fitHeight === 'number' ? fitHeight : undefined}
        enableHorizontalScroll={sizingMode === 'SCROLL'}
      >
        {(containerWidth) => {
          const showSizer = sizingMode === 'SCROLL' && containerWidth > table.getTotalSize();
          return (
            <table
              className={cn(s.table, fitHeight === true && s.fitHeight)}
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
                            <></>
                          ) : (
                            <Th key={header.id} index={i} header={header} pinOffset={offset} />
                          );
                        })}
                      </tr>
                    );
                  })}
              </thead>
              <tbody className={cn(s.tableBody, isLoading(dataRes) && s.isLoading)}>
                {isFailed(dataRes) ? (
                  <tr>
                    <td colSpan={table.getAllFlatColumns().length} className={s.error}>
                      <Alert type="error">{dataRes.message}</Alert>
                    </td>
                  </tr>
                ) : (
                  <>
                    {rows.length === 0 && (
                      <tr>
                        <td className={s.noData} colSpan={table.getAllFlatColumns().length}>
                          {isLoading(dataRes) ? <Spin /> : 'No data to display'}
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
                          <tr>
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
                                <></>
                              ) : (
                                <Td<Item> key={cell.id} index={i} cell={cell} offset={offset} />
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
      {showPagination && (
        <Pagination
          isDisabled={isLoading(dataRes)}
          current={params?.page ?? 1}
          pageSize={params?.pageSize ?? DEFAULT_PAGE_SIZE}
          onChange={(page, pageSize) => handleChangeParamsPaginated({ ...params, page, pageSize })}
          total={data.total ?? data.items.length}
        />
      )}
    </div>
  );
}

function Td<Item>(props: {
  cell: TanTable.Cell<TableRow<Item>, unknown>;
  index: number;
  offset: number;
}) {
  const { cell, index, offset } = props;
  const { column } = cell;
  const isPinned = column.getIsPinned();
  const columnKey = column.columnDef.meta?.key;
  const wrapMode = column.columnDef.meta?.wrapMode;

  const item: TableRow<Item> = cell.row.original;
  let rowSpan = 1;
  if (columnKey != null && (item.spanBy as string[]).includes(columnKey) && item.rowsCount > 1) {
    rowSpan = item.isFirstRow ? item.rowsCount : 0;
  }

  if (rowSpan === 0) {
    return <></>;
  }

  return (
    <td
      className={cn(
        s.td,
        isPinned && s[`pinned-${isPinned}`],
        s[`wrapMode-${wrapMode}`],
        item.itemIndex % 2 === 0 && s.isOdd,
      )}
      style={{
        ...getSizingProps(cell.column),
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
}) {
  const { index, header, pinOffset } = props;
  const column = header.column;
  const isSortable = column.getCanSort();
  const isSorted = column.getIsSorted();
  const isPinned = column.getIsPinned();
  const isResizable = column.getCanResize();
  return (
    <th
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
        ...getSizingProps(column),
        ...getPinnedStyles(column.getIsPinned(), index, pinOffset),
      }}
    >
      {!header.isPlaceholder && (
        <div className={s.thContent}>
          <div className={s.title}>
            {TanTable.flexRender(column.columnDef.header, header.getContext())}
            {column.columnDef.meta?.tooltip && (
              <Tooltip title={column.columnDef.meta?.tooltip}>
                <InformationLineIcon className={s.tooltipIcon} />
              </Tooltip>
            )}
          </div>
          {isSortable && (
            <Sorter sorting={isSorted ? (isSorted === 'desc' ? 'descend' : 'ascend') : false} />
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

function getSizingProps<Item>(column: TanTable.Column<Item>) {
  if (column.id === SPACER_COLUMN_ID) {
    return {};
  }
  const size = column.getSize();
  return {
    width: size,
    maxWidth: size,
  };
}

export default function <Item extends object, Params extends object = CommonParams>(
  props: Props<Item, Params>,
) {
  const { tableId, extraFilters, columns } = props;

  return (
    <PersistedSettingsProvider
      tableId={tableId ?? null}
      columns={columns}
      extraFilters={extraFilters}
    >
      <Table {...props} />
    </PersistedSettingsProvider>
  );
}
