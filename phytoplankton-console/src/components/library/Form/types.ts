export interface FormState<FormValues> {
  values: FormValues;
  isValid: boolean;
  validationErrors: string[];
}

export interface InputProps<Value> {
  isError?: boolean;
  isDisabled?: boolean;
  value?: Value;
  onChange?: (newValue: Value | undefined) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}
