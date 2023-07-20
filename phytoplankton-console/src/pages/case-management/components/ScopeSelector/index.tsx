import React from 'react';
import SegmentedControl, { Item } from '@/components/library/SegmentedControl';
import { AllParams } from '@/components/library/Table/types';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

export type ScopeSelectorValue = 'MY' | 'ALL' | 'ALL_ALERTS' | 'MY_ALERTS' | 'PAYMENT_APPROVALS';

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
  const settings = useSettings();

  const items: Item<ScopeSelectorValue>[] = [
    { value: 'ALL', label: 'All cases' },
    { value: 'MY', label: 'My cases' },
    { value: 'ALL_ALERTS', label: 'All alerts' },
    { value: 'MY_ALERTS', label: 'My alerts' },
  ];

  if (settings.isPaymentApprovalEnabled) {
    items.push({ value: 'PAYMENT_APPROVALS', label: 'Payment approval' });
  }

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
