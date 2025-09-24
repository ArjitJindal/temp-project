import React from 'react';
import QuickFilterBase from '../../QuickFilterBase';
import { InputProps } from '@/components/library/Form';
import { Props as QuickFilterProps } from '@/components/library/QuickFilter/QuickFilterBase';
import { Option } from '@/components/library/Select';
import { joinReactNodes } from '@/utils/react';
import { Comparable } from '@/utils/comparable';
import List from '@/components/library/List';

interface SharedProps<Value extends Comparable> extends QuickFilterProps {
  options: Option<Value>[];
  onUpdateFilterClose?: (status: boolean) => void;
}

interface MultipleProps<Value extends Comparable> extends SharedProps<Value>, InputProps<Value[]> {
  mode: 'MULTIPLE';
}

interface SingleProps<Value extends Comparable> extends SharedProps<Value>, InputProps<Value> {
  mode: 'SINGLE';
}

type Props<Value extends Comparable> = MultipleProps<Value> | SingleProps<Value>;

export default function ListQuickFilter<Value extends Comparable>(props: Props<Value>) {
  const { options, onChange = () => {}, onUpdateFilterClose, ...rest } = props;

  const valueArray: Value[] = props.value
    ? props.mode === 'SINGLE'
      ? [props.value]
      : props.value
    : [];
  const isEmpty = valueArray.length === 0;

  const buttonText = isEmpty
    ? undefined
    : joinReactNodes(
        options
          .filter((option) => valueArray.includes(option.value))
          .map(({ label, labelText }) => labelText ?? label),
      );

  return (
    <QuickFilterBase
      onUpdateFilterClose={onUpdateFilterClose}
      {...rest}
      buttonText={buttonText}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onChange(undefined);
            }
      }
    >
      {({ setOpen }) => (
        <List<Value>
          options={options}
          selectedValues={valueArray}
          onSelectOption={(value) => {
            if (props.mode === 'SINGLE') {
              props.onChange?.(value);
              setOpen(false);
              onUpdateFilterClose && onUpdateFilterClose(true);
            } else {
              props.onChange?.(
                !valueArray.includes(value)
                  ? [...(valueArray ?? []), value]
                  : valueArray.filter((x) => x !== value),
              );
            }
          }}
        />
      )}
    </QuickFilterBase>
  );
}
