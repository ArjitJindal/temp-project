import React from 'react';
import * as TanTable from '@tanstack/react-table';
import { AllParams, TableColumn, TableData, TableRow, ToolRenderer } from '../../types';
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGINATION_ENABLED } from '../../consts';
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
  params: AllParams<Params>;
  extraTools?: ToolRenderer[];
  options?: ToolsOptions;
  onReload?: () => void;
  onPaginateData?: (params: PaginationParams) => Promise<TableData<Item>>;
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
          currentPage={params?.page ?? 1}
          onPaginateData={onPaginateData}
          columns={columns}
          pageSize={params?.pageSize ?? DEFAULT_PAGE_SIZE}
          pagination={params?.pagination ?? DEFAULT_PAGINATION_ENABLED}
        />
      )}
      {options?.reload !== false && onReload && <ReloadButton onClick={onReload} />}
      {options?.setting !== false && <SettingsButton table={table} />}
    </>
  );
}
