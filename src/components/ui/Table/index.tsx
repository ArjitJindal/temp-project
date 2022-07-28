import ProTable, { enUSIntl } from '@ant-design/pro-table';
import type { ParamsType } from '@ant-design/pro-provider';
import React from 'react';
import { ProTableProps } from '@ant-design/pro-table/lib';
import style from './style.module.less';

interface Props<T, U, ValueType> extends ProTableProps<T, U, ValueType> {
  disableStripedColoring?: boolean;
}

const TABLE_LOCALE = {
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

export default function Table<T, U = ParamsType, ValueType = 'text'>(
  props: Props<T, U, ValueType>,
) {
  const { disableStripedColoring = false, className, ...rest } = props;

  return (
    <ProTable
      className={[style.root, className].filter((x) => !!x).join(' ')}
      locale={TABLE_LOCALE}
      rowClassName={(_, index) =>
        disableStripedColoring || index % 2 === 0 ? style.tableRowLight : style.tableRowDark
      }
      {...rest}
    />
  );
}
