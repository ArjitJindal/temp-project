import {
  FieldValidator,
  FieldValidators,
  FormValidators,
  isError,
  isSimpleFieldValidator,
  NestedValidationResult,
  ObjectFieldValidator,
  ValidationError,
} from '@/components/library/Form/utils/validation/types';

export function validateForm<FormValues>(
  formValues: FormValues,
  formValidators?: FormValidators<FormValues>,
  fieldValidators?: FieldValidators<FormValues>,
): null | {
  formValidationErrors?: ValidationError[];
  fieldValidationErrors?: { [name in keyof FormValues]?: NestedValidationResult };
} {
  const formValidationErrors: ValidationError[] = (formValidators ?? [])
    .map((validator) => validator(formValues))
    .filter((x): x is ValidationError => x != null);

  if (formValidationErrors.length > 0) {
    return {
      formValidationErrors,
    };
  }
  const fieldValidatorsEntries = Object.entries(fieldValidators ?? {}) as [
    string,
    FieldValidator<FormValues[keyof FormValues]> | undefined,
  ][];

  const fieldValidationErrors = fieldValidatorsEntries
    .map(([name, validator]): [string, NestedValidationResult] => {
      return [name, validateField(validator, formValues[name])];
    })
    .filter(([_, result]) => isError(result));

  if (fieldValidationErrors.length > 0) {
    return {
      fieldValidationErrors: fieldValidationErrors.reduce(
        (acc, [name, result]) => ({
          ...acc,
          [name]: result,
        }),
        {},
      ),
    };
  }

  return null;
}

export function validateField<T>(
  fieldValidator: FieldValidator<T> | undefined,
  value: T,
): NestedValidationResult {
  if (fieldValidator == null) {
    return null;
  }
  if (isSimpleFieldValidator(fieldValidator)) {
    return fieldValidator(value);
  }
  const objectValidator: ObjectFieldValidator<T> = fieldValidator;
  const nestedResult = {};
  for (const key of Object.keys(objectValidator)) {
    const subfieldValidator = objectValidator[key];
    if (subfieldValidator != null) {
      const result = validateField(subfieldValidator, value?.[key]);
      if (result != null) {
        nestedResult[key] = result;
      }
    }
  }
  return Object.keys(nestedResult).length === 0 ? null : nestedResult;
}

export function checkFormValid<FormValues>(
  formValues: FormValues,
  formValidators?: FormValidators<FormValues>,
  fieldValidators?: FieldValidators<FormValues>,
): boolean {
  for (const validator of formValidators ?? []) {
    if (validator(formValues) != null) {
      return false;
    }
  }

  const fieldValidatorsEntries = Object.entries(fieldValidators ?? {}) as [
    string,
    FieldValidator<FormValues[keyof FormValues]> | undefined,
  ][];
  for (const [name, validator] of fieldValidatorsEntries) {
    if (!checkFieldValid(validator, formValues[name])) {
      return false;
    }
  }

  return true;
}

export function checkFieldValid<T>(
  fieldValidator: FieldValidator<T> | undefined,
  value: T,
): boolean {
  if (fieldValidator == null) {
    return true;
  }
  if (isSimpleFieldValidator(fieldValidator)) {
    return fieldValidator(value) == null;
  }
  const objectValidator: ObjectFieldValidator<T> = fieldValidator;
  for (const key of Object.keys(objectValidator)) {
    const subfieldValidator = objectValidator[key];
    if (subfieldValidator != null) {
      const result = validateField(subfieldValidator, value?.[key]);
      if (result != null) {
        return false;
      }
    }
  }
  return true;
}
