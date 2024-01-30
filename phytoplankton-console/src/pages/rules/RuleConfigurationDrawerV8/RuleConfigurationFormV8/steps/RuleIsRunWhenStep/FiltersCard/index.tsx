import React from 'react';
import AgeRangeInput from 'src/components/library/AgeRangeInput';
import s from './index.module.less';
import { Filter } from './types';
import { RuleLogic } from '@/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/types';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import TextInput from '@/components/library/TextInput';
import NumberInput from '@/components/library/NumberInput';
import Toggle from '@/components/library/Toggle';
import DatePicker from '@/components/ui/DatePicker';
import { neverReturn } from '@/utils/lang';
import Select from '@/components/library/Select';
import SelectionGroup from '@/components/library/SelectionGroup';

export interface FormValues {
  filtersLogic?: RuleLogic;
}

export const INITIAL_VALUES: FormValues = {};

interface Props<Values> {
  values: { [key: string]: unknown };
  onChange: (name: string, value: unknown) => void;
  filterOptions: Filter<Values>[];
}

export default function FiltersCard<Values>(props: Props<Values>) {
  const { values, onChange, filterOptions } = props;

  return (
    <Card.Root>
      <Card.Section>
        {filterOptions.length > 0 && (
          <div className={s.root}>
            {filterOptions.map((filter) => {
              const { title, description, name } = filter;
              return (
                <div key={name} className={s.field}>
                  <Label label={title} description={description} />
                  <div className={s.input}>
                    <FilterInput
                      filter={filter}
                      value={values[name]}
                      onChange={(newValue) => {
                        onChange?.(name, newValue);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card.Section>
    </Card.Root>
  );
}

function FilterInput<Values>(props: {
  filter: Filter<Values>;
  value: any;
  onChange: (newValue: any) => void;
}) {
  const { filter, value, onChange } = props;
  if (filter.valueType.kind === 'STRING') {
    return <TextInput value={value} onChange={onChange} />;
  } else if (filter.valueType.kind === 'NUMBER') {
    return <NumberInput value={value} onChange={onChange} />;
  } else if (filter.valueType.kind === 'BOOLEAN') {
    return <Toggle value={value} onChange={onChange} />;
  } else if (filter.valueType.kind === 'DATE') {
    return <DatePicker value={value} onChange={onChange} />;
  } else if (filter.valueType.kind === 'AGE_RANGE') {
    return <AgeRangeInput value={value} onChange={onChange} defaultGranularity="year" />;
  } else if (filter.valueType.kind === 'SELECT') {
    const { options, mode, placeholder } = filter.valueType;
    return (
      <Select
        placeholder={placeholder}
        portaled
        mode={mode}
        value={value}
        onChange={onChange}
        options={options}
      />
    );
  } else if (filter.valueType.kind === 'SELECTION_GROUP') {
    const { options, defaultValue } = filter.valueType;
    return (
      <SelectionGroup
        mode="SINGLE"
        value={value ?? defaultValue}
        onChange={(newValue) => onChange(newValue === defaultValue ? undefined : newValue)}
        options={options}
      />
    );
  }
  return neverReturn(filter.valueType, <TextInput isDisabled={true} />);
}
