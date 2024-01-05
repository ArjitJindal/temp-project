import React from 'react';
import { AutoFilter } from '@/components/library/Filter/AutoFilter';
import { ExtraFilterProps } from '@/components/library/Filter/types';

interface Props<Params> {
  filter: ExtraFilterProps<Params>;
  params: Params;
  onChangeParams: (newParams: Params) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function ExtraFilter<Params>(props: Props<Params>) {
  const { filter, params, onChangeParams, onUpdateFilterClose } = props;
  const renderer = filter.renderer ?? { kind: 'string' };

  if (typeof renderer === 'function') {
    return (
      <React.Fragment>
        {renderer({
          params: params,
          setParams: (cb: (oldState: Params) => Params) => {
            onChangeParams?.(cb(params));
          },
          onUpdateFilterClose: onUpdateFilterClose,
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
