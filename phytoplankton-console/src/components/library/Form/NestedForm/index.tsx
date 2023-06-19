import React from 'react';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import { useFormContext } from '@/components/library/Form/utils/hooks';

interface Props {
  name: string;
  children: React.ReactNode;
}

export default function NestedForm<FormValues>(props: Props) {
  const { name, children } = props;

  const { fieldValidators, values, setValues, meta, setMeta, alwaysShowErrors } = useFormContext();
  if (values != null && typeof values !== 'object') {
    throw new Error(`Nested form expect to have object in the context`);
  }

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
    setValues: (newValues) => {
      setValues?.({
        ...values,
        [name]: newValues,
      });
    },
    fieldValidators: fieldValidators?.[name],
  };
  return (
    <FormContext.Provider value={subContext as FormContextValue<unknown>}>
      {children}
    </FormContext.Provider>
  );
}
