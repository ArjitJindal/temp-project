import React, { useRef, useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import InputQuickFilter from '@/components/library/QuickFilter/subtypes/InputQuickFilter';
import { InputProps } from '@/components/library/Form';
import DatePicker from '@/components/ui/DatePicker';
import { Dayjs, dayjs } from '@/utils/dayjs';
import TextInput from '@/components/library/TextInput';
import ListQuickFilter from '@/components/library/QuickFilter/subtypes/ListQuickFilter';
import Select from '@/components/library/Select';
import { joinReactNodes } from '@/utils/react';
import NumberInput from '@/components/library/NumberInput';
import { AutoFilterProps } from '@/components/library/Filter/types';

interface Props extends InputProps<unknown> {
  filter: AutoFilterProps;
}

export function AutoFilter(props: Props): JSX.Element {
  const { filter, value, onChange } = props;

  const inputRef = useRef<any>(null);
  const allowClear = filter.dataType.allowClear != null ? filter.dataType.allowClear : true;
  const sharedProps = {
    title: filter.title,
    description: filter.description,
    key: filter.key,
    icon: filter.icon,
    value: value as any,
    onChange,
    innerRef: inputRef,
    allowClear,
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

function DateTimeRangeInput(props: InputProps<[string | undefined, string | undefined]>) {
  const { value, allowClear } = props;
  const startTime = dayjs().subtract(1, 'day').startOf('day');
  const endTime = dayjs().endOf('day');
  const defaultDateRange: RangeValue<Dayjs> = [startTime, endTime];

  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);

  const getDateRangeToShow = (dateRange: RangeValue<Dayjs> | undefined) => {
    return isDatePickerOpen ? dateRange ?? defaultDateRange : dateRange;
  };
  return (
    <DatePicker.RangePicker
      showTime
      value={getDateRangeToShow(value ? [dayjs(value[0]), dayjs(value[1])] : undefined)}
      onChange={(newValue) => {
        props.onChange?.(newValue ? [newValue[0]?.format(), newValue[1]?.format()] : undefined);
      }}
      onOk={(newValue) => {
        if (!value) {
          props.onChange?.(newValue ? [newValue[0]?.format(), newValue[1]?.format()] : undefined);
        }
      }}
      onOpenChange={(state) => {
        setIsDatePickerOpen(state);
      }}
      allowClear={allowClear}
    />
  );
}
