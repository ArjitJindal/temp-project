import * as TanTable from '@tanstack/react-table';
import React, { useMemo } from 'react';
import { CommonParams, SelectionInfo, SortingParams, TableRow } from './types';
import s from './index.module.less';
import Checkbox from '@/components/library/Checkbox';
import ExpandIcon from '@/components/library/ExpandIcon';
import { PaginationParams } from '@/utils/queries/hooks';
import { AdditionalContext } from '@/components/library/Table/internal/partialySelectedRows';
import { TableListViewEnum } from '@/apis';

export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_EXPORT_PAGE_SIZE = 100; // to do fewer requests
export const DEFAULT_PAGINATION_ENABLED = true;
export const DEFAULT_PAGINATION_VIEW: TableListViewEnum = 'TABLE';
export const DEFAULT_DOWNLOAD_VIEW: TableListViewEnum = 'DOWNLOAD';

export const DEFAULT_SORT_STATE: SortingParams = {
  sort: [],
};

export const DEFAULT_PAGINATION_STATE: PaginationParams = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  pagination: DEFAULT_PAGINATION_ENABLED,
  view: DEFAULT_PAGINATION_VIEW,
};

export const DEFAULT_PARAMS_STATE: CommonParams = {
  ...DEFAULT_SORT_STATE,
  ...DEFAULT_PAGINATION_STATE,
};

export const SELECT_COLUMN_ID = 'SELECT_COLUMN_ID';
export const EXPAND_COLUMN_ID = 'EXPAND_COLUMN_ID';
export const SPECIAL_COLUMN_IDS = [EXPAND_COLUMN_ID, SELECT_COLUMN_ID];

export const DEFAULT_COLUMN_WRAP_MODE = 'WRAP';

export const SELECT_COLUMN = <Item extends object>(): TanTable.ColumnDef<TableRow<Item>, any> => ({
  id: SELECT_COLUMN_ID,
  size: 30,
  enableResizing: false,
  header: ({ table }) => {
    return (
      <Checkbox
        value={table.getIsSomePageRowsSelected() ? false : table.getIsAllPageRowsSelected()}
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
  partiallySelectedIds,
}: {
  row: TanTable.Row<TableRow<Item>>;
  table: TanTable.Table<TableRow<Item>>;
  partiallySelectedIds?: string[];
  selectionInfo?: SelectionInfo;
}) => {
  const isDisabled = useMemo(() => {
    if (!row.getCanSelect()) {
      return true;
    }

    if (row.getIsSelected()) {
      return false;
    }

    return false;
  }, [row]);

  return (
    <Checkbox
      value={partiallySelectedIds?.includes(row.id) ? false : row.getIsSelected()}
      isDisabled={isDisabled}
      onChange={(newValue) => {
        row.toggleSelected(newValue);
      }}
      testName="row-table"
      className={s.selectCheckbox}
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
        className={s.expandIcon}
      />
    );
  },
});
