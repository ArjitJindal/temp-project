import React from 'react';
import { ParamsType } from '@ant-design/pro-provider';
import { Alert } from 'antd';
import s from './styles.module.less';
import Table, { CommonParams, Props as TableProps } from '@/components/ui/Table';
import { TableData } from '@/components/ui/Table/types';
import { getOr, isFailed, isLoading, isSuccess } from '@/utils/asyncResource';
import { QueryResult } from '@/utils/queries/types';

type Props<T extends object, Params extends object = ParamsType, ValueType = 'text'> = Omit<
  TableProps<T, Params, ValueType>,
  'data' | 'loading'
> & {
  queryResults: QueryResult<TableData<T>>;
  showResultsInfo?: boolean;
};

export default function QueryResultsTable<
  T extends object,
  Params extends object = CommonParams,
  ValueType = 'text',
>(props: Props<T, Params, ValueType>): JSX.Element {
  const { queryResults, actionsHeader, showResultsInfo = false, ...rest } = props;

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
      actionsHeader={actionsHeader}
      headerSubtitle={
        showResultsInfo &&
        isSuccess(queryResults.data) && (
          <div className={s.count}>
            Displaying {queryResults.data.value.items.length} of {queryResults.data.value.total}{' '}
            results
          </div>
        )
      }
      onReload={queryResults.refetch}
      loading={isLoading(queryResults.data)}
      data={getOr(queryResults.data, {
        items: [],
      })}
    />
  );
}
