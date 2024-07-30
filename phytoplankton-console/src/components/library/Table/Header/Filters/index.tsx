import React, { useEffect, useState } from 'react';
import { uniq } from 'lodash';
import { AllParams } from '../../types';
import style from './index.module.less';
import FilterSelector from './FilterSelector';
import Button from '@/components/library/Button';
import { usePersistedSettingsContext } from '@/components/library/Table/internal/settings';
import Filter from '@/components/library/Filter';
import { FilterProps } from '@/components/library/Filter/types';

interface Props<Params extends object> {
  filters: FilterProps<Params>[];
  readOnly?: boolean;
  params: Params;
  onChangeParams: (newParams: Params) => void;
}

export default function Filters<Params extends object>(props: Props<Params>) {
  const { filters, params, onChangeParams, readOnly } = props;
  const [filterClose, setFilterClose] = useState<boolean>(true);
  const [fulfilledFilters, setfulfilledFilters] = useState(['']);
  const pinnedFilters = filters
    .filter((filter) => filter.pinFilterToLeft)
    .map((filter) => filter.key);
  const persistedSettingsContext = usePersistedSettingsContext();
  const [filtersVisible, setFiltersVisible] = persistedSettingsContext.filtersVisibility;

  const shownFilters = readOnly
    ? uniq([...fulfilledFilters, ...filters.map(({ key }) => key)])
    : uniq([...pinnedFilters, ...fulfilledFilters, ...filtersVisible]);

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

  function onUpdateFilterClose(close: boolean) {
    setFilterClose(close);
  }
  const handleClickReset = () => {
    // Reset all parameters
    handleResetParams(fulfilledFilters);
  };

  const sortedFilters = [...filters];
  sortedFilters.sort((x, y) => shownFilters.indexOf(x.key) - shownFilters.indexOf(y.key));

  useEffect(() => {
    if (filterClose) {
      const temporary = filters
        .map((filter) => filter.key)
        .filter((key: string) => params?.[key] != null);
      setfulfilledFilters([...temporary]);
    }
  }, [filterClose, filters, params]);

  if (sortedFilters.length === 0) {
    return <></>;
  }

  return (
    <div className={style.root}>
      <div className={style.items}>
        {sortedFilters
          .filter(({ key }) => shownFilters.includes(key))
          .map((filter) => (
            <Filter
              key={filter.key}
              filter={filter}
              params={params}
              readOnly={readOnly}
              onChangeParams={onChangeParams}
              onUpdateFilterClose={onUpdateFilterClose}
            />
          ))}
        {!readOnly && (
          <FilterSelector
            filters={filters}
            defaultActiveFilters={persistedSettingsContext.defaultState.filtersVisibility}
            shownFilters={shownFilters}
            onToggleFilter={handleToggleFilter}
            onUpdateFilterClose={onUpdateFilterClose}
          />
        )}
        {fulfilledFilters.length > 0 && !readOnly && (
          <Button type="TEXT" onClick={handleClickReset} size="SMALL">
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
