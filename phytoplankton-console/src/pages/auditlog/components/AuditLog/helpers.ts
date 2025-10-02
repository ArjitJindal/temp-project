import { RangeValue } from 'rc-picker/es/interface';
import { TableItem, TableSearchParams } from './types';
import { map, QueryResult } from '@/utils/queries/types';
import { AuditLog, AuditLogActionEnum, AuditLogType } from '@/apis';
import type { PaginatedData } from '@/utils/queries/hooks';
import { RawParsedQuery } from '@/utils/routing';
import { Dayjs, dayjs } from '@/utils/dayjs';
import { defaultQueryAdapter } from '@/components/library/Table/queryAdapter';
import { AllParams } from '@/components/library/Table/types';

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

export const auditLogQueryAdapter = {
  serializer: (params: AllParams<TableSearchParams>): RawParsedQuery => {
    return {
      ...defaultQueryAdapter.serializer(params),
      filterTypes: params.filterTypes?.join(','),
      filterActionTakenBy: params.filterActionTakenBy?.join(','),
      searchEntityId: params.searchEntityId,
      filterActions: params.filterActions?.join(','),
      createdTimestamp: params.createdTimestamp?.map((t) => t?.valueOf()).join(','),
    };
  },
  deserializer: (raw: RawParsedQuery): AllParams<TableSearchParams> => {
    return {
      ...defaultQueryAdapter.deserializer(raw),
      filterTypes: raw.filterTypes?.split(',') as AuditLogType[],
      filterActionTakenBy: raw.filterActionTakenBy?.split(','),
      searchEntityId: raw.searchEntityId,
      filterActions: raw.filterActions?.split(',') as AuditLogActionEnum[],
      createdTimestamp: raw.createdTimestamp
        ?.split(',')
        .map((t) => dayjs(Number(t))) as RangeValue<Dayjs>,
    };
  },
};
