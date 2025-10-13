import React, { useRef } from 'react';
import InputQuickFilter from '@/components/library/QuickFilter/subtypes/InputQuickFilter';
import { InputProps } from '@/components/library/Form';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, DEFAULT_DATE_FORMAT, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import TextInput from '@/components/library/TextInput';
import ListQuickFilter from '@/components/library/QuickFilter/subtypes/ListQuickFilter';
import Select from '@/components/library/Select';
import { joinReactNodes } from '@/utils/react';
import NumberInput from '@/components/library/NumberInput';
import { AutoFilterProps } from '@/components/library/Filter/types';
import DateTimeRangeInput from '@/components/library/Filter/AutoFilter/DateTimeRangeInput';
import Slider from '@/components/library/Slider';

interface Props extends InputProps<unknown> {
  filter: AutoFilterProps;
  readOnly?: boolean;
}

interface SliderInputProps extends InputProps<number> {
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}

export function AutoFilter(props: Props): JSX.Element {
  const { filter, value, onChange, readOnly } = props;
  const { allowClear = true, clearNotAllowedReason, autoWidth } = filter.dataType;
  const isReadOnly = (filter.dataType as any).readOnly ?? readOnly;

  const inputRef = useRef<any>(null);
  const sharedProps = {
    title: filter.title,
    description: filter.description,
    icon: filter.icon,
    value: value as any,
    onChange,
    innerRef: inputRef,
    allowClear,
    autoWidth,
    clearNotAllowedReason,
    readOnly: isReadOnly,
  };

  if (filter.dataType.kind === 'dateRange') {
    return (
      <InputQuickFilter<[string | undefined, string | undefined]>
        {...sharedProps}
        key={filter.key}
        inputComponent={DateRangeInput}
      />
    );
  }
  if (filter.dataType.kind === 'dateTimeRange') {
    let [start, end] = (value ?? []) as [string | undefined, string | undefined];
    const minStartDate = filter.dataType.min;

    if (minStartDate && start) {
      const startTimestamp = new Date(start).getTime();
      if (startTimestamp < minStartDate) {
        start = new Date(minStartDate).toISOString();
      }
    }
    if (minStartDate && end) {
      const endTimestamp = new Date(end).getTime();
      if (endTimestamp < minStartDate) {
        end = new Date(minStartDate).toISOString();
      }
    }
    return (
      <InputQuickFilter<[string | undefined, string | undefined]>
        {...sharedProps}
        autoWidth={sharedProps.autoWidth ?? true}
        key={filter.key}
        extraInputProps={{
          clearNotAllowedReason: sharedProps.clearNotAllowedReason,
        }}
        inputComponent={DateTimeRangeInput}
        buttonText={
          value ? (
            <div>
              <span title={start ? dayjs(start).format(DEFAULT_DATE_TIME_FORMAT) : undefined}>
                {start ? dayjs(start).format(DEFAULT_DATE_FORMAT) : 'any'}
              </span>
              <span>{' — '}</span>
              <span title={end ? dayjs(end).format(DEFAULT_DATE_TIME_FORMAT) : undefined}>
                {end ? dayjs(end).format(DEFAULT_DATE_FORMAT) : 'any'}
              </span>
            </div>
          ) : undefined
        }
      />
    );
  }
  if (filter.dataType.kind === 'select') {
    if (filter.dataType.mode !== 'TAGS' && filter.dataType.displayMode === 'list') {
      return (
        <ListQuickFilter
          {...sharedProps}
          key={filter.key}
          options={filter.dataType.options ?? []}
          mode={filter.dataType.mode ?? 'SINGLE'}
          closeOnSingleSelect={filter.dataType.closeOnSingleSelect}
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
        key={filter.key}
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
    if (filter.dataType.displayAs === 'slider') {
      return (
        <InputQuickFilter<number>
          {...sharedProps}
          key={filter.key}
          extraInputProps={{
            innerRef: inputRef,
            min: filter.dataType.min,
            max: filter.dataType.max,
            step: filter.dataType.step,
            defaultValue: filter.dataType.defaultValue,
            displayFunction: filter.dataType.displayFunction,
          }}
          debounce={true}
          inputComponent={SliderWithInput}
        />
      );
    } else {
      return (
        <InputQuickFilter<number>
          {...sharedProps}
          key={filter.key}
          debounce={true}
          inputComponent={NumberInput}
          extraInputProps={{
            min: filter.dataType.min,
            max: filter.dataType.max,
            step: filter.dataType.step,
            displayFunction: filter.dataType.displayFunction,
          }}
        />
      );
    }
  }
  if (filter.dataType.kind === 'year') {
    return (
      <InputQuickFilter<string>
        {...sharedProps}
        key={filter.key}
        extraInputProps={{ innerRef: inputRef }}
        debounce={true}
        onChange={(value) => {
          if (value) {
            onChange?.(Number(value));
          } else {
            onChange?.(undefined);
          }
        }}
        inputComponent={YearPickerInput}
      />
    );
  }

  return (
    <InputQuickFilter<string>
      {...sharedProps}
      key={filter.key}
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

function YearPickerInput(props: InputProps<string>) {
  const { value } = props;
  return (
    <DatePicker.YearPicker
      value={value ? dayjs().year(parseInt(value)) : null}
      onChange={(value: any) => props.onChange?.(value?.format('YYYY'))}
    />
  );
}

function SliderWithInput(props: SliderInputProps) {
  const { value } = props;
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const step = props.step ?? 0.1;

  return (
    <Slider
      mode="SINGLE"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(value) => {
        props.onChange?.(value);
      }}
      defaultValue={props.defaultValue}
    />
  );
}
