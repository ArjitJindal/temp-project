import React from 'react';
import { AutoFilter } from '../../../types';
import InputQuickFilter from '@/components/library/QuickFilter/subtypes/InputQuickFilter';
import { InputProps } from '@/components/library/Form';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs } from '@/utils/dayjs';
import TextInput from '@/components/library/TextInput';
import ListQuickFilter from '@/components/library/QuickFilter/subtypes/ListQuickFilter';
import Select from '@/components/library/Select';
import { joinReactNodes } from '@/utils/react';
import NumberInput from '@/components/library/NumberInput';

interface Props extends InputProps<unknown> {
  filter: AutoFilter;
}

export function AutoFilter(props: Props): JSX.Element {
  const { filter, value, onChange } = props;

  const sharedProps = {
    title: filter.title,
    key: filter.key,
    icon: filter.icon,
    value: value as any,
    onChange,
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

    return (
      <InputQuickFilter<string[]>
        {...sharedProps}
        buttonText={
          value == undefined ? undefined : joinReactNodes(options.map(({ label }) => label))
        }
        inputComponent={Select as React.FunctionComponent<InputProps<string[]>>}
        extraInputProps={{
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
  return <InputQuickFilter<string> {...sharedProps} debounce={true} inputComponent={TextInput} />;
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

function DateTimeRangeInput(props: InputProps<[string | undefined, string | undefined]>) {
  const { value } = props;
  return (
    <DatePicker.RangePicker
      showTime
      value={value ? [dayjs(value[0]), dayjs(value[1])] : undefined}
      onChange={(newValue) => {
        props.onChange?.(newValue ? [newValue[0]?.format(), newValue[1]?.format()] : undefined);
      }}
    />
  );
}
