import React from 'react';
import { AutoFilter } from '@/components/library/Filter/AutoFilter';
import { ExtraFilterProps } from '@/components/library/Filter/types';

interface Props<Params> {
  filter: ExtraFilterProps<Params>;
  params: Params;
  readOnly?: boolean;
  onChangeParams: (newParams: Params) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function ExtraFilter<Params>(props: Props<Params>) {
  const { filter, params, readOnly, onChangeParams, onUpdateFilterClose } = props;
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
          readOnly,
        })}
      </React.Fragment>
    );
  }

  const isReadOnly = (renderer as any).readOnly ?? readOnly;

  return (
    <AutoFilter
      readOnly={isReadOnly}
      filter={{ ...filter, kind: 'AUTO', dataType: { ...renderer, readOnly: isReadOnly } }}
      value={params?.[filter.key]}
      onChange={(value: unknown) => {
        let normalized: unknown = value;

        if (Array.isArray(value) && value.length === 0) {
          normalized = undefined;
        }

        onChangeParams({ ...params, [filter.key]: normalized });
      }}
    />
  );
}
