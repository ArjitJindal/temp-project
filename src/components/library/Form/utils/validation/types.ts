export type ValidationError = string;
export type ValidationResult = ValidationError | null;

export type Validator<T> = (value: T) => ValidationResult;

export type FieldValidators<FormValues> = Partial<{
  [K in keyof FormValues]: Validator<FormValues[K]>;
}>;

export type FormValidators<FormValues> = Validator<FormValues>[];
