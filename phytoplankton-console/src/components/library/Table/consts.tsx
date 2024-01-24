import * as TanTable from '@tanstack/react-table';
import React, { useMemo } from 'react';
import { CommonParams, SelectionInfo, SortingParams, TableRow } from './types';
import Checkbox from '@/components/library/Checkbox';
import ExpandIcon from '@/components/library/ExpandIcon';
import { PaginationParams } from '@/utils/queries/hooks';
import { AdditionalContext } from '@/components/library/Table/internal/partialySelectedRows';
import { DEFAULT_BULK_ACTIONS_LIMIT } from '@/utils/table-utils';

export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_PAGINATION_ENABLED = true;

export const DEFAULT_SORT_STATE: SortingParams = {
  sort: [],
};

export const DEFAULT_PAGINATION_STATE: PaginationParams = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  pagination: DEFAULT_PAGINATION_ENABLED,
};

export const DEFAULT_PARAMS_STATE: CommonParams = {
  ...DEFAULT_SORT_STATE,
  ...DEFAULT_PAGINATION_STATE,
};

export const SELECT_COLUMN_ID = 'SELECT_COLUMN_ID';
export const EXPAND_COLUMN_ID = 'EXPAND_COLUMN_ID';
export const SPACER_COLUMN_ID = 'SPACER_COLUMN_ID';
export const SPECIAL_COLUMN_IDS = [EXPAND_COLUMN_ID, SELECT_COLUMN_ID, SPACER_COLUMN_ID];

export const DEFAULT_COLUMN_WRAP_MODE = 'WRAP';

export const SELECT_COLUMN = <Item extends object>(): TanTable.ColumnDef<TableRow<Item>, any> => ({
  id: SELECT_COLUMN_ID,
  size: 30,
  enableResizing: false,
  header: ({ table }) => {
    return (
      <Checkbox
        value={table.getIsSomePageRowsSelected() ? undefined : table.getIsAllPageRowsSelected()}
        onChange={(newValue) => {
          table.toggleAllPageRowsSelected(newValue);
        }}
        testName="header-table"
      />
    );
  },
  cell: ({ row, table }) => (
    <AdditionalContext.Consumer>
      {({ partiallySelectedIds, selectionInfo }) => (
        <ExpandCheckbox
          row={row}
          table={table}
          partiallySelectedIds={partiallySelectedIds}
          selectionInfo={selectionInfo}
        />
      )}
    </AdditionalContext.Consumer>
  ),
});

const ExpandCheckbox = <Item extends object>({
  row,
  table,
  partiallySelectedIds,
  selectionInfo,
}: {
  row: TanTable.Row<TableRow<Item>>;
  table: TanTable.Table<TableRow<Item>>;
  partiallySelectedIds?: string[];
  selectionInfo?: SelectionInfo;
}) => {
  const count = useMemo(() => {
    return selectionInfo?.entityCount ?? Object.keys(table.getState().rowSelection).length;
  }, [selectionInfo, table]);

  const isDisabled = useMemo(() => {
    if (!row.getCanSelect()) {
      return true;
    }

    if (row.getIsSelected()) {
      return false;
    }

    if (count >= DEFAULT_BULK_ACTIONS_LIMIT) {
      return true;
    }

    return false;
  }, [row, count]);

  return (
    <Checkbox
      value={partiallySelectedIds?.includes(row.id) ? undefined : row.getIsSelected()}
      isDisabled={isDisabled}
      onChange={(newValue) => {
        row.toggleSelected(newValue);
      }}
      testName="row-table"
    />
  );
};

export const EXPAND_COLUMN = <Item extends object>(): TanTable.ColumnDef<TableRow<Item>, any> => ({
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
      <ExpandIcon
        isExpanded={cell.row.getIsExpanded()}
        color="BLACK"
        size="SMALL"
        onClick={() => cell.row.toggleExpanded()}
      />
    );
  },
});

export const SPACER_COLUMN = <Item extends object>(): TanTable.ColumnDef<TableRow<Item>, any> => ({
  id: SPACER_COLUMN_ID,
  size: 0,
  enableResizing: false,
});
