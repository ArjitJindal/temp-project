import React, { useCallback, useMemo, useState } from 'react';
import { debounce } from 'lodash';
import QuickFilter from '../..';
import { InputProps } from '@/components/library/Form';
import { Props as QuickFilterProps } from '@/components/library/QuickFilter/QuickFilterBase';
import { useDeepEqualEffect } from '@/utils/hooks';
import { joinReactNodes } from '@/utils/react';

interface Props<Value> extends QuickFilterProps, InputProps<Value> {
  debounce?: boolean;
  inputComponent: React.FunctionComponent<InputProps<Value>>;
  extraInputProps?: { [key: string]: unknown };
  innerRef?: React.RefObject<any>;
}

export default function InputQuickFilter<Value>(props: Props<Value>) {
  const {
    inputComponent: InputComponent,
    value,
    onChange = () => {},
    extraInputProps,
    debounce: isDebounce = false,
    allowClear = true,
    ...rest
  } = props;

  const [state, setState] = useState(value);
  useDeepEqualEffect(() => {
    setState(value);
  }, [value]);

  const debouncedOnChange = useMemo(
    () => (isDebounce ? debounce(onChange, 300) : onChange),
    [isDebounce, onChange],
  );

  const handleChange = useCallback(
    (newValue) => {
      setState(newValue);
      debouncedOnChange(newValue);
    },
    [debouncedOnChange],
  );

  let buttonText: any = undefined;
  if (Array.isArray(value)) {
    buttonText = joinReactNodes(value);
  } else if (value != null) {
    buttonText = value;
  }
  return (
    <QuickFilter
      buttonText={buttonText}
      onClear={
        value == null || !allowClear
          ? undefined
          : () => {
              onChange(undefined);
            }
      }
      allowClear={allowClear}
      {...rest}
    >
      <InputComponent
        value={state}
        onChange={handleChange}
        allowClear={allowClear}
        {...extraInputProps}
      />
    </QuickFilter>
  );
}
