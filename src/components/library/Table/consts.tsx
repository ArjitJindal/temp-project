import * as TanTable from '@tanstack/react-table';
import React from 'react';
import { CommonParams, SortingParams, TableRow } from './types';
import Checkbox from '@/components/library/Checkbox';
import ExpandIcon from '@/components/library/Table/ExpandIcon';
import { PaginationParams } from '@/utils/queries/hooks';

export const DEFAULT_PAGE_SIZE = 20;

export const DEFAULT_SORT_STATE: SortingParams = {
  sort: [],
};

export const DEFAULT_PAGINATION_STATE: PaginationParams = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export const DEFAULT_PARAMS_STATE: CommonParams = {
  ...DEFAULT_SORT_STATE,
  ...DEFAULT_PAGINATION_STATE,
};

export const SELECT_COLUMN_ID = 'SELECT_COLUMN_ID';
export const EXPAND_COLUMN_ID = 'EXPAND_COLUMN_ID';
export const SPACER_COLUMN_ID = 'SPACER_COLUMN_ID';
export const SPECIAL_COLUMN_IDS = [EXPAND_COLUMN_ID, SELECT_COLUMN_ID, SPACER_COLUMN_ID];

export const DEFAULT_COLUMN_WRAP_MODE = 'OVERFLOW';

export const SELECT_COLUMN: TanTable.ColumnDef<unknown> = {
  id: SELECT_COLUMN_ID,
  size: 30,
  enableResizing: false,
  header: ({ table }) => (
    <Checkbox
      value={table.getIsSomePageRowsSelected() ? undefined : table.getIsAllPageRowsSelected()}
      onChange={(newValue) => {
        table.toggleAllPageRowsSelected(newValue);
      }}
      testName="header-table"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      value={row.getIsSelected()}
      isDisabled={!row.getCanSelect()}
      onChange={(newValue) => {
        row.toggleSelected(newValue);
      }}
      testName="row-table"
    />
  ),
};

export const EXPAND_COLUMN: TanTable.ColumnDef<TableRow<unknown>> = {
  id: EXPAND_COLUMN_ID,
  size: 30,
  enableResizing: false,
  cell: ({ cell }) => {
    const item: TableRow<unknown> = cell.row.original;
    if (!item.isLastRow) {
      return <></>;
    }
    const showExpandIcon = cell.row.getCanExpand();
    if (!showExpandIcon) {
      return <></>;
    }
    return (
      <ExpandIcon isExpanded={cell.row.getIsExpanded()} onClick={() => cell.row.toggleExpanded()} />
    );
  },
};

export const SPACER_COLUMN: TanTable.ColumnDef<unknown> = {
  id: SPACER_COLUMN_ID,
  size: 0,
  enableResizing: false,
};
