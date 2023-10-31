import React from 'react';
import PopupContent from './PopupContent';
import PriceTagIcon from '@/components/ui/icons/Remix/finance/price-tag-line.react.svg';
import { Value } from '@/pages/transactions/components/TagSearchButton/types';
import QuickFilter from '@/components/library/QuickFilter';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function TagSearchButton(props: Props) {
  const { initialState, onConfirm, onUpdateFilterClose } = props;

  const isEmpty = initialState.key == null && initialState.value == null;
  return (
    <QuickFilter
      icon={<PriceTagIcon />}
      analyticsName="tag-filter"
      title="Tag"
      buttonText={isEmpty ? undefined : `${initialState.key ?? '*'}:${initialState.value ?? '*'}`}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onConfirm({
                key: null,
                value: null,
              });
            }
      }
      onUpdateFilterClose={onUpdateFilterClose}
    >
      {({ setOpen }) => (
        <PopupContent
          initialState={initialState}
          onConfirm={(value) => {
            onConfirm(value);
            setOpen(false);
          }}
          onCancel={() => {
            setOpen(false);
          }}
        />
      )}
    </QuickFilter>
  );
}
