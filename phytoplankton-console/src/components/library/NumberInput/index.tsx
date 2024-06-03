import React, { useState, useCallback, useEffect } from 'react';
import TextInput, { Props as TextInputProps } from '@/components/library/TextInput';
import { InputProps } from '@/components/library/Form';
import { usePrevious } from '@/utils/hooks';

export { default as Styles } from '../TextInput/style.module.less';

export interface Props extends Omit<TextInputProps, keyof InputProps<string>>, InputProps<number> {
  min?: number;
  max?: number;
  step?: number;
  commitMode?: 'ON_CHANGE' | 'ON_BLUR';
}

export default function NumberInput(props: Props) {
  const { value, onChange, onBlur, min, max, step = 1, commitMode = 'ON_CHANGE', ...rest } = props;
  const textValue =
    value != null
      ? `${value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 })}`
      : undefined;

  const [inputText, setInputText] = useState<string | undefined>(textValue);

  const checkAndApply = useCallback(
    (inputText, reset = true) => {
      if (inputText == null) {
        onChange?.(undefined);
      } else {
        let newNumberValue = Number(inputText);
        if (Number.isFinite(newNumberValue)) {
          newNumberValue = min != null ? Math.max(min, newNumberValue) : newNumberValue;
          newNumberValue = max != null ? Math.min(max, newNumberValue) : newNumberValue;
          onChange?.(newNumberValue);
        }
        if (reset) {
          setInputText(textValue);
        }
      }
    },
    [max, min, textValue, onChange],
  );

  const prevValue = usePrevious(value);
  useEffect(() => {
    if (value != prevValue) {
      setInputText(textValue);
    }
  }, [value, prevValue, textValue]);

  const handleBlur = useCallback(() => {
    checkAndApply(inputText, true);
    onBlur?.();
  }, [checkAndApply, inputText, onBlur]);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      if (newValue == null || newValue.match(/^[-+]?[0-9,.]*$/)) {
        const newInputText = newValue?.replace(',', '.');
        setInputText(newInputText);
        if (commitMode === 'ON_CHANGE') {
          checkAndApply(newInputText, false);
        }
      }
    },
    [checkAndApply, commitMode],
  );

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
