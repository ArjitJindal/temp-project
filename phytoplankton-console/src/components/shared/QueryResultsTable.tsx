import React, { useCallback, useEffect, useMemo } from 'react';
import { ParamsType } from '@ant-design/pro-provider';
import Table, { Props as TableProps } from '@/components/library/Table';
import type { QueryResult } from '@/utils/queries/types';
import { CommonParams, TableData, TableDataItem } from '@/components/library/Table/types';
import { getOr, isSuccess } from '@/utils/asyncResource';

type Props<Item extends object, Params extends object = ParamsType> = Omit<
  TableProps<Item, Params>,
  'data' | 'loading'
> & {
  queryResults: QueryResult<TableData<Item>>;
  countQueryResults?: QueryResult<{ total: number }>;
  showResultsInfo?: boolean;
  retainSelectedIds?: boolean;
};

export default function QueryResultsTable<T extends object, Params extends object = CommonParams>(
  props: Props<T, Params>,
): JSX.Element {
  const {
    queryResults,
    countQueryResults,
    showResultsInfo = true,
    expandedRowId,
    retainSelectedIds,
    ...rest
  } = props;
  const { selectedIds, rowKey, onSelect } = rest;
  const handleReload = useCallback(() => {
    rest.onReload?.();
    queryResults.refetch();
  }, [queryResults, rest]);

  const items: TableDataItem<T>[] = useMemo(() => {
    if (isSuccess(queryResults.data)) {
      return getOr(queryResults.data, { items: [] }).items;
    }
    return [];
  }, [queryResults.data]);

  useEffect(() => {
    if (!selectedIds?.length || !isSuccess(queryResults.data) || retainSelectedIds) {
      return;
    }

    const filtered = selectedIds.filter((id) =>
      items.some((item) => item[rowKey as keyof CommonParams] === id),
    );

    if (filtered.length !== selectedIds.length) {
      onSelect?.(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <Table
      {...rest}
      onReload={handleReload}
      data={queryResults.data}
      cursor={queryResults?.cursor}
      onPaginateData={queryResults.paginate ?? rest.onPaginateData}
      showResultsInfo={showResultsInfo}
      countResults={countQueryResults?.data}
      expandedRowId={expandedRowId}
    />
  );
}
