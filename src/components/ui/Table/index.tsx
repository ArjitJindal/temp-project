import ProTable, { ProTableProps } from '@ant-design/pro-table';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import _ from 'lodash';
import cn from 'clsx';
import { ProColumns, ProColumnType } from '@ant-design/pro-table/es/typing';
import style from './style.module.less';
import { flatItems, getAutoFilters, handleResize, TABLE_LOCALE } from './utils';
import { DEFAULT_PAGE_SIZE } from './consts';
import {
  ActionRenderer,
  ActionRendererProps,
  ExtraFilter,
  isGroupColumn,
  isMultiRows,
  SortOrder,
  TableColumn,
  TableData,
  TableRow,
} from './types';
import Filters from './Filters';
import { isEqual } from '@/utils/lang';
import { usePrevious } from '@/utils/hooks';
import { ResizableTitle } from '@/utils/table-utils';
import DownloadButton from '@/components/ui/Table/DownloadButton';
import { PaginationParams } from '@/utils/queries/hooks';
import Pagination from '@/components/library/Pagination';
import Checkbox from '@/components/library/Checkbox';
import CollapsableIcon from '@/components/ui/CollapsableIcon';

export type TableActionType = {
  reload: () => void;
};

export interface CommonParams extends PaginationParams {
  sort: [string, SortOrder][];
}

export type AllParams<Params> = Params & CommonParams;

export interface RowSelection<T> {
  selectedKeys: string[];
  onChange: (selectedIds: string[]) => void;
  items?: TableRow<T>[];
  onChangeItems?: (selectedItems: TableRow<T>[]) => void;
}

export const DEFAULT_PARAMS_STATE: CommonParams = {
  page: 1,
  sort: [],
  pageSize: DEFAULT_PAGE_SIZE,
};

type PickUpProps<T, Params, ValueType> = Pick<
  ProTableProps<T, Params, ValueType>,
  | 'options'
  | 'search'
  | 'expandable'
  | 'form'
  | 'getPopupContainer'
  | 'scroll'
  | 'bordered'
  | 'formRef'
  | 'toolBarRender'
  | 'columnsState'
  | 'defaultSize'
  | 'tooltip'
  | 'headerTitle'
>;

export interface Props<T extends object | unknown, Params extends object, ValueType>
  extends PickUpProps<TableRow<T>, Params, ValueType> {
  rowKey: string;
  tableId?: string;
  className?: string;
  cardBordered?: boolean;
  disableStripedColoring?: boolean;
  disableExpandedRowPadding?: boolean;
  disableInternalPadding?: boolean;
  disableScrolling?: boolean;
  disableHorizontalScrolling?: boolean;
  actionRef?: React.Ref<TableActionType>;
  loading?: boolean;
  data: TableData<T>;
  pagination?: 'SHOW' | 'HIDE_FOR_ONE_PAGE' | 'HIDE';
  rowSelection?: RowSelection<T>;
  params?: AllParams<Params>;
  isEvenRow?: (item: T) => boolean;
  extraFilters?: ExtraFilter<Params>[];
  actionsHeader?: ActionRenderer<Params>[];
  actionsHeaderRight?: ActionRenderer<Params>[];
  controlsHeader?: ActionRenderer<Params>[];
  onChangeParams?: (newParams: AllParams<Params>) => void;
  columns: TableColumn<T>[];
  headerSubtitle?: React.ReactNode;
  onReload?: () => void;
  onReset?: () => void;
  onPaginateExportData?: (params: PaginationParams) => Promise<TableData<T>>;
  showResultsInfo?: boolean;
  autoAdjustHeight?: boolean;
  enableLegacyFilters?: boolean; // We need this for sanctions table only
  adjustPagination?: boolean;
  hideFilters?: boolean;
  paginationBorder?: boolean;
}

export default function Table<
  T extends object,
  Params extends object = CommonParams,
  ValueType = 'text',
>(props: Props<T, Params, ValueType>) {
  const {
    disableStripedColoring = false,
    disableExpandedRowPadding = false,
    disableInternalPadding = false,
    disableScrolling = false,
    disableHorizontalScrolling = false,
    enableLegacyFilters = false,
    className,
    isEvenRow,
    options,
    actionRef,
    headerTitle,
    headerSubtitle,
    actionsHeader = [],
    actionsHeaderRight = [],
    extraFilters = [],
    controlsHeader = [],
    rowSelection,
    loading,
    pagination = 'SHOW',
    data,
    params,
    columns,
    rowKey,
    expandable,
    form,
    getPopupContainer,
    scroll,
    toolBarRender,
    columnsState,
    cardBordered,
    onChangeParams = () => {
      throw new Error(
        `This is a stub handle for changing table parameters. You need to pass proper onChangeParams handler to make it work properly`,
      );
    },
    onReset,
    onReload,
    showResultsInfo = true,
    adjustPagination = false,
    hideFilters = false,
    paginationBorder = false,
  } = props;
  const tableElement = useRef<HTMLDivElement>(null);

  const handleResetSelection = useCallback(() => {
    rowSelection?.onChange([]);
    rowSelection?.onChangeItems?.([]);
  }, [rowSelection]);

  const handleReload = useCallback(() => {
    handleResetSelection();
    if (params != null) {
      onChangeParams(_.cloneDeep(params));
    }
    if (onReload) {
      onReload();
    }
  }, [onReload, onChangeParams, params, handleResetSelection]);

  useImperativeHandle<TableActionType, TableActionType>(
    actionRef,
    () => ({
      reload: handleReload,
    }),
    [handleReload],
  );

  // Reset page if any parameters besides of page changes
  const prevParams = usePrevious(params);
  useEffect(() => {
    if (prevParams != null && params != null) {
      const { page: _page1, ..._prevParams } = prevParams;
      const { page: _page2, ..._params } = params;
      if (!isEqual(_prevParams, _params)) {
        handleResetSelection();
        onChangeParams({ ...params, page: 1 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleResetSelection, prevParams, params]);

  const dataItems = data.items || [];
  const dataKeys = dataItems.map((x) => (isMultiRows(x) ? x.item[rowKey] : x[rowKey]));

  const [updatedColumnWidth, setUpdatedColumnWidth] = useState<{
    [key: string]: number;
  }>({});

  function adjustColumns<T extends object>(
    columns: (TableColumn<T> | null)[],
    suffix = '',
  ): ProColumns<TableRow<T>>[] {
    return (columns ?? [])
      .filter((column): column is TableColumn<T> => column != null)
      .map((col: TableColumn<T>, index): ProColumns<TableRow<T>> => {
        const sortOrder = params?.sort.find(([field]) => field === col.dataIndex)?.[1];
        const width = updatedColumnWidth[`${index}${suffix}`] ?? col.width;
        const onHeaderCell = (column: unknown) => ({
          width: (column as TableColumn<T>).width,
          onResize: handleResize(`${index}${suffix}`, setUpdatedColumnWidth),
        });
        const sharedProps = {
          ...col,
          sortOrder,
          width,
          onHeaderCell,
          hideInSearch: enableLegacyFilters ? col.hideInSearch : true,
          title: col.subtitle ? (
            <div className={style.twoLineTitle}>
              <div>{col.title}</div>
              <div>{col.subtitle}</div>
            </div>
          ) : (
            col.title
          ),
        };

        if (isGroupColumn(col)) {
          return {
            ...sharedProps,
            children: adjustColumns(col.children, `${suffix}-${index}`),
          };
        }
        return {
          ...sharedProps,
        };
      });
  }

  const allFilters = [...extraFilters, ...getAutoFilters(columns)];
  const adjustedColumns: ProColumnType<TableRow<T>>[] = adjustColumns(columns);

  if (rowSelection != null) {
    const allSelected =
      dataKeys.length > 0 &&
      dataKeys.every((key) => rowSelection?.selectedKeys.indexOf(key) !== -1);

    const someSelected =
      dataKeys.length > 0 && dataKeys.some((key) => rowSelection?.selectedKeys.indexOf(key) !== -1);

    adjustedColumns.unshift({
      hideInSearch: true,
      search: false,
      hideInSetting: true,
      title: (_) => (
        <Checkbox
          value={allSelected ? true : someSelected ? undefined : false}
          onChange={(checked) => {
            rowSelection.onChange(checked ? dataKeys : []);
          }}
        />
      ),
      width: 32,
      onCell: (_) => ({
        rowSpan: _.isFirstRow ? _.rowsCount : 0,
      }),
      render: (_, row) => {
        const key = row.entityKey;
        const isSelected = rowSelection?.selectedKeys.indexOf(key) != -1;
        return (
          <Checkbox
            value={isSelected}
            onChange={(checked) => {
              const currentSelection = (rowSelection?.selectedKeys ?? []).filter((x) => x !== key);
              const dataSelected = (rowSelection?.items ?? []).filter((x) => x[rowKey] !== key);
              rowSelection?.onChange(checked ? [...currentSelection, key] : currentSelection);
              if (rowSelection?.items) {
                rowSelection?.onChangeItems?.(checked ? [...dataSelected, row] : dataSelected);
              }
            }}
          />
        );
      },
    });
  }
  const handleReset = () => {
    if (onReset != null) {
      onReset();
    } else if (onChangeParams) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      onChangeParams(DEFAULT_PARAMS_STATE);
    }
  };

  const showFilters =
    params != null && allFilters.length > 0 && !enableLegacyFilters && !hideFilters;
  const showActionsHeader = actionsHeader.length > 0 && params != null;
  const showActionsHeaderRight = actionsHeaderRight.length > 0 && params != null;
  const showBottomHeader = showFilters;
  const showTopHeader =
    showActionsHeader || showActionsHeaderRight || headerTitle || headerSubtitle;

  const [toolbarWidth, setToolbarWidth] = useState(140);
  useLayoutEffect(() => {
    const toolbar = tableElement?.current?.querySelector('.ant-pro-table-list-toolbar-right');
    if (toolbar) {
      const { width } = toolbar.getBoundingClientRect();
      setToolbarWidth(width);
    }
  }, []);

  const showPagination = useMemo(() => {
    if (pagination === 'SHOW') {
      return true;
    }

    if (pagination === 'HIDE_FOR_ONE_PAGE' && data?.total && params?.pageSize) {
      return data.total > params.pageSize;
    }

    return false;
  }, [data?.total, params?.pageSize, pagination]);

  return (
    <div
      className={cn(style.root, {
        [style.disableExpandedRowPadding]: disableExpandedRowPadding,
        [style.disableScrolling]: disableScrolling,
      })}
      ref={tableElement}
    >
      <ProTable<TableRow<T>, Params>
        search={enableLegacyFilters ? props.search : false}
        toolBarRender={(action, rows) => {
          const result = [];

          if (toolBarRender != null && toolBarRender !== false) {
            result.push(...toolBarRender(action, rows));
          }

          if (controlsHeader && params != null) {
            result.push(
              renderControlsHeader<Params>(controlsHeader, {
                params,
                setParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) =>
                  onChangeParams(cb(params)),
              }),
            );
          }

          if (props.onPaginateExportData) {
            result.push(
              <DownloadButton
                currentPage={params?.page ?? 1}
                rowKey={rowKey}
                onExportData={props.onPaginateExportData}
                columns={columns}
                pageSize={params?.pageSize ?? DEFAULT_PAGE_SIZE}
              />,
            );
          }

          return result;
        }}
        columnsState={columnsState}
        columns={adjustedColumns}
        rowKey={rowKey}
        headerTitle={
          (showTopHeader || showBottomHeader) && (
            <div className={style.actionsHeaderWrapper}>
              {showTopHeader && (
                <div className={style.actionsHeaderWrapperTop}>
                  {showActionsHeader
                    ? renderActionHeader<Params>(actionsHeader, {
                        params,
                        setParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) =>
                          onChangeParams(cb(params)),
                      })
                    : headerTitle}
                  {headerSubtitle && <div className={style.subtitle}>{headerSubtitle}</div>}
                  {!showActionsHeader && !headerSubtitle && !headerTitle && <div></div>}
                  {showActionsHeaderRight
                    ? renderActionHeader<Params>(actionsHeaderRight, {
                        params,
                        setParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) =>
                          onChangeParams(cb(params)),
                      })
                    : showActionsHeader && headerTitle}
                </div>
              )}
              {showBottomHeader && (
                <div
                  className={style.actionsHeaderWrapperBottom}
                  style={{ marginRight: toolbarWidth }}
                >
                  <Filters
                    tableId={props.tableId}
                    filters={allFilters}
                    params={params}
                    onChangeParams={onChangeParams}
                  />
                </div>
              )}
            </div>
          )
        }
        className={cn(style.table, className, {
          [style.disableInternalPadding]: disableInternalPadding,
          [style.disableHorizontalScrolling]: disableHorizontalScrolling,
        })}
        locale={TABLE_LOCALE}
        rowClassName={(_, index) => {
          const isEven = isEvenRow ? isEvenRow(_) : index % 2 === 0;
          return disableStripedColoring || isEven ? style.tableRowLight : style.tableRowDark;
        }}
        loading={loading}
        dataSource={flatItems(dataItems, rowKey)}
        pagination={false}
        onSubmit={(newParams) => {
          if (onChangeParams != null) {
            onChangeParams({
              ...DEFAULT_PARAMS_STATE,
              ...(params ?? {}),
              ...newParams,
            });
            handleResetSelection();
          }
        }}
        onReset={handleReset}
        onChange={(pagination, filters, sorter) => {
          const sort: [string, SortOrder][] = (Array.isArray(sorter) ? sorter : [sorter]).map(
            ({ field, order }) => [field as string, order ?? 'ascend'],
          );
          onChangeParams({
            ...DEFAULT_PARAMS_STATE,
            ...(filters as unknown as Params),
            ...params,
            page: 1,
            sort: sort,
            pageSize: DEFAULT_PAGE_SIZE,
          });
        }}
        options={{
          ...(options || {}),
          reload: !options || options.reload != false ? handleReload : false,
        }}
        tableAlertRender={() => false}
        tableAlertOptionRender={() => {
          return false;
        }}
        expandable={{ ...expandable, expandIcon }}
        form={form}
        getPopupContainer={getPopupContainer}
        scroll={scroll}
        cardBordered={cardBordered}
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
      />
      {showPagination && (
        <Pagination
          isDisabled={loading}
          pageSize={params?.pageSize}
          total={data.total ?? dataItems.length}
          current={params?.page}
          onChange={(page, pageSize) => {
            if (params != null) {
              onChangeParams({ ...params, page, pageSize });
            }
          }}
          showResultsInfo={showResultsInfo}
          adjustPagination={adjustPagination}
          paginationBorder={paginationBorder}
        />
      )}
    </div>
  );
}

function renderActionHeader<Params extends object>(
  actionsHeader: ActionRenderer<Params>[],
  props: ActionRendererProps<Params>,
) {
  return (
    <div className={style.actionHeader}>
      {actionsHeader.map((action, i) => (
        <React.Fragment key={i}>{action(props)}</React.Fragment>
      ))}
    </div>
  );
}

function renderControlsHeader<Params extends object>(
  actionsHeader: ActionRenderer<Params>[],
  props: ActionRendererProps<Params>,
) {
  return (
    <div className={style.actionHeader}>
      {actionsHeader.map((action, i) => (
        <React.Fragment key={i}>{action(props)}</React.Fragment>
      ))}
    </div>
  );
}

function expandIcon<T>(props: {
  record: TableRow<T>;
  onExpand: (record: TableRow<T>, event: React.MouseEvent<HTMLElement>) => void;
  expanded: boolean;
  expandable: boolean;
}) {
  const { record, expanded, onExpand, expandable } = props;

  if (!expandable) {
    return <></>;
  }

  return <CollapsableIcon color="BLACK" expanded={expanded} onClick={(e) => onExpand(record, e)} />;
}
