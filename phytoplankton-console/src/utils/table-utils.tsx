import React from 'react';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
import { map, type QueryResult } from '@/utils/queries/types';
import type { TableDataItem } from '@/components/library/Table/types';
import type { PaginatedData } from '@/utils/queries/hooks';

export const DEFAULT_BULK_ACTIONS_LIMIT = 20;

export const ResizableTitle = (
  props: React.HTMLAttributes<any> & {
    onResize: (e: React.SyntheticEvent<Element>, data: ResizeCallbackData) => void;
    width: number;
  },
) => {
  const { onResize, width, ...restProps } = props;

  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

type TableItem<D> = D & {
  index: number;
};

export function useTableData<D>(
  queryResult: QueryResult<PaginatedData<D>>,
): QueryResult<PaginatedData<TableDataItem<TableItem<D>>>> {
  return map(
    queryResult,
    (response): PaginatedData<TableDataItem<TableItem<D>>> => ({
      total: response.total,

      items: response.items.map(
        (item, index): TableDataItem<TableItem<D>> => ({
          index,
          ...item,
        }),
      ),
    }),
  );
}
