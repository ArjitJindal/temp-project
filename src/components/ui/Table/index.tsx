import ProTable from '@ant-design/pro-table';
import type { ParamsType } from '@ant-design/pro-provider';
import React from 'react';
import { ProTableProps } from '@ant-design/pro-table/lib';
import style from './style.less';

export default function Table<T, U = ParamsType, ValueType = 'text'>(
  props: ProTableProps<T, U, ValueType>,
) {
  const { ...rest } = props;
  return (
    <ProTable
      rowClassName={(_, index) => (index % 2 === 0 ? style.tableRowLight : style.tableRowDark)}
      {...rest}
    />
  );
}
