import React, { useMemo } from 'react';
import cn from 'clsx';
import * as TanTable from '@tanstack/react-table';
import {
  AllParams,
  ExtraFilter,
  SelectionAction,
  TableColumn,
  TableData,
  TableRow,
  ToolRenderer,
} from '../types';
import { useAutoFilters } from '../internal/filters';
import s from './index.module.less';
import Filters from './Filters';
import SelectionActions from './SelectionActions';
import Tools, { ToolsOptions } from './Tools';
import { PaginationParams } from '@/utils/queries/hooks';

interface Props<Item extends object, Params extends object> {
  table: TanTable.Table<TableRow<Item>>;
  columns: TableColumn<Item>[];
  selectionActions?: SelectionAction<Item, Params>[];
  extraFilters?: ExtraFilter<Params>[];
  extraTools?: ToolRenderer[];
  toolsOptions?: ToolsOptions | false;
  hideFilters?: boolean;
  params: AllParams<Params>;
  externalHeader: boolean;
  onChangeParams: (newParams: AllParams<Params>) => void;
  onReload?: () => void;
  onPaginateData?: (params: PaginationParams) => Promise<TableData<Item>>;
}

export default function Header<Item extends object, Params extends object>(
  props: Props<Item, Params>,
) {
  const {
    table,
    selectionActions,
    columns,
    params,
    onChangeParams,
    extraFilters = [],
    extraTools = [],
    hideFilters = false,
    toolsOptions = {},
    externalHeader,
    onReload,
    onPaginateData,
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
      className={cn(s.root, showFilters && s.filtersVisible, externalHeader && s.externalHeader)}
    >
      {showFilters ? (
        <Filters<Params> filters={allFilters} params={params} onChangeParams={onChangeParams} />
      ) : (
        <div />
      )}
      <div className={s.right}>
        <SelectionActions
          table={table}
          params={params}
          onChangeParams={(cb) => {
            onChangeParams(cb(params));
          }}
          actions={selectionActions ?? []}
        />
        {toolsOptions != false && (
          <Tools
            options={toolsOptions}
            extraTools={extraTools}
            columns={columns}
            table={table}
            params={params}
            onReload={onReload}
            onPaginateData={onPaginateData}
          />
        )}
      </div>
    </div>
  );
}
