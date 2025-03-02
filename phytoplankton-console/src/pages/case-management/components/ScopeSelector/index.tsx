import React from 'react';
import SegmentedControl, { Item } from '@/components/library/SegmentedControl';
import { AllParams } from '@/components/library/Table/types';

export type CasesScope = 'MY' | 'ALL';
export type AlertScope = 'ALL_ALERTS' | 'MY_ALERTS';
export type QaAlertScope = 'QA_UNCHECKED_ALERTS' | 'QA_PASSED_ALERTS' | 'QA_FAILED_ALERTS';
export type QaScope = QaAlertScope;

export type ScopeSelectorValue = CasesScope | AlertScope | QaScope | 'PAYMENT_APPROVALS';

export function isAlertScope(scope: ScopeSelectorValue | undefined): scope is AlertScope {
  if (scope == null) {
    return false;
  }
  return ['ALL_ALERTS', 'MY_ALERTS'].includes(scope);
}

export function isCasesScope(scope: ScopeSelectorValue | undefined): scope is CasesScope {
  if (scope == null) {
    return false;
  }
  return ['MY', 'ALL'].includes(scope);
}

export function isQaAlertScope(scope: ScopeSelectorValue | undefined): scope is QaAlertScope {
  if (scope == null) {
    return false;
  }
  return ['QA_UNCHECKED_ALERTS', 'QA_PASSED_ALERTS', 'QA_FAILED_ALERTS'].includes(scope);
}

export function isQaScope(scope: ScopeSelectorValue | undefined): scope is QaScope {
  return isQaAlertScope(scope);
}

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
