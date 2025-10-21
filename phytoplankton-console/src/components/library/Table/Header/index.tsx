import React, { useMemo } from 'react';
import cn from 'clsx';
import * as TanTable from '@tanstack/react-table';
import {
  TableColumn,
  TableData,
  TableRow,
  ToolRenderer,
  PaginatedParams,
  CommonParams,
} from '../types';
import { useAutoFilters } from '../internal/filters';
import s from './index.module.less';
import Filters from './Filters';
import Tools, { ToolsOptions } from './Tools';
import { PaginationParams } from '@/utils/queries/hooks';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import { pickPaginatedParams } from '@/components/library/Table/paramsHelpers';

interface Props<Item extends object, Params extends object = CommonParams> {
  table: TanTable.Table<TableRow<Item>>;
  columns: TableColumn<Item>[];
  extraFilters?: ExtraFilterProps<Params>[];
  extraTools?: ToolRenderer[];
  extraHeaderInfo?: React.ReactNode;
  toolsOptions?: ToolsOptions | false;
  hideFilters?: boolean;
  params: PaginatedParams<Params>;
  externalHeader: boolean;
  onChangeParams: (newParams: PaginatedParams<Params>) => void;
  onReload?: () => void;
  onPaginateData?: (params: PaginationParams) => Promise<TableData<Item>>;
  pageCount?: number;
  cursorPagination?: boolean;
  totalPages?: number;
  leftTools?: React.ReactNode;
  readOnlyFilters?: boolean;
  topTools?: React.ReactNode;
}

export default function Header<Item extends object, Params extends object = CommonParams>({
  table,
  columns,
  params,
  onChangeParams,
  extraFilters = [],
  extraTools = [],
  hideFilters = false,
  toolsOptions = {},
  externalHeader,
  extraHeaderInfo,
  onReload,
  onPaginateData,
  cursorPagination,
  totalPages,
  leftTools,
  readOnlyFilters = false,
  topTools,
}: Props<Item, Params>) {
  const autoFilters = useAutoFilters(columns);
  const allFilters = useMemo(() => [...autoFilters, ...extraFilters], [autoFilters, extraFilters]);

  const hasFilters = allFilters.length > 0 && !hideFilters;
  const hasTools =
    toolsOptions !== false &&
    (toolsOptions.reload !== false ||
      toolsOptions.setting !== false ||
      toolsOptions.download !== false ||
      extraTools.length > 0);

  if (!hasFilters && !hasTools && !extraHeaderInfo) {
    return null;
  }

  return (
    <div
      className={cn(
        s.container,
        externalHeader && s.externalHeader,
        hasFilters && s.filtersVisible,
      )}
    >
      {topTools && <div>{topTools}</div>}
      {(hasFilters || hasTools || leftTools) && (
        <div className={s.root}>
          {hasFilters ? (
            <Filters<Params>
              readOnly={readOnlyFilters}
              filters={allFilters}
              params={params}
              onChangeParams={(newParams) =>
                onChangeParams({
                  ...pickPaginatedParams(params),
                  ...newParams,
                })
              }
            />
          ) : (
            (leftTools || hasTools) && (
              <div className={cn(s.left, !leftTools && s.empty)}>{leftTools}</div>
            )
          )}

          {hasTools && (
            <div className={s.right}>
              <Tools
                options={toolsOptions}
                extraTools={extraTools}
                columns={columns}
                table={table}
                params={params}
                onReload={onReload}
                onPaginateData={onPaginateData}
                cursorPagination={cursorPagination}
                totalPages={totalPages}
              />
            </div>
          )}
        </div>
      )}

      {extraHeaderInfo && <div>{extraHeaderInfo}</div>}
    </div>
  );
}
