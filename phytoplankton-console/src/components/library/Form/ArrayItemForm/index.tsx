import React from 'react';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import { applyUpdater } from '@/utils/state';
import {
  FieldValidators,
  isArrayFieldValidator,
} from '@/components/library/Form/utils/validation/types';

interface Props {
  index: number;
  children: React.ReactNode;
}

export default function ArrayItemForm<FormValues>(props: Props) {
  const { index, children } = props;

  const { fieldValidators, values, setValues, meta, setMeta, alwaysShowErrors } = useFormContext();

  if (fieldValidators != null && !isArrayFieldValidator(fieldValidators)) {
    throw new Error(`ArrayItemForm expect to have array field validator`);
  }
  if (values != null && !Array.isArray(values)) {
    throw new Error(`ArrayItemForm expect to have array value in the context`);
  }
  const name = `${index}`;
  const fieldMeta: FieldMeta = meta?.[name] ?? {};
  const subContext: FormContextValue<FormValues> = {
    alwaysShowErrors,
    meta: fieldMeta.children ?? {},
    setMeta: (key, cb) => {
      setMeta(name, (prevState) => ({
        ...prevState,
        children: {
          ...prevState.children,
          [key]: cb(prevState.children?.[key] ?? {}),
        },
      }));
    },
    values: values?.[name] ?? {},
    setValues: (updater) => {
      setValues?.((prevState) => {
        if (prevState == null) {
          return prevState;
        }
        return prevState.map((x, i) => {
          if (i === index) {
            return applyUpdater(x, updater);
          }
          return x;
        });
      });
    },
    fieldValidators: fieldValidators?.itemValidator as FieldValidators<FormValues>,
  };
  return (
    <FormContext.Provider value={subContext as FormContextValue<unknown>}>
      {children}
    </FormContext.Provider>
  );
}
