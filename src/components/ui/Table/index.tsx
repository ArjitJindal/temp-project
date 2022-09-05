import ProTable, { ProTableProps } from '@ant-design/pro-table';
import type { ParamsType } from '@ant-design/pro-provider';
import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  Key,
} from 'react';
import { message, Pagination } from 'antd';
import { SortOrder } from 'antd/es/table/interface';
import _ from 'lodash';
import cn from 'clsx';
import equal from 'fast-deep-equal';
import style from './style.module.less';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/constants';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isLoading,
  loading as makeLoading,
  map,
  success,
} from '@/utils/asyncResource';
import { getErrorMessage, isEqual } from '@/utils/lang';
import { useDeepEqualEffect, usePrevious } from '@/utils/hooks';

export type TableActionType = {
  reload: () => void;
};

export type ResponsePayload<T> = {
  success?: boolean;
  total?: number;
  data: Array<T | T[]>;
};

export type RequestFunctionType<T, Params extends object = ParamsType> = (
  params: Params & {
    pageSize?: number;
    current?: number;
    keyword?: string;
  },
  sort: Record<string, SortOrder>,
  filter: Record<string, React.ReactText[] | null>,
) => Promise<ResponsePayload<T>>;
interface OverridenProps<T, Params extends object = ParamsType> {
  request?: RequestFunctionType<T, Params>;
  pagination?: boolean;
  actionRef?: React.Ref<TableActionType>;
}

type ParamsState<Params extends object = ParamsType> = {
  page: number;
  params: Params;
  sort: Record<string, SortOrder>;
};

type ActionRendererProps<Params extends object = ParamsType> = {
  params: ParamsState<Params>;
  setParams: Dispatch<SetStateAction<ParamsState<Params>>>;
};
type ActionRenderer<Params extends object = ParamsType> = (
  props: ActionRendererProps<Params>,
) => React.ReactNode;

interface EntityRowSelection<T> {
  selectedEntities: string[];
  onChange: (selectedRows: Key[]) => void;
  renderCell: (
    value: boolean,
    record: T,
    index: number,
    originNode: React.ReactNode,
  ) => React.ReactNode;
}

interface Props<T, Params extends object, ValueType>
  extends Omit<ProTableProps<T, Params, ValueType>, keyof OverridenProps<T, Params>>,
    OverridenProps<T, Params> {
  initialParams?: ParamsState<Params>;
  isEvenRow?: (item: T) => boolean;
  disableStripedColoring?: boolean;
  disableExpandedRowPadding?: boolean;
  disableInternalPadding?: boolean;
  data?: ResponsePayload<T>;
  actionsHeader?: ActionRenderer<Params>[];
  entitySelection?: EntityRowSelection<T>;
}

const TABLE_LOCALE = {
  emptyText: 'No data',
  sortTitle: 'Sort by this column',
  triggerDesc: 'Sort descending',
  triggerAsc: 'Sort ascending',
  filterTitle: 'Filtering',
  filterConfirm: 'Confirm',
  filterReset: 'Reset',
  filterEmptyText: 'Empty',
  filterCheckall: 'Check all',
  filterSearchPlaceholder: 'Search...',
  selectAll: 'All',
  selectNone: 'None',
  selectInvert: 'Invert',
  selectionAll: 'All',
  expand: 'Expand',
  collapse: 'Collapse',
  cancelSort: 'Cancel',
};

function prepareDataSource<T>(data: Array<T | T[]>): T[] {
  const result = [];
  for (const datum of data) {
    if (Array.isArray(datum)) {
      result.push(...datum);
    } else {
      result.push(datum);
    }
  }
  return result;
}

const DEFAULT_PARAMS_STATE = {
  page: 1,
  params: {} as any,
  sort: {},
};

export const Table = <T, Params extends object = ParamsType, ValueType = 'text'>(
  props: Props<T, Params, ValueType>,
) => {
  const {
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
    entitySelection,
    ...rest
  } = props;

  const [paramsState, setParamsState] = useState<ParamsState<Params>>(
    initialParams ?? DEFAULT_PARAMS_STATE,
  );
  const [responseData, setResponseData] = useState<
    AsyncResource<{
      total: number;
      items: T[];
    }>
  >(dataSource ? success({ total: dataSource.length, items: [...dataSource] }) : init());

  useDeepEqualEffect(() => {
    if (dataSource != null) {
      setResponseData(success({ total: dataSource.length, items: [...dataSource] }));
    }
  }, [dataSource]);

  useImperativeHandle<TableActionType, TableActionType>(actionRef, () => ({
    reload() {
      onSelectChange([]);
      setParamsState(_.cloneDeep(paramsState));
    },
  }));

  // todo: implement cancelation
  const handleRequest = useCallback(
    (
      params: Params & {
        pageSize: number;
        current: number;
      },
      sort: Record<string, SortOrder>,
      filter: Record<string, React.ReactText[] | null>,
    ) => {
      if (request != null) {
        setResponseData((state) => makeLoading(getOr(state, null)));
        request(params, sort, filter)
          .then((results) => {
            setResponseData(
              success({
                total: results.total ?? 0,
                items: prepareDataSource(results.data ?? []),
              }),
            );
          })
          .catch((e) => {
            console.log(e);
            message.error(`Unable to load table data! ${getErrorMessage(e)}`);
            setResponseData((state) => failed(getErrorMessage(e), getOr(state, null)));
          });
      }
    },
    [request],
  );

  const handleReload = useCallback(() => {
    handleRequest(
      { ...paramsState.params, pageSize: DEFAULT_PAGE_SIZE, current: paramsState.page },
      paramsState.sort,
      {},
    );
  }, [handleRequest, paramsState.page, paramsState.params, paramsState.sort]);

  const prevState = usePrevious(paramsState);
  useDeepEqualEffect(() => {
    if (prevState != null && !isEqual(prevState?.params, paramsState.params)) {
      onSelectChange([]);
      setParamsState((state) => ({ ...state, page: 1 }));
    }
  }, [prevState, paramsState.params]);

  useEffect(() => {
    if (pagination && !equal(prevState, paramsState)) {
      handleReload();
    }
  }, [handleReload, pagination, paramsState, prevState]);

  // Load data only once if pagination is disabled
  useEffect(() => {
    if (!pagination) {
      handleReload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    entitySelection?.onChange(newSelectedRowKeys);
  };

  return (
    <div className={style.root}>
      <ProTable<T, Params, ValueType>
        headerTitle={
          actionsHeader != null
            ? renderActionHeader<Params>(actionsHeader, {
                params: paramsState,
                setParams: setParamsState,
              })
            : headerTitle
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
        {...rest}
        loading={isLoading(responseData) || loading}
        dataSource={getOr(
          map(responseData, ({ items }) => items),
          [],
        )}
        pagination={false}
        onSubmit={(newParams) => {
          setParamsState((state) => ({
            ...state,
            params: { ...state.params, ...newParams },
          }));
          onSelectChange([]);
        }}
        onReset={() => setParamsState(DEFAULT_PARAMS_STATE)}
        onChange={(pagination, filters, sorter) => {
          const sort: Record<string, SortOrder> = (
            Array.isArray(sorter) ? sorter : [sorter]
          ).reduce(
            (acc, { field, order }) => ({
              ...acc,
              [`${field}`]: order ?? 'ascend',
            }),
            {} as Record<string, SortOrder>,
          );
          setParamsState({
            page: 1,
            params: filters as unknown as Params,
            sort: sort,
          });
        }}
        options={{
          ...(options || {}),
          reload: !options || options.reload != false ? handleReload : false,
        }}
        rowSelection={
          entitySelection
            ? {
                selectedRowKeys,
                onChange: onSelectChange,
                renderCell: entitySelection?.renderCell,
              }
            : undefined
        }
        tableAlertRender={() => false}
        tableAlertOptionRender={() => {
          return false;
        }}
      />
      {pagination !== false && (
        <Pagination
          disabled={isLoading(responseData)}
          className={style.pagination}
          size="small"
          showSizeChanger={false}
          pageSize={DEFAULT_PAGE_SIZE}
          showTitle={true}
          total={getOr(
            map(responseData, ({ total }) => total),
            1,
          )}
          current={paramsState.page}
          onChange={(page) => {
            setParamsState((state) => ({ ...state, page }));
          }}
        />
      )}
    </div>
  );
};

function renderActionHeader<Params extends object = ParamsType>(
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
