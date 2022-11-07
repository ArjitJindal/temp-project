import ProTable, { ProTableProps } from '@ant-design/pro-table';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Checkbox, Pagination } from 'antd';
import _ from 'lodash';
import cn from 'clsx';
import style from './style.module.less';
import { flatItems, handleResize, TABLE_LOCALE } from './utils';
import { DEFAULT_PAGE_SIZE } from './consts';
import { isMultiRows, SortOrder, TableColumn, TableData, TableRow } from './types';
import { isEqual } from '@/utils/lang';
import { usePrevious } from '@/utils/hooks';
import ResizableTitle from '@/utils/table-utils';

export type TableActionType = {
  reload: () => void;
};

export interface CommonParams {
  page: number;
  pageSize: number;
  sort: [string, SortOrder][];
}

export type AllParams<Params> = Params & CommonParams;

export type ActionRendererProps<Params extends object> = {
  params: Params;
  setParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) => void;
};

export type ActionRenderer<Params extends object> = (
  props: ActionRendererProps<Params>,
) => React.ReactNode;

export interface RowSelection {
  selectedKeys: string[];
  onChange: (selectedIds: string[]) => void;
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

export interface Props<T extends object, Params extends object, ValueType>
  extends PickUpProps<TableRow<T>, Params, ValueType> {
  rowKey: string;
  className?: string;
  cardBordered?: boolean;
  disableStripedColoring?: boolean;
  disableExpandedRowPadding?: boolean;
  disableInternalPadding?: boolean;
  actionRef?: React.Ref<TableActionType>;
  loading?: boolean;
  data: TableData<T>;
  pagination?: boolean;
  rowSelection?: RowSelection;
  params?: AllParams<Params>;
  isEvenRow?: (item: T) => boolean;
  actionsHeader?: ActionRenderer<Params>[];
  onChangeParams?: (newState: AllParams<Params>) => void;
  columns: TableColumn<T>[];
  headerSubtitle?: React.ReactNode;
  onReload?: () => void;
  onReset?: () => void;
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
    className,
    isEvenRow,
    options,
    actionRef,
    headerTitle,
    headerSubtitle,
    actionsHeader,
    rowSelection,
    loading,
    pagination,
    data,
    params,
    columns,
    rowKey,
    expandable,
    search,
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
  } = props;

  const handleResetSelection = useCallback(() => {
    rowSelection?.onChange([]);
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
    [key: number]: number;
  }>({});

  function adjustColumns<T extends object>(
    columns: TableColumn<T>[] | undefined | null,
  ): TableColumn<T>[] {
    return (columns ?? []).map(
      (col: TableColumn<T>, index): TableColumn<T> => ({
        ...col,
        sortOrder: params?.sort.find(([field]) => field === col.dataIndex)?.[1],
        width: updatedColumnWidth[index] || col.width,
        onHeaderCell: (column) => ({
          width: (column as TableColumn<T>).width,
          onResize: handleResize(index, setUpdatedColumnWidth),
        }),
        ...('children' in col
          ? {
              children: adjustColumns(col.children),
            }
          : {}),
      }),
    );
  }

  const adjustedColumns: TableColumn<T>[] = adjustColumns(columns);

  if (rowSelection != null) {
    const allSelected =
      dataKeys.length > 0 &&
      dataKeys.every((key) => rowSelection?.selectedKeys.indexOf(key) !== -1);

    const someSelected =
      dataKeys.length > 0 && dataKeys.some((key) => rowSelection?.selectedKeys.indexOf(key) !== -1);

    adjustedColumns.unshift({
      search: false,
      hideInSetting: true,
      title: (
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected && !allSelected}
          onChange={(e) => {
            rowSelection.onChange(e.target.checked ? dataKeys : []);
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
            checked={isSelected}
            onChange={(e) => {
              const currentSelection = (rowSelection?.selectedKeys ?? []).filter((x) => x !== key);
              rowSelection?.onChange(
                e.target.checked ? [...currentSelection, key] : currentSelection,
              );
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

  return (
    <div className={style.root}>
      <ProTable<TableRow<T>, Params>
        toolBarRender={toolBarRender}
        columnsState={columnsState}
        columns={adjustedColumns}
        rowKey={rowKey}
        headerTitle={
          (actionsHeader || headerTitle || headerSubtitle) && (
            <div className={style.actionsHeaderWrapper}>
              {actionsHeader != null && params != null
                ? renderActionHeader<Params>(actionsHeader, {
                    params,
                    setParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) =>
                      onChangeParams(cb(params)),
                  })
                : headerTitle}
              {headerSubtitle && <div className={style.subtitle}>{headerSubtitle}</div>}
            </div>
          )
        }
        className={cn(style.table, className, {
          [style.disableExpandedRowPadding]: disableExpandedRowPadding,
          [style.disableInternalPadding]: disableInternalPadding,
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
            page: 1,
            sort: sort,
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
        expandable={expandable}
        search={search}
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
      {pagination !== false && (
        <Pagination
          disabled={loading}
          className={style.pagination}
          size="small"
          showSizeChanger={false}
          pageSize={params?.pageSize ?? DEFAULT_PAGE_SIZE}
          showTitle={true}
          total={data.total ?? dataItems.length}
          current={params?.page}
          onChange={(page) => {
            if (params != null) {
              onChangeParams({ ...params, page });
            }
          }}
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
