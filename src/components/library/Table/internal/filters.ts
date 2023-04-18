import { useMemo } from 'react';
import { UNKNOWN } from '../standardDataTypes';
import {
  AutoFilter,
  AutoFilterDataType,
  flatColumns,
  isSimpleColumn,
  TableColumn,
} from '@/components/library/Table/types';

export function useAutoFilters<T extends object>(columns: TableColumn<T>[]): AutoFilter[] {
  return useMemo(() => {
    return flatColumns(columns)
      .filter(isSimpleColumn)
      .filter((column) => (column.filtering && typeof column.key === 'string') ?? false)
      .map((column): AutoFilter => {
        const { type = UNKNOWN } = column;
        const dataType: AutoFilterDataType = type.autoFilterDataType
          ? type.autoFilterDataType
          : { kind: 'string' };

        return {
          kind: 'AUTO',
          key: column.id ?? (column.key as string),
          title: column.title,
          icon: column?.icon,
          dataType,
        };
      });
  }, [columns]);
}
