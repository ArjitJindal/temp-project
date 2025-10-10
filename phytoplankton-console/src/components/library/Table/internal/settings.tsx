import React, { SetStateAction, useCallback, useContext, useMemo } from 'react';
import * as TanTable from '@tanstack/react-table';
import { Updater } from '@tanstack/react-table';
import { SELECT_COLUMN_ID } from '../consts';
import { useLocalStorageOptionally } from './helpers';
import { useAutoFilters } from './filters';
import { getColumnId, TableColumn, SortingParamsItem } from '@/components/library/Table/types';
import { applyUpdater, StatePair } from '@/utils/state';
import { FilterProps, ExtraFilterProps } from '@/components/library/Filter/types';

export type ColumnOrder = string[];
export type FiltersVisibility = string[];
export type OrderRestirction = string[];

export type PersistedSettingsContextValue = {
  reset: () => void;
  defaultState: PersistedState;
  sort: StatePair<SortingParamsItem[]>;
  columnOrder: StatePair<ColumnOrder>;
  filtersVisibility: StatePair<FiltersVisibility>;
  columnSizing: StatePair<TanTable.ColumnSizingState>;
  columnVisibility: StatePair<TanTable.VisibilityState>;
  columnPinning: StatePair<TanTable.ColumnPinningState>;
  columnOrderRestrictions: StatePair<OrderRestirction>;
};

export const PersistedSettingsContext = React.createContext<PersistedSettingsContextValue | null>(
  null,
);

export function PersistedSettingsProvider<Item extends object, Params>(props: {
  tableId: string | null;
  columns: TableColumn<Item>[];
  extraFilters?: ExtraFilterProps<Params>[];
  children: React.ReactNode;
}) {
  const { tableId, extraFilters = [], columns } = props;
  const autoFilters = useAutoFilters(columns);
  const allFilters = useMemo(() => [...extraFilters, ...autoFilters], [extraFilters, autoFilters]);

  const nonResizableColumns = columns
    .filter((column) => column.enableResizing === false && column.defaultWidth)
    .map((column) => getColumnId(column));

  const getDefaultValue = useCallback((): PersistedState => {
    return {
      sort: [],
      columnVisibility: columns.reduce(
        (acc, column) => ({
          ...acc,
          [getColumnId(column)]: column.defaultVisibility !== false,
        }),
        {},
      ),
      columnSizing: columns.reduce(
        (acc, column) =>
          column.defaultWidth != null
            ? { ...acc, [getColumnId(column)]: column.defaultWidth }
            : acc,
        {},
      ),
      columnPinning: {
        left: columns.filter((x) => x.defaultSticky === 'LEFT').map(getColumnId),
        right: columns.filter((x) => x.defaultSticky === 'RIGHT').map(getColumnId),
      },
      filtersVisibility: allFilters
        .filter((filter) => filter.showFilterByDefault !== false)
        .map((filter: FilterProps<Params>) => filter.key),
      columnOrder: columns
        .map((column) => getColumnId(column))
        .filter((id) => id !== SELECT_COLUMN_ID)
        .filter((x): x is string => x != null),
      columnOrderRestrictions: columns
        .filter((column) => column.disableColumnShuffling)
        .map((column) => getColumnId(column))
        .filter((x): x is string => x != null),
    };
  }, [columns, allFilters]);

  const [persistedState, setPersistedState] = usePersistedState(
    tableId ?? null,
    getDefaultValue,
    nonResizableColumns,
  );
  const providerValue: PersistedSettingsContextValue = useMemo<PersistedSettingsContextValue>(
    () => ({
      reset: () => {
        setPersistedState(getDefaultValue());
      },
      defaultState: getDefaultValue(),
      sort: [
        persistedState.sort,
        (updater: Updater<SortingParamsItem[]>) => {
          setPersistedState((prevState) => {
            return {
              ...prevState,
              sort: applyUpdater(prevState.sort, updater),
            };
          });
        },
      ],
      columnVisibility: [
        {
          ...getDefaultValue().columnVisibility, // if a column is added and it has a default visibility but local storage doesn't have it, it will be added
          ...persistedState.columnVisibility,
        },
        (updater: Updater<TanTable.VisibilityState>) => {
          setPersistedState((prevState) => {
            return {
              ...prevState,
              columnVisibility: applyUpdater(prevState.columnVisibility, updater),
            };
          });
        },
      ],
      columnOrder: [
        persistedState.columnOrder,
        (updater: Updater<ColumnOrder>) => {
          setPersistedState((prevState) => {
            return {
              ...prevState,
              columnOrder: applyUpdater(prevState.columnOrder, updater),
            };
          });
        },
      ],
      columnSizing: [
        persistedState.columnSizing,
        (updater: Updater<TanTable.ColumnSizingState>) => {
          setPersistedState((prevState) => {
            return {
              ...prevState,
              columnSizing: applyUpdater(prevState.columnSizing, updater),
            };
          });
        },
      ],
      columnPinning: [
        persistedState.columnPinning,
        (updater: Updater<TanTable.ColumnPinningState>) => {
          setPersistedState((prevState) => {
            return {
              ...prevState,
              columnPinning: applyUpdater(prevState.columnPinning, updater),
            };
          });
        },
      ],
      filtersVisibility: [
        persistedState.filtersVisibility,
        (updater: Updater<FiltersVisibility>) => {
          setPersistedState((prevState) => {
            return {
              ...prevState,
              filtersVisibility: applyUpdater(prevState.filtersVisibility, updater),
            };
          });
        },
      ],
      columnOrderRestrictions: [
        persistedState.columnOrderRestrictions,
        (updater: Updater<OrderRestirction>) => {
          setPersistedState((prevState) => {
            return {
              ...prevState,
              columnOrderRestrictions: applyUpdater(prevState.columnOrderRestrictions, updater),
            };
          });
        },
      ],
    }),
    [getDefaultValue, persistedState, setPersistedState],
  );

  return (
    <PersistedSettingsContext.Provider value={providerValue}>
      {props.children}
    </PersistedSettingsContext.Provider>
  );
}

export function usePersistedSettingsContext(): PersistedSettingsContextValue {
  const context = useContext(PersistedSettingsContext);
  if (context == null) {
    throw new Error(`PersistedSettingsContext is not initialized properly`);
  }
  return context;
}

export interface PersistedState {
  columnOrder: ColumnOrder;
  sort: SortingParamsItem[];
  filtersVisibility: FiltersVisibility;
  columnSizing: TanTable.ColumnSizingState;
  columnVisibility: TanTable.VisibilityState;
  columnPinning: TanTable.ColumnPinningState;
  columnOrderRestrictions: OrderRestirction;
}

export function usePersistedState(
  tableId: string | null,
  defaultValue: () => PersistedState,
  nonResizableColumns: string[],
): StatePair<PersistedState> {
  // todo: add versioning and validation of settings
  const [state, setState] = useLocalStorageOptionally<PersistedState>(
    tableId ? `table-${tableId}-settings` : null,
    defaultValue,
    nonResizableColumns,
  );

  return [
    state,
    (updater: SetStateAction<PersistedState>) => {
      setState((previousState: PersistedState | undefined) =>
        applyUpdater(previousState ?? defaultValue(), updater),
      );
    },
  ];
}
