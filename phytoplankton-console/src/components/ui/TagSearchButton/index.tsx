import React from 'react';
import PopupContent from './PopupContent';
import { Value } from './types';
import PriceTagIcon from '@/components/ui/icons/Remix/finance/price-tag-line.react.svg';
import QuickFilter from '@/components/library/QuickFilter';
import { QueryResult } from '@/utils/queries/types';

export { Value };

interface Props {
  keyQueryResult: QueryResult<string[]>;
  valueQueryResult: QueryResult<string[]>;
  initialState: Value;
  onConfirm: (newState: Value) => void;
  onUpdateFilterClose?: (status: boolean) => void;
  onChangeFormValues: (newValues: Value) => void;
}

export default function TagSearchButton(props: Props) {
  const { initialState, onConfirm, onUpdateFilterClose, onChangeFormValues } = props;

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
          keyQueryResult={props.keyQueryResult}
          valueQueryResult={props.valueQueryResult}
          onChangeFormValues={onChangeFormValues}
        />
      )}
    </QuickFilter>
  );
}
