import React from 'react';
import PopupContent from './PopupContent';
import HealthLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import { TransactionState } from '@/apis';
import {
  getTransactionStateLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';

interface Props {
  transactionStates: TransactionState[];
  onConfirm: (state: TransactionState[]) => void;
}

export function TransactionStateButton(props: Props) {
  const settings = useSettings();
  const { transactionStates, onConfirm } = props;

  const isEmpty = transactionStates.length === 0;

  const buttonText = isEmpty
    ? undefined
    : transactionStates
        .map((transactionState) => getTransactionStateLabel(transactionState, settings))
        .join(', ');

  return (
    <QuickFilterBase
      icon={<HealthLineIcon />}
      analyticsName="state-filter"
      title="Transaction state"
      buttonText={buttonText}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onConfirm([]);
            }
      }
    >
      <PopupContent value={transactionStates} onConfirm={onConfirm} />
    </QuickFilterBase>
  );
}
