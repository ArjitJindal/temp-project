import React from 'react';
import { AutoFilter } from './AutoFilter';
import ExtraFilter from './ExtraFilter';
import { FilterProps, isExtraFilter } from './types';

interface Props<Params extends object> {
  filter: FilterProps<Params>;
  params: Params;
  onChangeParams: (newParams: Params) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function Filter<Params extends object>(props: Props<Params>) {
  const { filter, params, onChangeParams, onUpdateFilterClose } = props;

  return (
    <>
      {isExtraFilter(filter) ? (
        <ExtraFilter
          key={filter.key}
          filter={filter}
          params={params}
          onChangeParams={onChangeParams}
          onUpdateFilterClose={onUpdateFilterClose}
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
      )}
    </>
  );
}
