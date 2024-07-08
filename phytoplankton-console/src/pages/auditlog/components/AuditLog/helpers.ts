import { RangeValue } from 'rc-picker/es/interface';
import { TableItem, TableSearchParams } from './types';
import { map, QueryResult } from '@/utils/queries/types';
import { AuditLog, AuditLogActionEnum, AuditLogType } from '@/apis';
import { PaginatedData } from '@/utils/queries/hooks';
import { RawParsedQuery } from '@/utils/routing';
import { Dayjs, dayjs } from '@/utils/dayjs';

export function useTableData(
  queryResult: QueryResult<PaginatedData<AuditLog>>,
): QueryResult<PaginatedData<TableItem>> {
  return map(
    queryResult,
    (response): PaginatedData<TableItem> => ({
      total: response.total,
      items: response.items.map(
        (item, index): TableItem => ({
          index,
          ...item,
        }),
      ),
    }),
  );
}

export function deserializeParams(raw: RawParsedQuery): TableSearchParams {
  return {
    filterTypes: raw.filterTypes?.split(',') as AuditLogType[],
    filterActionTakenBy: raw.filterActionTakenBy?.split(','),
    searchEntityId: raw.searchEntityId,
    filterActions: raw.filterActions?.split(',') as AuditLogActionEnum[],
    createdTimestamp: raw.createdTimestamp
      ?.split(',')
      .map((t) => dayjs(Number(t))) as RangeValue<Dayjs>,
  };
}
