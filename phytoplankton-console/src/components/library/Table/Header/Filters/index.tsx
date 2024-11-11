import React, { useEffect, useMemo, useState } from 'react';
import { uniq } from 'lodash';
import { AllParams } from '../../types';
import style from './index.module.less';
import FilterSelector from './FilterSelector';
import Button from '@/components/library/Button';
import { usePersistedSettingsContext } from '@/components/library/Table/internal/settings';
import Filter from '@/components/library/Filter';
import { FilterProps } from '@/components/library/Filter/types';
import { useElementSize } from '@/utils/browser';

interface Props<Params extends object> {
  filters: FilterProps<Params>[];
  readOnly?: boolean;
  params: Params;
  onChangeParams: (newParams: Params) => void;
}

export default function Filters<Params extends object>(props: Props<Params>) {
  const { filters, params, onChangeParams, readOnly } = props;
  const [filterClose, setFilterClose] = useState<boolean>(true);
  const [fulfilledFilters, setFulfilledFilters] = useState(['']);

  const persistedSettingsContext = usePersistedSettingsContext();
  const [filtersVisible, setFiltersVisible] = persistedSettingsContext.filtersVisibility;

  const filtersOrder = useMemo(() => {
    const pinnedFilters = filters
      .filter((filter) => filter.pinFilterToLeft)
      .map((filter) => filter.key);

    const pinnedFulfilled = fulfilledFilters.filter((x) => pinnedFilters.includes(x));
    const unpinnedFulfilled = fulfilledFilters.filter((x) => !pinnedFilters.includes(x));
    const emptyPinned = filtersVisible.filter(
      (x) => !fulfilledFilters.includes(x) && pinnedFilters.includes(x),
    );
    const unpinnedEmpty = filtersVisible.filter(
      (x) => !fulfilledFilters.includes(x) && !pinnedFilters.includes(x),
    );

    return uniq([...pinnedFulfilled, ...unpinnedFulfilled, ...emptyPinned, ...unpinnedEmpty]);
  }, [fulfilledFilters, filtersVisible, filters]);

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
  sortedFilters.sort((x, y) => filtersOrder.indexOf(x.key) - filtersOrder.indexOf(y.key));

  useEffect(() => {
    if (filterClose) {
      const temporary = filters
        .map((filter) => filter.key)
        .filter((key: string) => params?.[key] != null);
      setFulfilledFilters([...temporary]);
    }
  }, [filterClose, filters, params]);

  const [itemsEl, setItemsEl] = useState<HTMLDivElement | null>(null);
  const size = useElementSize(itemsEl);

  if (sortedFilters.length === 0) {
    return <></>;
  }

  return (
    <div className={style.root}>
      <div className={style.content} style={{ width: size?.width }}>
        <div className={style.gradientMaskWrapper}>
          <div className={style.items} ref={setItemsEl}>
            {sortedFilters
              .filter(({ key }) => filtersOrder.includes(key))
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
                shownFilters={filtersOrder}
                onToggleFilter={handleToggleFilter}
                onUpdateFilterClose={onUpdateFilterClose}
              />
            )}
          </div>
        </div>
        {fulfilledFilters.length > 0 && !readOnly && (
          <div className={style.resetButton}>
            <Button type="TEXT" onClick={handleClickReset} size="SMALL">
              Reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
