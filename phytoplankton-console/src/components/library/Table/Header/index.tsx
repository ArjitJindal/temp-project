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
}

export default function Header<Item extends object, Params extends object = CommonParams>(
  props: Props<Item, Params>,
) {
  const {
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
  } = props;

  const autoFilters = useAutoFilters(props.columns);
  const allFilters = useMemo(() => [...autoFilters, ...extraFilters], [autoFilters, extraFilters]);

  const showFilters = allFilters.length > 0 && !hideFilters;
  let showTools = true;
  if (toolsOptions === false) {
    showTools = false;
  } else if (
    toolsOptions.reload === false &&
    toolsOptions.setting === false &&
    toolsOptions.download === false &&
    extraTools.length === 0
  ) {
    showTools = false;
  }

  const showHeader = showFilters || showTools;

  if (!showHeader) {
    return <></>;
  }

  return (
    <div
      className={cn(
        s.container,
        externalHeader && s.externalHeader,
        showFilters && s.filtersVisible,
      )}
    >
      <div className={cn(s.root)}>
        {showFilters ? (
          <Filters<Params>
            readOnly={readOnlyFilters}
            filters={allFilters}
            params={params}
            onChangeParams={(newParams) => {
              onChangeParams({
                ...pickPaginatedParams(params),
                ...newParams,
              });
            }}
          />
        ) : (
          <>{leftTools ? <div className={s.left}>{leftTools}</div> : <div />}</>
        )}
        <div className={s.right}>
          {toolsOptions != false && (
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
          )}
        </div>
      </div>
      {extraHeaderInfo ? <div>{extraHeaderInfo}</div> : <></>}
    </div>
  );
}
