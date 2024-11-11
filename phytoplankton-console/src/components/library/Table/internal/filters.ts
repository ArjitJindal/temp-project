import { useMemo } from 'react';
import { UNKNOWN } from '../standardDataTypes';
import {
  flatColumns,
  getColumnId,
  isSimpleColumn,
  TableColumn,
} from '@/components/library/Table/types';
import { AutoFilterProps, AutoFilterDataType } from '@/components/library/Filter/types';

export function useAutoFilters<T extends object>(columns: TableColumn<T>[]): AutoFilterProps[] {
  return useMemo(() => {
    return flatColumns(columns)
      .filter(isSimpleColumn)
      .filter((column) => (column.filtering && typeof column.key === 'string') ?? false)
      .map((column): AutoFilterProps => {
        const { type = UNKNOWN } = column;
        const dataType: AutoFilterDataType = type.autoFilterDataType
          ? type.autoFilterDataType
          : { kind: 'string' };

        return {
          kind: 'AUTO',
          key: getColumnId(column),
          title: column.title,
          icon: column?.icon,
          pinFilterToLeft: column.pinFilterToLeft,
          dataType,
        };
      });
  }, [columns]);
}
