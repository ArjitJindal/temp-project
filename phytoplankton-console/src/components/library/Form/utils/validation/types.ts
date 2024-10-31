import { clone } from 'lodash';
// Symbol to put field-level validation messages to validation
// object and distinguish it from child validator
export const $SELF_VALIDATION = Symbol('SELF_VALIDATION');
// Need this hack since array field validator is just a validator for item type
export const $IS_ARRAY_VALIDATOR = Symbol('IS_ARRAY_VALIDATOR');

export const $IS_OPTIONAL = Symbol('IS_OPTIONAL');

export type ValidationError = string;
export type ValidationResult = ValidationError | null;
export type NestedValidationResult =
  | ValidationResult
  | {
      [key: number]: NestedValidationResult;
      [$SELF_VALIDATION]?: ValidationResult | undefined;
    }
  | {
      [key: string]: NestedValidationResult;
      [$SELF_VALIDATION]?: ValidationResult | undefined;
    };

export type Validator<T> = (value: T) => ValidationResult;

export type SimpleFieldValidator<T> = Validator<T>;

export type ObjectFieldValidator<T> = {
  [Key in keyof T]?: FieldValidator<T[Key] | undefined>;
} & {
  [$SELF_VALIDATION]?: Validator<T | undefined | null>;
  [$IS_OPTIONAL]?: boolean;
};

export type ArrayFieldValidator<T> = {
  [$IS_ARRAY_VALIDATOR]: true;
  itemValidator?: Validator<T>;
};

export type FieldValidator<T> =
  | SimpleFieldValidator<T>
  | ObjectFieldValidator<T>
  | ArrayFieldValidator<T>;

export type GetFieldValidator<T> = T extends (infer K)[]
  ? FieldValidators<K>
  : T extends string | boolean | number | null | undefined
  ? SimpleFieldValidator<T | undefined>
  : T extends (infer Item)[]
  ? ArrayFieldValidator<Item>
  : ObjectFieldValidator<T | undefined>;

export function isSimpleFieldValidator<T>(
  validator: FieldValidator<T>,
): validator is SimpleFieldValidator<T> {
  return typeof validator === 'function';
}

export function isObjectFieldValidator<T>(
  validator: FieldValidator<T>,
): validator is ObjectFieldValidator<T> {
  return !isSimpleFieldValidator(validator) && !isArrayFieldValidator(validator);
}

export function isArrayFieldValidator<T>(
  validator: FieldValidator<T>,
): validator is ArrayFieldValidator<T> {
  return typeof validator === 'object' && validator[$IS_ARRAY_VALIDATOR] === true;
}

export type FieldValidators<FormValues> = GetFieldValidator<FormValues>;

export type FormValidators<FormValues> = Validator<FormValues>[];

export function isError(result: NestedValidationResult): result is ValidationError {
  return !isResultValid(result);
}

export function isResultValid(result: NestedValidationResult): boolean {
  if (result == null) {
    return true;
  }
  if (typeof result === 'string') {
    return false;
  }
  if ($SELF_VALIDATION in result) {
    if (!isResultValid(result[$SELF_VALIDATION] ?? null)) {
      return false;
    }
    result = clone(result) as NestedValidationResult;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete result[$SELF_VALIDATION];
  }
  if (Array.isArray(result)) {
    return result.every((x) => isResultValid(x));
  }
  const keys = Object.keys(result as object);
  if (keys.length === 0) {
    return true;
  }
  return keys.every((key) => isResultValid(result?.[key]));
}
