import React from 'react';
import { AllParams, Filter, isExtraFilter } from '../../types';
import style from './index.module.less';
import FilterSelector from './FilterSelector';
import { AutoFilter } from './AutoFilter';
import ExtraFilter from './ExtraFilter';
import Button from '@/components/library/Button';
import { usePersistedSettingsContext } from '@/components/library/Table/internal/settings';

interface Props<Params extends object> {
  filters: Filter<Params>[];
  params: AllParams<Params>;
  onChangeParams: (newParams: AllParams<Params>) => void;
}

export default function Filters<Params extends object>(props: Props<Params>) {
  const { filters, params, onChangeParams } = props;

  const fulfilledFilters = filters
    .map((filter) => filter.key)
    .filter((key: string) => params?.[key] != null);

  const persistedSettingsContext = usePersistedSettingsContext();
  const [filtersVisible, setFiltersVisible] = persistedSettingsContext.filtersVisibility;

  const shownFilters = [...filtersVisible, ...fulfilledFilters];

  const handleResetParams = (keys: string[]) => {
    const newParams = {
      ...params,
    } as AllParams<Params>;
    for (const key of keys) {
      delete newParams[key];
    }
    onChangeParams?.(newParams);
  };

  const handleToggleFilter = (key: string, enabled: boolean) => {
    if (!enabled) {
      handleResetParams([key]);
      setFiltersVisible((prevState) => prevState.filter((x) => x !== key));
    } else {
      setFiltersVisible((prevState) => [...prevState, key]);
    }
  };

  const handleClickReset = () => {
    // Reset all parameters
    handleResetParams(fulfilledFilters);
  };

  const sortedFilters = [...filters];
  sortedFilters.sort((x, y) => shownFilters.indexOf(x.key) - shownFilters.indexOf(y.key));

  if (sortedFilters.length === 0) {
    return <></>;
  }

  return (
    <div className={style.root}>
      <div className={style.items}>
        {sortedFilters
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
                  onChangeParams?.({ ...params, [filter.key]: value });
                }}
              />
            ),
          )}
        <FilterSelector
          filters={filters}
          defaultActiveFilters={persistedSettingsContext.defaultState.filtersVisibility}
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
