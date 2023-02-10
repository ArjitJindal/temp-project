export type ValidationError = string;
export type ValidationResult = ValidationError | null;
export type NestedValidationResult =
  | ValidationResult
  | {
      [key: string]: NestedValidationResult;
    };

export type Validator<T> = (value: T) => ValidationResult;

export type SimpleFieldValidator<T> = Validator<T>;

export type ObjectFieldValidator<T> = {
  [Key in keyof T]?: FieldValidator<T[Key]>;
} & { nullable?: boolean };

export type FieldValidator<T> = SimpleFieldValidator<T> | ObjectFieldValidator<T>;

export type GetFieldValidator<T> = T extends (infer K)[]
  ? FieldValidators<K>
  : T extends string | boolean | number | null | undefined
  ? SimpleFieldValidator<T>
  : ObjectFieldValidator<T>;

export function isSimpleFieldValidator<T>(
  validator: FieldValidator<T>,
): validator is SimpleFieldValidator<T> {
  return typeof validator === 'function';
}

export function isObjectFieldValidator<T>(
  validator: FieldValidator<T>,
): validator is ObjectFieldValidator<T> {
  return !isSimpleFieldValidator(validator);
}

export type FieldValidators<FormValues> = GetFieldValidator<FormValues>;

export type FormValidators<FormValues> = Validator<FormValues>[];

export function isError(result: NestedValidationResult): result is ValidationError {
  return result != null;
}
