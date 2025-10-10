import React from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import PopupContent from './PopupContent';
import BankCardFillIcon from '@/components/ui/icons/Remix/business/bank-card-fill.react.svg';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';

interface Props {
  direction: 'ORIGIN' | 'DESTINATION';
  methods: string[];
  onConfirm: (state: string[]) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function PaymentMethodButton(props: Props) {
  const { methods, onConfirm, direction, onUpdateFilterClose } = props;

  const isEmpty = methods.length === 0;

  return (
    <QuickFilterBase
      icon={<BankCardFillIcon />}
      analyticsName={`${direction.toLowerCase()}-payment-method-filter`}
      title={`${humanizeConstant(direction)} payment method`}
      buttonText={isEmpty ? undefined : methods.join(', ')}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onConfirm([]);
            }
      }
      onUpdateFilterClose={onUpdateFilterClose}
    >
      <PopupContent value={methods} onConfirm={onConfirm} />
    </QuickFilterBase>
  );
}
