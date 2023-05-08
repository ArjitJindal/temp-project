import React from 'react';
import { ParamsType } from '@ant-design/pro-provider';
import Table, { Props as TableProps } from '@/components/library/Table';
import { QueryResult } from '@/utils/queries/types';
import { CommonParams, TableData } from '@/components/library/Table/types';

type Props<Item extends object, Params extends object = ParamsType> = Omit<
  TableProps<Item, Params>,
  'data' | 'loading'
> & {
  queryResults: QueryResult<TableData<Item>>;
  showResultsInfo?: boolean;
};

export default function QueryResultsTable<T extends object, Params extends object = CommonParams>(
  props: Props<T, Params>,
): JSX.Element {
  const { queryResults, showResultsInfo = true, ...rest } = props;

  return (
    <Table
      {...rest}
      onReload={queryResults.refetch}
      data={queryResults.data}
      fetchPreviousPage={queryResults?.fetchPreviousPage}
      fetchNextPage={queryResults?.fetchNextPage}
      hasPreviousPage={queryResults?.hasPreviousPage}
      hasNextPage={queryResults?.hasNextPage}
      onPaginateData={queryResults.paginate}
      showResultsInfo={showResultsInfo}
    />
  );
}
