export interface FormState<FormValues> {
  values: FormValues;
  isValid: boolean;
  validationErrors: string[];
}
