import React from 'react';
import SegmentedControl, { Item } from '@/components/library/SegmentedControl';
import { AllParams } from '@/components/library/Table/types';

export type ScopeSelectorValue =
  | 'MY'
  | 'ALL'
  | 'ALL_ALERTS'
  | 'MY_ALERTS'
  | 'PAYMENT_APPROVALS'
  | 'QA_UNCHECKED_ALERTS'
  | 'QA_PASSED_ALERTS'
  | 'QA_FAILED_ALERTS';

interface Props<Params> {
  params: Params;
  onChangeParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) => void;
  values: Item<ScopeSelectorValue>[];
}

export default function ScopeSelector<
  Params extends {
    showCases?: ScopeSelectorValue;
  },
>(props: Props<Params>) {
  const { params, onChangeParams } = props;

  const items: Item<ScopeSelectorValue>[] = props.values;

  return (
    <SegmentedControl<ScopeSelectorValue>
      size="LARGE"
      active={params.showCases as ScopeSelectorValue}
      onChange={(newValue) => {
        onChangeParams((oldState) => ({ ...oldState, showCases: newValue }));
      }}
      items={items}
    />
  );
}
