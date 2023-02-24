import React from 'react';
import SegmentedControl from '@/components/library/SegmentedControl';
import { AllParams } from '@/components/ui/Table';

type ScopeSelectorValue = 'MY' | 'ALL' | 'MY_ALERTS';

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
      active={
        params.showCases === 'MY' ? 'MY' : params.showCases === 'MY_ALERTS' ? 'MY_ALERTS' : 'ALL'
      }
      onChange={(newValue) => {
        onChangeParams((oldState) => ({ ...oldState, showCases: newValue }));
      }}
      items={[
        { value: 'ALL', label: 'All cases' },
        { value: 'MY_ALERTS', label: 'All alerts' },
        { value: 'MY', label: 'My cases' },
      ]}
    />
  );
}
