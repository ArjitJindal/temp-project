import React, { useEffect, useMemo, useState } from 'react';
import * as TanTable from '@tanstack/react-table';
import { AllParams, SelectionAction, TableRow } from '@/components/library/Table/types';
import { usePrevious } from '@/utils/hooks';
import { isEqual } from '@/utils/lang';
import { DEFAULT_BULK_ACTIONS_LIMIT } from '@/utils/table-utils';

interface Props<Item, Params> {
  table: TanTable.Table<TableRow<Item>>;
  params: Params;
  onChangeParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) => void;
  actions: SelectionAction<Item, Params>[];
}

export default function SelectionActions<Item, Params>(props: Props<Item, Params>) {
  const { table, params, onChangeParams, actions } = props;

  const [selectedItems, setSelectedItems] = useState<Record<string, Item>>({});
  const rowSelectionObject = table.getState().rowSelection;
  const idsSelected = useMemo(() => {
    return Object.entries(rowSelectionObject)
      .filter(([_, selected]) => selected)
      .map(([id]) => id);
  }, [rowSelectionObject]);
  const prevIdsSelected = usePrevious(idsSelected);
  useEffect(() => {
    if (!isEqual(idsSelected, prevIdsSelected)) {
      setSelectedItems((oldItems): Record<string, Item> => {
        const rows = table.getRowModel().rows;

        const result: Record<string, Item> = {};
        for (const id of idsSelected) {
          const dataItem = rows.find((x) => x.id === id);
          if (dataItem != null) {
            result[id] = dataItem.original.content;
          } else if (oldItems[id] != null) {
            result[id] = oldItems[id];
          }
        }
        return result;
      });
    }
  }, [table, idsSelected, prevIdsSelected]);

  const selectedIds = Object.keys(table.getState().rowSelection);

  const isDisabled = useMemo(() => {
    return selectedIds.length > DEFAULT_BULK_ACTIONS_LIMIT;
  }, [selectedIds]);

  if (selectedIds.length === 0) {
    return <></>;
  }

  return (
    <>
      {actions.map((action, i) => {
        return (
          <React.Fragment key={i}>
            {action({
              params,
              selectedIds,
              selectedItems,
              isDisabled,
              setParams: onChangeParams,
              onResetSelection: () => {
                table.resetRowSelection();
              },
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}
