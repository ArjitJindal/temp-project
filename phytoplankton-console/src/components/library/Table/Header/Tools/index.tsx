import React from 'react';
import * as TanTable from '@tanstack/react-table';
import { TableColumn, TableData, TableRow, ToolRenderer, PaginatedParams } from '../../types';
import SettingsButton from './SettingsButton';
import DownloadButton from './DownloadButton';
import ReloadButton from './ReloadButton';
import { PaginationParams } from '@/utils/queries/hooks';

export interface ToolsOptions {
  reload?: boolean;
  setting?: boolean;
  download?: boolean;
}

interface Props<Item extends object, Params> {
  table: TanTable.Table<TableRow<Item>>;
  columns: TableColumn<Item>[];
  params: PaginatedParams<Params>;
  extraTools?: ToolRenderer[];
  options?: ToolsOptions;
  onReload?: () => void;
  onPaginateData?: (params: PaginationParams) => Promise<TableData<Item>>;
  cursorPagination?: boolean;
  totalPages?: number;
}

export default function Tools<Item extends object, Params>(props: Props<Item, Params>) {
  const { table, columns, extraTools = [], params, onReload, onPaginateData, options } = props;
  return (
    <>
      {extraTools.map((tool, i) => (
        <React.Fragment key={i}>{tool()}</React.Fragment>
      ))}
      {options?.download !== false && onPaginateData && (
        <DownloadButton
          params={params}
          onPaginateData={onPaginateData}
          columns={columns}
          cursorPagination={props.cursorPagination}
          totalPages={props.totalPages}
        />
      )}
      {options?.reload !== false && onReload && <ReloadButton onClick={onReload} />}
      {options?.setting !== false && <SettingsButton table={table} />}
    </>
  );
}
