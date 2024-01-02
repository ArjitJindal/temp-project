import React, { useState, useCallback, useEffect } from 'react';
import TextInput, { Props as TextInputProps } from '@/components/library/TextInput';
import { InputProps } from '@/components/library/Form';
import { usePrevious } from '@/utils/hooks';

export { default as Styles } from '../TextInput/style.module.less';

export interface Props extends Omit<TextInputProps, keyof InputProps<string>>, InputProps<number> {
  min?: number;
  max?: number;
  step?: number;
}

export default function NumberInput(props: Props) {
  const { value, onChange, onBlur, min, max, step = 1, ...rest } = props;
  const textValue =
    value != null
      ? `${value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 })}`
      : undefined;

  const [inputText, setInputText] = useState<string | undefined>(textValue);

  const prevInputText = usePrevious(inputText);
  useEffect(() => {
    if (prevInputText != inputText) {
      if (inputText == null) {
        onChange?.(undefined);
      } else {
        let newNumberValue = Number(inputText) || undefined;
        if (newNumberValue != null) {
          newNumberValue = min != null ? Math.max(min, newNumberValue) : newNumberValue;
          newNumberValue = max != null ? Math.min(max, newNumberValue) : newNumberValue;
          onChange?.(newNumberValue);
        }
      }
    }
  }, [max, min, onChange, prevInputText, inputText]);

  const prevValue = usePrevious(value);
  useEffect(() => {
    if (value != prevValue) {
      setInputText(textValue);
    }
  }, [value, prevValue, textValue]);

  const handleBlur = useCallback(() => {
    setInputText(textValue);
    onBlur?.();
  }, [onBlur, textValue]);

  const handleChange = useCallback((newValue: string | undefined) => {
    if (newValue == null || newValue.match(/^[-+]?[0-9,.]*$/)) {
      setInputText(newValue?.replace(',', '.'));
    }
  }, []);

  return (
    <TextInput
      {...rest}
      value={inputText}
      onChange={handleChange}
      onBlur={handleBlur}
      htmlAttrs={{
        inputMode: 'numeric',
        step,
        ...rest.htmlAttrs,
      }}
    />
  );
}
