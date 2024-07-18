import { Dispatch } from 'react';
import { Updater } from '@/utils/state';

export interface FormState<FormValues> {
  values: FormValues;
  isValid: boolean;
  validationErrors: string[];
  setValues: Dispatch<Updater<FormValues>>;
}

export interface InputProps<Value> {
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
