import React, { useMemo, useState } from 'react';
import Property from '../../../index';
import { ExtendedSchema, UiSchemaDayWindow } from '../../../../types';
import { findRequiredProperty, useOrderedProps } from '../../../../utils';
import s from './style.module.less';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import { InputProps } from '@/components/library/Form';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import { applyUpdater } from '@/utils/state';

interface ValueType {
  granularity?: string;
  rollingBasis?: boolean;
  units?: number;
}

interface Props extends InputProps<ValueType> {
  schema: ExtendedSchema;
  uiSchema: UiSchemaDayWindow;
}

export default function DayWindowInput(props: Props) {
  const { value, schema, onChange } = props;
  const [fieldMeta, setFieldsMeta] = useState<{ [key: string]: FieldMeta }>({});

  const { alwaysShowErrors } = useFormContext();

  const subContext: FormContextValue<ValueType | undefined> = useMemo(
    () => ({
      meta: fieldMeta,
      setMeta: (key, cb) => {
        setFieldsMeta((state) => ({
          ...state,
          [key]: cb(state[key] ?? {}),
        }));
      },
      values: value ?? {
        granularity: 'day',
      },
      setValues: (updater) => {
        onChange?.(applyUpdater(value, updater));
      },
      alwaysShowErrors: alwaysShowErrors,
    }),
    [alwaysShowErrors, value, fieldMeta, onChange],
  );

  const properties = useOrderedProps(schema);

  const unitsProperty = findRequiredProperty(properties, 'units');
  const rollingBasisProperty = findRequiredProperty(properties, 'rollingBasis');

  return (
    <FormContext.Provider value={subContext as FormContextValue<unknown>}>
      <div className={s.root}>
        <div className={s.inputs}>
          <Property item={unitsProperty} labelProps={{ level: 2 }} />
        </div>
        <Property item={rollingBasisProperty} />
      </div>
    </FormContext.Provider>
  );
}
