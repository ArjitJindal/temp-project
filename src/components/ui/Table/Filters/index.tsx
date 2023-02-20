import React, { Dispatch, SetStateAction, useCallback, useState } from 'react';
import { Filter, isExtraFilter } from '../types';
import style from './index.module.less';
import FilterSelector from './FilterSelector';
import { AllParams } from '@/components/ui/Table';
import Button from '@/components/library/Button';
import { AutoFilter } from '@/components/ui/Table/Filters/AutoFilter';
import ExtraFilter from '@/components/ui/Table/Filters/ExtraFilter';

interface Props<Params extends object> {
  tableId?: string;
  filters: Filter<Params>[];
  params?: AllParams<Params>;
  onChangeParams: (newParams: AllParams<Params>) => void;
}

export default function Filters<Params extends object>(props: Props<Params>) {
  const { tableId, filters, params, onChangeParams } = props;

  const fulfilledFilters = filters
    .map((filter) => filter.key)
    .filter((key: string) => params?.[key] != null);
  const defaultActiveFilters: string[] = filters
    .filter((filter) => filter.showFilterByDefault)
    .map((filter: Filter<Params>) => filter.key);
  const [storedShownFilters, setStoredShownFilters] = useLocalStorageOptionally<string[]>(
    tableId ? `${tableId}-shown-filters` : null,
    defaultActiveFilters,
  );
  const shownFilters = [...storedShownFilters, ...fulfilledFilters];

  const handleResetParams = (keys: string[]) => {
    const newParams = {
      ...params,
    } as AllParams<Params>;
    for (const key of keys) {
      delete newParams[key];
    }
    onChangeParams(newParams);
  };

  const handleToggleFilter = (key: string, enabled: boolean) => {
    if (!enabled) {
      handleResetParams([key]);
      setStoredShownFilters((prevState) => prevState.filter((x) => x !== key));
    } else {
      setStoredShownFilters((prevState) => [...prevState, key]);
    }
  };

  const handleClickReset = () => {
    // Reset all parameters
    handleResetParams(fulfilledFilters);
  };

  const sortedFilters = [...filters];
  sortedFilters.sort((x, y) => shownFilters.indexOf(x.key) - shownFilters.indexOf(y.key));

  return (
    <div className={style.root}>
      <div className={style.items}>
        {params != null &&
          sortedFilters
            .filter(({ key }) => shownFilters.includes(key))
            .map((filter) =>
              isExtraFilter(filter) ? (
                <ExtraFilter
                  key={filter.key}
                  filter={filter}
                  params={params}
                  onChangeParams={onChangeParams}
                />
              ) : (
                <AutoFilter
                  key={filter.key}
                  filter={filter}
                  value={params?.[filter.key]}
                  onChange={(value: unknown) => {
                    onChangeParams({ ...params, [filter.key]: value });
                  }}
                />
              ),
            )}
        <FilterSelector
          filters={filters}
          defaultActiveFilters={defaultActiveFilters}
          shownFilters={shownFilters}
          onToggleFilter={handleToggleFilter}
        />
        {fulfilledFilters.length > 0 && (
          <Button type="TEXT" onClick={handleClickReset} size="SMALL">
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}

function useLocalStorageOptionally<Value>(
  key: string | null,
  defaultValue: Value,
): [Value, Dispatch<SetStateAction<Value>>] {
  const [state, setState] = useState(defaultValue);
  const setValue = useCallback(
    (action: SetStateAction<Value>) => {
      if (key != null) {
        let result: Value;
        if (typeof action === 'function') {
          const cb = action as (prevState: Value) => Value;
          const storedValue: string | null = window.localStorage.getItem(key);
          result = cb(storedValue != null ? (JSON.parse(storedValue) as Value) : defaultValue);
        } else {
          result = action;
        }
        window.localStorage.setItem(key, JSON.stringify(result));
        setState(result);
      }
    },
    [key, defaultValue],
  );
  if (key != null) {
    const result = window.localStorage.getItem(key);
    if (result == null) {
      window.localStorage.setItem(key, JSON.stringify(defaultValue));
      return [defaultValue, setValue];
    }
    return [JSON.parse(result) as Value, setValue];
  }
  return [state, setState];
}
