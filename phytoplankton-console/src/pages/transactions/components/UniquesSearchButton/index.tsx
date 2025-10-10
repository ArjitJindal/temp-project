import React from 'react';
import { Value } from './types';
import PopupContent from './PopupContent';
import QuickFilter from '@/components/library/QuickFilter';
import { TransactionsUniquesField } from '@/apis';

interface Props {
  initialState: Value;
  onConfirm: (newState: Value) => void;
  onUpdateFilterClose?: (status: boolean) => void;
  uniqueType: TransactionsUniquesField;
  title: string;
  defaults?: string[];
}

export default function UniquesSearchButton(props: Props) {
  const { initialState, onConfirm, onUpdateFilterClose, uniqueType, title, defaults } = props;

  const isEmpty = initialState.uniques == null;
  return (
    <QuickFilter
      analyticsName={`${uniqueType.toLowerCase()}-type-filter`}
      title={title}
      buttonText={isEmpty ? undefined : initialState.uniques?.join(', ')}
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
          uniqueType={uniqueType}
          onConfirm={(value) => {
            onConfirm(value);
            setOpen(false);
          }}
          defaults={defaults}
          onCancel={() => {
            setOpen(false);
          }}
        />
      )}
    </QuickFilter>
  );
}
