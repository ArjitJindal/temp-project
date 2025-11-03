import React, { useState } from 'react';
import Property from '../../../index';
import PropertyInput from '../../index';
import { ExtendedSchema, UiSchemaTimeWindow } from '../../../../types';
import { findRequiredProperty, useOrderedProps } from '../../../../utils';
import s from './style.module.less';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import InputField from '@/components/library/Form/InputField';
import { InputProps } from '@/components/library/Form';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import { applyUpdater } from '@/utils/state';

interface ValueType {
  granularity?: string;
  rollingBasis?: boolean;
  units?: number;
  fiscalYear?: {
    startMonth: number;
    startDay: number;
  };
}

const fiscalYearMapping: { [type: string]: { startMonth: number; startDay: number } } = {
  default: { startMonth: 1, startDay: 1 },
  indian: { startMonth: 4, startDay: 1 },
};

interface Props extends InputProps<ValueType> {
  uiSchema: UiSchemaTimeWindow;
  schema: ExtendedSchema;
}

export default function TimeWindowInput(props: Props) {
  const { value, schema, onChange } = props;
  const [fieldMeta, setFieldsMeta] = useState<{ [key: string]: FieldMeta }>({});
  const [fiscalYearType, setFiscalYearType] = useState<'default' | 'indian'>('default');

  const { isDisabled, alwaysShowErrors } = useFormContext();

  // todo: move all context providers to one place
  const subContext: FormContextValue<ValueType | undefined> = {
    isDisabled,
    alwaysShowErrors,
    meta: fieldMeta,
    setMeta: (key, cb) => {
      setFieldsMeta((state) => ({
        ...state,
        [key]: cb(state[key] ?? {}),
      }));
    },
    values: value ?? {},
    setValues: (updater) => {
      onChange?.(applyUpdater(value, updater));
    },
  };

  const properties = useOrderedProps(schema);

  const unitsProperty = findRequiredProperty(properties, 'units');
  const granularityProperty = findRequiredProperty(properties, 'granularity');

  const fiscalYearTypeProperty: ExtendedSchema = {
    type: 'string',
    title: 'Fiscal year',
    enum: ['default', 'indian'],
    enumNames: ['1st January - 31st December', '1st April - 31st March'],
  };

  const rollingBasisProperty = findRequiredProperty(properties, 'rollingBasis');

  // todo: fix any
  return (
    <FormContext.Provider value={subContext as FormContextValue<unknown>}>
      <div className={s.root}>
        <div className={s.inputs}>
          <Property item={unitsProperty} labelProps={{ level: 2 }} />
          <InputField<ValueType, 'granularity'>
            name="granularity"
            label={granularityProperty.schema.title ?? ''}
            labelProps={{ level: 2 }}
          >
            {(inputProps) => (
              <PropertyInput
                schema={granularityProperty.schema}
                {...inputProps}
                onChange={(v) => {
                  if (v !== 'fiscal_year') {
                    delete value?.fiscalYear;
                  }
                  onChange?.({
                    ...value,
                    granularity: v,
                    ...(v === 'fiscal_year' && {
                      fiscalYear: {
                        startMonth: fiscalYearMapping[fiscalYearType].startMonth,
                        startDay: fiscalYearMapping[fiscalYearType].startDay,
                      },
                    }),
                  });
                }}
              />
            )}
          </InputField>
          {value?.granularity === 'fiscal_year' && (
            <InputField<ValueType, 'fiscalYear'>
              name="fiscalYear"
              label={fiscalYearTypeProperty.title ?? ''}
              labelProps={{ level: 2 }}
            >
              {(inputProps) => (
                <PropertyInput
                  schema={fiscalYearTypeProperty}
                  {...inputProps}
                  value={fiscalYearType}
                  onChange={(v) => {
                    setFiscalYearType(v);
                    onChange?.({
                      ...value,
                      fiscalYear: {
                        startMonth: fiscalYearMapping[v].startMonth,
                        startDay: fiscalYearMapping[v].startDay,
                      },
                    });
                  }}
                />
              )}
            </InputField>
          )}
        </div>
        {value?.granularity !== 'fiscal_year' && <Property item={rollingBasisProperty} />}
      </div>
    </FormContext.Provider>
  );
}
