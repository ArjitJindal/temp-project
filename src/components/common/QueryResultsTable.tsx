import React from 'react';
import { ParamsType } from '@ant-design/pro-provider';
import { Alert } from 'antd';
import Table, { CommonParams, Props as TableProps } from '@/components/ui/Table';
import { TableData } from '@/components/ui/Table/types';
import { getOr, isFailed, isLoading } from '@/utils/asyncResource';
import { QueryResult } from '@/utils/queries/types';

type Props<T extends object, Params extends object = ParamsType, ValueType = 'text'> = Omit<
  TableProps<T, Params, ValueType>,
  'data' | 'loading'
> & {
  queryResults: QueryResult<TableData<T>>;
};

export default function QueryResultsTable<
  T extends object,
  Params extends object = CommonParams,
  ValueType = 'text',
>(props: Props<T, Params, ValueType>): JSX.Element {
  const { queryResults, ...rest } = props;

  if (isFailed(queryResults.data)) {
    return (
      <Alert
        type="error"
        message={`Unable to load data for the table! ${queryResults.data.message}`}
      />
    );
  }

  return (
    <Table
      {...rest}
      onReload={queryResults.refetch}
      loading={isLoading(queryResults.data)}
      data={getOr(queryResults.data, {
        items: [],
      })}
    />
  );
}
