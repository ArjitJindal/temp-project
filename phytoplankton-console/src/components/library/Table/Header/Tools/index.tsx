import React from 'react';
import * as TanTable from '@tanstack/react-table';
import { TableColumn, TableData, TableRow, ToolRenderer, PaginatedParams } from '../../types';
import { DEFAULT_DOWNLOAD_VIEW } from '../../consts';
import SettingsButton from './SettingsButton';
import DownloadButton from './DownloadButton';
import AdvancedDownloadButton from './AdvancedDownloadButton';
import ReloadButton from './ReloadButton';
import type { PaginationParams } from '@/utils/queries/hooks';

export type ExportConfig = {
  pageSize: number;
  page: number;
  exportSinglePage: boolean;
};
export interface ToolsOptions {
  reload?: boolean;
  setting?: boolean;
  download?: boolean;
  supportedDownloadFormats?: ('csv' | 'xlsx' | 'pdf')[];
  advancedDownload?: boolean;
  downloadCallback?: (format: 'csv' | 'pdf', exportConfig?: ExportConfig) => void;
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
      {options?.download !== false &&
        onPaginateData &&
        (options?.advancedDownload === true ? (
          <AdvancedDownloadButton
            params={{ ...params, view: DEFAULT_DOWNLOAD_VIEW }}
            onPaginateData={onPaginateData}
            columns={columns}
            cursorPagination={props.cursorPagination}
            totalPages={props.totalPages}
          />
        ) : (
          <DownloadButton
            params={{ ...params, view: DEFAULT_DOWNLOAD_VIEW }}
            onPaginateData={onPaginateData}
            columns={columns}
            cursorPagination={props.cursorPagination}
            totalPages={props.totalPages}
            supportedDownloadFormats={options?.supportedDownloadFormats ?? ['csv', 'xlsx']}
            downloadCallback={options?.downloadCallback}
          />
        ))}
      {options?.reload !== false && onReload && <ReloadButton onClick={onReload} />}
      {options?.setting !== false && <SettingsButton table={table} />}
    </>
  );
}
