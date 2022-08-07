import ProTable from '@ant-design/pro-table';
import type { ParamsType } from '@ant-design/pro-provider';
import React, { useCallback, useEffect, useState } from 'react';
import { ProTableProps } from '@ant-design/pro-table/lib';
import { message, Pagination } from 'antd';
import { SortOrder } from 'antd/lib/table/interface';
import style from './style.module.less';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/constants';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isLoading,
  loading,
  map,
  success,
} from '@/utils/asyncResource';
import { getErrorMessage, isEqual } from '@/utils/lang';

export type ResponsePayload<T> = {
  success?: boolean;
  total?: number;
  data: Array<T | T[]>;
};

type RequestFunctionType<T, Params> = (
  params: Params & {
    pageSize?: number;
    current?: number;
    keyword?: string;
  },
  sort: Record<string, SortOrder>,
  filter: Record<string, React.ReactText[] | null>,
) => Promise<ResponsePayload<T>>;

interface OverridenProps<T, Params> {
  request?: RequestFunctionType<T, Params>;
  pagination?: boolean;
}

interface Props<T, Params extends object, ValueType>
  extends Omit<ProTableProps<T, Params, ValueType>, keyof OverridenProps<T, Params>>,
    OverridenProps<T, Params> {
  initialParams?: ParamsState<Params>;
  isEvenRow?: (item: T) => boolean;
  disableStripedColoring?: boolean;
  disableExpandedRowPadding?: boolean;
  data?: ResponsePayload<T>;
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

type ParamsState<Params extends object = ParamsType> = {
  page: number;
  params: Params;
  sort: Record<string, SortOrder>;
};

export default function Table<T, Params extends object = ParamsType, ValueType = 'text'>(
  props: Props<T, Params, ValueType>,
) {
  const {
    disableStripedColoring = false,
    disableExpandedRowPadding = false,
    className,
    isEvenRow,
    request,
    dataSource,
    pagination,
    options = undefined,
    initialParams,
    ...rest
  } = props;

  const [params, setParams] = useState<ParamsState<Params>>(
    initialParams ?? {
      page: 1,
      params: {} as Params,
      sort: {},
    },
  );
  const [responseData, setResponseData] = useState<
    AsyncResource<{
      total: number;
      items: T[];
    }>
  >(dataSource ? success({ total: dataSource.length, items: [...dataSource] }) : init());

  const [firstRequest] = useState<RequestFunctionType<T, Params> | undefined>(() => request);
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
      if (firstRequest != null) {
        setResponseData((state) => loading(getOr(state, null)));
        firstRequest(params, sort, filter)
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
    [firstRequest],
  );

  const triggerRequest = useCallback(() => {
    handleRequest(
      { ...params.params, pageSize: DEFAULT_PAGE_SIZE, current: params.page },
      params.sort,
      {},
    );
  }, [handleRequest, params.params, params.page, params.sort]);

  useEffect(() => {
    triggerRequest();
  }, [triggerRequest]);

  return (
    <div className={style.root}>
      <ProTable<T, Params, ValueType>
        className={[
          style.table,
          className,
          disableExpandedRowPadding && style.disableExpandedRowPadding,
        ]
          .filter((x) => !!x)
          .join(' ')}
        locale={TABLE_LOCALE}
        rowClassName={(_, index) => {
          const isEven = isEvenRow ? isEvenRow(_) : index % 2 === 0;
          return disableStripedColoring || isEven ? style.tableRowLight : style.tableRowDark;
        }}
        {...rest}
        loading={isLoading(responseData)}
        dataSource={getOr(
          map(responseData, ({ items }) => items),
          [],
        )}
        pagination={false}
        onSubmit={(newParams) => {
          setParams((state) => ({
            ...state,
            params: newParams,
            page: isEqual(params.params, newParams) ? state.page : 1,
          }));
        }}
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
          setParams({
            page: 1,
            params: filters as unknown as Params,
            sort: sort,
          });
        }}
        options={{
          ...(options || {}),
          reload: !options || options.reload != false ? triggerRequest : false,
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
          current={params.page}
          onChange={(page) => {
            setParams((state) => ({ ...state, page }));
          }}
        />
      )}
    </div>
  );
}
