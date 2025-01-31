import { Dispatch } from 'react';
import { StatePair, Updater } from '@/utils/state';
import { FieldMeta } from '@/components/library/Form/context';

export interface FormState<FormValues> {
  values: FormValues;
  isValid: boolean;
  validationErrors: string[];
  setValues: Dispatch<Updater<FormValues>>;
}

export interface InputProps<Value> {
  name?: string;
  isError?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  value?: Value;
  onChange?: (newValue: Value | undefined) => void;
  onSearch?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  allowClear?: boolean;
}

export type InternalFieldsMeta = { [key: string]: FieldMeta };

export type InternalFormState<FormValues> = {
  formValues: StatePair<FormValues>;
  isFormValid: StatePair<boolean>;
  fieldMeta: StatePair<InternalFieldsMeta>;
};
