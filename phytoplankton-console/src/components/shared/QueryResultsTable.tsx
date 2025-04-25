import React, { useCallback } from 'react';
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
  const { queryResults, showResultsInfo = true, expandedRowId, ...rest } = props;
  const handleReload = useCallback(() => {
    rest.onReload?.();
    queryResults.refetch();
  }, [queryResults, rest]);

  return (
    <Table
      {...rest}
      onReload={handleReload}
      data={queryResults.data}
      cursor={queryResults?.cursor}
      onPaginateData={queryResults.paginate ?? rest.onPaginateData}
      showResultsInfo={showResultsInfo}
      expandedRowId={expandedRowId}
    />
  );
}
