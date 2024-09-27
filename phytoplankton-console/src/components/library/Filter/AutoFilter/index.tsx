import React, { useRef } from 'react';
import InputQuickFilter from '@/components/library/QuickFilter/subtypes/InputQuickFilter';
import { InputProps } from '@/components/library/Form';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs } from '@/utils/dayjs';
import TextInput from '@/components/library/TextInput';
import ListQuickFilter from '@/components/library/QuickFilter/subtypes/ListQuickFilter';
import Select from '@/components/library/Select';
import { joinReactNodes } from '@/utils/react';
import NumberInput from '@/components/library/NumberInput';
import { AutoFilterProps } from '@/components/library/Filter/types';
import DateTimeRangeInput from '@/components/library/Filter/AutoFilter/DateTimeRangeInput';

interface Props extends InputProps<unknown> {
  filter: AutoFilterProps;
  readOnly?: boolean;
}

export function AutoFilter(props: Props): JSX.Element {
  const { filter, value, onChange, readOnly } = props;

  const inputRef = useRef<any>(null);
  const allowClear = filter.dataType.allowClear != null ? filter.dataType.allowClear : true;
  const clearNotAllowedReason =
    filter.dataType.clearNotAllowedReason != null
      ? filter.dataType.clearNotAllowedReason
      : undefined;
  const sharedProps = {
    title: filter.title,
    description: filter.description,
    key: filter.key,
    icon: filter.icon,
    value: value as any,
    onChange,
    innerRef: inputRef,
    allowClear,
    clearNotAllowedReason,
    readOnly,
  };

  if (filter.dataType.kind === 'dateRange') {
    return (
      <InputQuickFilter<[string | undefined, string | undefined]>
        {...sharedProps}
        inputComponent={DateRangeInput}
      />
    );
  }
  if (filter.dataType.kind === 'dateTimeRange') {
    return (
      <InputQuickFilter<[string | undefined, string | undefined]>
        {...sharedProps}
        extraInputProps={{
          clearNotAllowedReason: sharedProps.clearNotAllowedReason,
        }}
        inputComponent={DateTimeRangeInput}
      />
    );
  }
  if (filter.dataType.kind === 'select') {
    if (filter.dataType.mode !== 'TAGS' && filter.dataType.displayMode === 'list') {
      return (
        <ListQuickFilter
          {...sharedProps}
          options={filter.dataType.options ?? []}
          mode={filter.dataType.mode ?? 'SINGLE'}
        />
      );
    }

    const options = filter.dataType.options;

    const selectedOptions = options.filter((option) => {
      if (value == null) {
        return false;
      }
      if (Array.isArray(value)) {
        return value.includes(option.value);
      }
      return value === option.value;
    });

    return (
      <InputQuickFilter<string[]>
        {...sharedProps}
        buttonText={
          selectedOptions.length === 0
            ? undefined
            : joinReactNodes(selectedOptions.map(({ label }) => label))
        }
        inputComponent={Select as React.FunctionComponent<InputProps<string[]>>}
        extraInputProps={{
          innerRef: inputRef,
          options: options,
          mode: filter.dataType.mode,
        }}
      />
    );
  }
  if (filter.dataType.kind === 'number') {
    return (
      <InputQuickFilter<number>
        {...sharedProps}
        debounce={true}
        inputComponent={NumberInput}
        extraInputProps={{
          min: filter.dataType.min,
          max: filter.dataType.max,
          step: filter.dataType.step,
        }}
      />
    );
  }
  return (
    <InputQuickFilter<string>
      {...sharedProps}
      extraInputProps={{ innerRef: inputRef }}
      debounce={true}
      inputComponent={TextInput}
    />
  );
}

function DateRangeInput(props: InputProps<[string | undefined, string | undefined]>) {
  const { value } = props;
  return (
    <DatePicker.RangePicker
      value={value ? [dayjs(value[0]), dayjs(value[1])] : undefined}
      onChange={(newValue) => {
        props.onChange?.(newValue ? [newValue[0]?.format(), newValue[1]?.format()] : undefined);
      }}
    />
  );
}
