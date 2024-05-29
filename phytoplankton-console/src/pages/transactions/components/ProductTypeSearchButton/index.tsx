import React from 'react';
import { Value } from './types';
import PopupContent from './PopupContent';
import QuickFilter from '@/components/library/QuickFilter';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export default function ProductTypeSearchButton(props: Props) {
  const { initialState, onConfirm, onUpdateFilterClose } = props;

  const isEmpty = initialState.productTypes == null;
  return (
    <QuickFilter
      analyticsName="product-type-filter"
      title="Product Type"
      buttonText={isEmpty ? undefined : initialState.productTypes?.join(', ')}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onConfirm({});
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
