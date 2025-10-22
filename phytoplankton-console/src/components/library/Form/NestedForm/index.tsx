import React from 'react';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import { applyUpdater } from '@/utils/state';

interface Props {
  name: string;
  children: React.ReactNode;
}

export default function NestedForm<FormValues>(props: Props) {
  const { name, children } = props;

  const { isDisabled, fieldValidators, values, setValues, meta, setMeta, alwaysShowErrors } =
    useFormContext();
  if (values != null && typeof values !== 'object') {
    throw new Error(`Nested form expect to have object in the context`);
  }

  const fieldMeta: FieldMeta = meta?.[name] ?? {};
  const subContext: FormContextValue<FormValues> = {
    isDisabled,
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
      setValues?.((prevState) => ({
        ...values,
        [name]: applyUpdater(prevState?.[name], updater),
      }));
    },
    fieldValidators: fieldValidators?.[name],
  };
  return (
    <FormContext.Provider value={subContext as FormContextValue<unknown>}>
      {children}
    </FormContext.Provider>
  );
}
