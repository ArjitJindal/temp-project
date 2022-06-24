import ProTable from '@ant-design/pro-table';
import type { ParamsType } from '@ant-design/pro-provider';
import React from 'react';
import { ProTableProps } from '@ant-design/pro-table/lib';
import style from './style.less';

interface Props<T, U, ValueType> extends ProTableProps<T, U, ValueType> {
  disableStripedColoring?: boolean;
}

export default function Table<T, U = ParamsType, ValueType = 'text'>(
  props: Props<T, U, ValueType>,
) {
  const { disableStripedColoring = false, ...rest } = props;
  return (
    <ProTable
      rowClassName={(_, index) =>
        disableStripedColoring || index % 2 === 0 ? style.tableRowLight : style.tableRowDark
      }
      {...rest}
    />
  );
}
