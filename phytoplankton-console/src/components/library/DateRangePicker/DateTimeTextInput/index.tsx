import React from 'react';
import { Dayjs } from 'dayjs';
import TextInput, { Props as TextInputProps } from '@/components/library/TextInput';
import { dayjs } from '@/utils/dayjs';

export const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

type Props = TextInputProps & {
  onChangeDate?: (text: Dayjs | undefined) => void;
};

export default function DateTimeTextInput(props: Props) {
  const { value, onChange, onChangeDate, ...rest } = props;

  return (
    <TextInput
      value={value}
      onChange={(text) => {
        onChange?.(text);
        if (text) {
          const parsed = dayjs(text, DATE_TIME_FORMAT);
          if (parsed.isValid()) {
            onChangeDate?.(parsed);
          }
        } else {
          onChangeDate?.(undefined);
        }
      }}
      {...rest}
    />
  );
}
