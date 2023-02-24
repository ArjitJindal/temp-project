import React from 'react';
import SegmentedControl from '@/components/library/SegmentedControl';
import { AllParams } from '@/components/ui/Table';

type ScopeSelectorValue = 'MY' | 'ALL' | 'ALL_ALERTS' | 'MY_ALERTS';

interface Props<Params> {
  params: Params;
  onChangeParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) => void;
}

export default function ScopeSelector<
  Params extends {
    showCases?: ScopeSelectorValue;
  },
>(props: Props<Params>) {
  const { params, onChangeParams } = props;
  return (
    <SegmentedControl<ScopeSelectorValue>
      size="LARGE"
      active={params.showCases as ScopeSelectorValue}
      onChange={(newValue) => {
        onChangeParams((oldState) => ({ ...oldState, showCases: newValue }));
      }}
      items={[
        { value: 'ALL', label: 'All cases' },
        { value: 'MY', label: 'My cases' },
        { value: 'ALL_ALERTS', label: 'All alerts' },
        { value: 'MY_ALERTS', label: 'My alerts' },
      ]}
    />
  );
}
