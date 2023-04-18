import React from 'react';
import { AllParams, ExtraFilter } from '../../../types';
import { AutoFilter } from '@/components/library/Table/Header/Filters/AutoFilter';

interface Props<Params> {
  filter: ExtraFilter<Params>;
  params: AllParams<Params>;
  onChangeParams: (newParams: AllParams<Params>) => void;
}

export default function ExtraFilter<Params>(props: Props<Params>) {
  const { filter, params, onChangeParams } = props;
  const renderer = filter.renderer ?? { kind: 'string' };

  if (typeof renderer === 'function') {
    return (
      <React.Fragment>
        {renderer({
          params: params,
          setParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) =>
            onChangeParams?.(cb(params)),
        })}
      </React.Fragment>
    );
  }

  return (
    <AutoFilter
      filter={{ ...filter, kind: 'AUTO', dataType: renderer }}
      value={params?.[filter.key]}
      onChange={(value: unknown) => {
        onChangeParams({ ...params, [filter.key]: value });
      }}
    />
  );
}
