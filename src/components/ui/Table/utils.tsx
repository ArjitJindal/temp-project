import { ResizeCallbackData } from 'react-resizable';
import React from 'react';
import { isMultiRows, TableDataItem, TableRow } from '@/components/ui/Table/types';

export const handleResize =
  (
    index: string,
    setUpdatedColumnWidth: React.Dispatch<
      React.SetStateAction<{
        [key: string]: number;
      }>
    >,
  ) =>
  (_: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
    setUpdatedColumnWidth((prev) => ({
      ...prev,
      [index]: size.width,
    }));
  };

export function flatItems<T extends object>(
  data: Array<TableDataItem<T>>,
  rowKey: string,
): TableRow<T>[] {
  const result: TableRow<T>[] = [];
  for (let i = 0; i < data.length; i += 1) {
    const datum = data[i];
    if (isMultiRows<T>(datum)) {
      for (let j = 0; j < datum.rows.length; j += 1) {
        const row: T = datum.rows[j];
        result.push({
          ...row,
          isFirstRow: j === 0,
          isLastRow: j === datum.rows.length - 1,
          rowsCount: datum.rows.length,
          entityKey: datum.item[rowKey],
        });
      }
    } else {
      result.push({
        ...datum,
        isFirstRow: true,
        isLastRow: true,
        rowsCount: 1,
        entityKey: datum[rowKey],
      });
    }
  }
  return result;
}

export const TABLE_LOCALE = {
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
