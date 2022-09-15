import { message } from 'antd';
import { ProTableProps } from '@ant-design/pro-table';
import type { ParamsType } from '@ant-design/pro-provider';
import React, { useCallback, useEffect, useState } from 'react';
import { SortOrder } from 'antd/es/table/interface';
import Table, { ActionRenderer, AllParams, RowSelection } from '../ui/Table';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isLoading,
  loading as makeLoading,
  success,
} from '@/utils/asyncResource';
import { getErrorMessage, isEqual } from '@/utils/lang';
import { useDeepEqualEffect, usePrevious } from '@/utils/hooks';
import { TableColumn, TableData, TableDataItem, TableRow } from '@/components/ui/Table/types';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';

export type TableActionType = {
  reload: () => void;
};

export type RequestFunctionType<T extends object, Params extends object = ParamsType> = (
  params: Params & {
    pageSize?: number;
    current?: number;
    keyword?: string;
  },
  sort: Record<string, SortOrder>,
  filter: Record<string, React.ReactText[] | null>,
) => Promise<TableData<T>>;

interface OverridenProps<T extends object, Params extends object = ParamsType> {
  loading?: boolean;
  bordered?: boolean;
  headerTitle?: React.ReactNode;
  request?: RequestFunctionType<T, Params>;
  pagination?: boolean;
  actionRef?: React.Ref<TableActionType>;
}

type ParamsState<Params extends object> = {
  page: number;
  pageSize: number;
  params: Params;
  sort: Record<string, SortOrder>;
};

type PickedUpProps<T extends object, Params, ValueType> = Pick<
  ProTableProps<TableRow<T>, Params, ValueType>,
  | 'className'
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
>;

interface Props<T extends object, Params extends object, ValueType>
  extends PickedUpProps<T, Params, ValueType>,
    OverridenProps<T, Params> {
  initialParams?: ParamsState<Params>;
  isEvenRow?: (item: T) => boolean;
  disableStripedColoring?: boolean;
  disableExpandedRowPadding?: boolean;
  disableInternalPadding?: boolean;
  cardBordered?: boolean;
  actionsHeader?: ActionRenderer<ParamsState<Params>>[];
  columns: TableColumn<T>[];
  rowSelection?: RowSelection;
  rowKey?: string;
  dataSource?: TableDataItem<T>[];
}

const DEFAULT_PARAMS_STATE: ParamsState<any> = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  params: {} as any,
  sort: {},
};

/**
 * @deprecated Use `utils/queries/hooks.ts#useQuery` and `QueryResultsTable` instead
 */
export const RequestTable = <
  T extends object,
  Params extends object = ParamsType,
  ValueType = 'text',
>(
  props: Props<T, Params, ValueType>,
) => {
  const {
    toolBarRender,
    formRef,
    search,
    expandable,
    form,
    columns,
    rowKey = '_id',
    getPopupContainer,
    scroll,
    bordered,
    cardBordered,
    disableStripedColoring = false,
    disableExpandedRowPadding = false,
    disableInternalPadding = false,
    className,
    isEvenRow,
    request,
    dataSource,
    pagination = true,
    options = undefined,
    initialParams,
    actionRef,
    headerTitle,
    actionsHeader,
    loading,
    rowSelection,
    defaultSize,
    tooltip,
    // ...rest
  } = props;

  const [paramsState, setParamsState] = useState<ParamsState<Params>>(
    initialParams ?? DEFAULT_PARAMS_STATE,
  );
  const [responseData, setResponseData] = useState<AsyncResource<TableData<T>>>(
    dataSource ? success({ total: dataSource.length, items: [...dataSource] }) : init(),
  );

  useDeepEqualEffect(() => {
    if (dataSource != null) {
      setResponseData(success({ total: dataSource.length, items: [...dataSource] }));
    }
  }, [dataSource]);

  const handleRequest = useCallback(() => {
    if (request != null) {
      setResponseData((state) => makeLoading(getOr(state, null)));
      request(
        { ...paramsState.params, current: paramsState.page, pageSize: paramsState.pageSize },
        paramsState.sort,
        {},
      )
        .then((results) => {
          setResponseData(success(results));
        })
        .catch((e) => {
          console.log(e);
          message.error(`Unable to load table data! ${getErrorMessage(e)}`);
          setResponseData((state) => failed(getErrorMessage(e), getOr(state, null)));
        });
    }
  }, [paramsState, request]);

  const prevState = usePrevious(paramsState);
  useDeepEqualEffect(() => {
    if (prevState != null && !isEqual(prevState?.params, paramsState.params)) {
      console.log('prevState?.params', prevState?.params);
      console.log('paramsState.params', paramsState.params);
      rowSelection?.onChange([]);
      setParamsState((state) => ({ ...state, page: 1 }));
    }
  }, [prevState, paramsState.params, rowSelection]);

  useEffect(() => {
    if (pagination && !isEqual(prevState, paramsState)) {
      handleRequest();
    }
  }, [handleRequest, pagination, paramsState, prevState]);

  // Load data only once if pagination is disabled
  useEffect(() => {
    if (!pagination) {
      handleRequest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Table
      toolBarRender={toolBarRender}
      formRef={formRef}
      bordered={bordered}
      rowKey={rowKey}
      columns={columns}
      className={className}
      disableStripedColoring={disableStripedColoring}
      disableExpandedRowPadding={disableExpandedRowPadding}
      disableInternalPadding={disableInternalPadding}
      actionRef={actionRef}
      headerTitle={headerTitle}
      loading={isLoading(responseData) || loading || false}
      data={getOr(responseData, { items: [] })}
      options={options}
      pagination={pagination}
      rowSelection={rowSelection}
      params={{
        ...paramsState.params,
        pageSize: DEFAULT_PAGE_SIZE,
        // ...DEFAULT_PARAMS_STATE,
        page: paramsState.page,
        sort: Object.entries(paramsState.sort),
      }}
      isEvenRow={isEvenRow}
      actionsHeader={
        actionsHeader != null
          ? actionsHeader.map(
              (actionItem): ActionRenderer<Params> =>
                () => {
                  return actionItem({
                    params: paramsState,
                    setParams: (
                      cb: (
                        params: AllParams<ParamsState<Params>>,
                      ) => AllParams<ParamsState<Params>>,
                    ) => {
                      setParamsState((prevState) => ({
                        ...prevState,
                        ...cb(prevState as AllParams<ParamsState<Params>>),
                      }));
                    },
                  });
                },
            )
          : actionsHeader
      }
      search={search}
      expandable={expandable}
      form={form}
      getPopupContainer={getPopupContainer}
      scroll={scroll}
      onChangeParams={(paramsState) => {
        const { page, pageSize, sort, ...params } = paramsState;
        setParamsState((state) => ({
          ...state,
          params: params as Params,
          page,
          pageSize,
          sort: sort.reduce((acc, [key, order]) => ({ ...acc, [key]: order }), {}),
        }));
      }}
      cardBordered={cardBordered}
      defaultSize={defaultSize}
      tooltip={tooltip}
      onReload={handleRequest}
    />
  );
};
