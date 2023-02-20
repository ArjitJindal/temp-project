import React from 'react';
import { AllParams } from '@/components/ui/Table';
import { ExtraFilter } from '@/components/ui/Table/types';

interface Props<Params> {
  filter: ExtraFilter<Params>;
  params: AllParams<Params>;
  onChangeParams: (newParams: AllParams<Params>) => void;
}

export default function ExtraFilter<Params>(props: Props<Params>) {
  const { filter, params, onChangeParams } = props;
  return (
    <React.Fragment>
      {filter.renderer({
        params,
        setParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) =>
          onChangeParams(cb(params)),
      })}
    </React.Fragment>
  );
}
