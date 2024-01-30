import React, { useState, useEffect } from 'react';
import { useDebounce } from 'ahooks';
import s from './style.module.less';
import FiltersCard from './FiltersCard';
import { TRANSACTIONS_FILTERS, USER_FILTERS, FiltersValues } from './filtersDefinitions';
import SegmentedControl from '@/components/library/SegmentedControl';
import { RuleLogic } from '@/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/types';
import { useFieldState } from '@/components/library/Form/utils/hooks';
import { useIsChanged } from '@/utils/hooks';

export interface FormValues {
  filtersLogic?: RuleLogic;
  filtersLogicFormValues?: FiltersValues;
}

export const INITIAL_VALUES: FormValues = {
  filtersLogic: undefined,
};

interface Props {}

export default function RuleIsRunWhenStep(_props: Props) {
  const [entityType, setEntityType] = useState<'USER' | 'TRANSACTION'>('USER');

  const filtersLogicField = useFieldState<FormValues, 'filtersLogic'>('filtersLogic');
  const filtersLogicFormValuesField = useFieldState<FormValues, 'filtersLogicFormValues'>(
    'filtersLogicFormValues',
  );

  const [values, setValues] = useState<FiltersValues>(filtersLogicFormValuesField.value ?? {});

  const debouncedValues = useDebounce(values, { wait: 500 });
  const valuesChanged = useIsChanged(debouncedValues);
  useEffect(() => {
    if (!valuesChanged) {
      return;
    }
    const conditions: RuleLogic[] = [];
    const allFilters = [...USER_FILTERS, ...TRANSACTIONS_FILTERS];
    for (const filter of allFilters) {
      const value = values[filter.name];
      if (filter.buildLogic != null && value != null) {
        const condition = filter.buildLogic(value, { deps: values });
        if (condition != null) {
          conditions.push(condition);
        }
      }
    }
    const result = conditions.length > 0 ? { and: conditions } : undefined;
    filtersLogicField.onChange(result);
    filtersLogicFormValuesField.onChange(values);
  }, [filtersLogicField, filtersLogicFormValuesField, valuesChanged, values]);

  return (
    <div className={s.root}>
      <SegmentedControl
        active={entityType}
        onChange={setEntityType}
        items={[
          { value: 'USER' as const, label: 'User filters' },
          { value: 'TRANSACTION' as const, label: 'Transaction filters' },
        ].map((item) => {
          const currentFilters = item.value === 'USER' ? USER_FILTERS : TRANSACTIONS_FILTERS;
          const filter = currentFilters.filter((x) => values[x.name] != null);
          const numberOfFilters = filter.length;
          return {
            ...item,
            label: numberOfFilters === 0 ? item.label : `${item.label} (${numberOfFilters})`,
          };
        })}
      />
      {entityType === 'USER' ? (
        <FiltersCard<FiltersValues>
          values={values}
          filterOptions={USER_FILTERS}
          onChange={(name, value) => {
            setValues((prevState) => ({ ...prevState, [name]: value }));
          }}
        />
      ) : (
        <FiltersCard<FiltersValues>
          values={values}
          filterOptions={TRANSACTIONS_FILTERS}
          onChange={(name, value) => {
            setValues((prevState) => ({ ...prevState, [name]: value }));
          }}
        />
      )}
    </div>
  );
}
