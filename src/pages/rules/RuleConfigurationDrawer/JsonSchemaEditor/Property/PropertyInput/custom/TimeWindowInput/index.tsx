import React, { useState } from 'react';
import Property from '../../../index';
import PropertyInput from '../../index';
import { UiSchemaTimeWindow } from '../../../../types';
import { findRequiredProperty, getOrderedProps } from '../../../../utils';
import s from './style.module.less';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import InputField from '@/components/library/Form/InputField';
import { InputProps } from '@/components/library/Form';
import { useFormContext } from '@/components/library/Form/utils/hooks';

interface ValueType {
  granularity?: string;
  rollingBasis?: boolean;
  units?: number;
}

interface Props extends InputProps<ValueType> {
  schema: UiSchemaTimeWindow;
}

export default function TimeWindowInput(props: Props) {
  const { value, schema, onChange } = props;
  const [fieldMeta, setFieldsMeta] = useState<{ [key: string]: FieldMeta }>({});

  const { alwaysShowErrors } = useFormContext();

  // todo: move all context providers to one place
  const subContext: FormContextValue<ValueType> = {
    alwaysShowErrors,
    meta: fieldMeta,
    setMeta: (key, cb) => {
      setFieldsMeta((state) => ({
        ...state,
        [key]: cb(state[key] ?? {}),
      }));
    },
    values: value ?? {},
    setValues: onChange ?? (() => {}),
  };

  const properties = getOrderedProps(schema);

  const unitsProperty = findRequiredProperty(properties, 'units');
  const granularityProperty = findRequiredProperty(properties, 'granularity');
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
            {(inputProps) => <PropertyInput schema={granularityProperty.schema} {...inputProps} />}
          </InputField>
        </div>
        <Property item={rollingBasisProperty} />
      </div>
    </FormContext.Provider>
  );
}
