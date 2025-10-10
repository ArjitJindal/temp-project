import {
  $IS_OPTIONAL,
  $SELF_VALIDATION,
  FieldValidator,
  FieldValidators,
  FormValidators,
  isArrayFieldValidator,
  isError,
  isResultValid,
  isSimpleFieldValidator,
  NestedValidationResult,
  ObjectFieldValidator,
  ValidationError,
} from '@/components/library/Form/utils/validation/types';

export interface FormValidationResult<FormValues> {
  formValidationErrors?: ValidationError[];
  fieldValidationErrors?: { [name in keyof FormValues]?: NestedValidationResult };
}

export function validateForm<FormValues>(
  formValues: FormValues,
  formValidators?: FormValidators<FormValues>,
  fieldValidators?: FieldValidators<FormValues>,
): null | FormValidationResult<FormValues> {
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
    FieldValidator<FormValues[keyof FormValues] | undefined> | undefined,
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
  fieldValidator: FieldValidator<T | undefined> | undefined,
  value: T | undefined,
): NestedValidationResult {
  if (fieldValidator == null) {
    return null;
  }
  if (isSimpleFieldValidator(fieldValidator)) {
    return fieldValidator(value);
  }
  let nestedResult;
  if (isArrayFieldValidator(fieldValidator)) {
    if (value != null && !Array.isArray(value)) {
      console.warn(`Wrong value type, expected array: ${JSON.stringify(value)}`);
    }
    nestedResult = (Array.isArray(value) ? value : []).map((x: any) =>
      validateField(fieldValidator.itemValidator, x),
    );
  } else {
    const objectValidator: ObjectFieldValidator<T> = fieldValidator;
    nestedResult = {};
    if (!(objectValidator[$IS_OPTIONAL] && value == null)) {
      for (const key of Object.keys(objectValidator)) {
        const subfieldValidator = objectValidator[key];
        if (subfieldValidator != null) {
          const result = validateField(subfieldValidator, value?.[key]);
          if (!isResultValid(result)) {
            nestedResult[key] = result;
          }
        }
      }
    }
  }
  if (fieldValidator[$SELF_VALIDATION] != null) {
    nestedResult[$SELF_VALIDATION] = fieldValidator[$SELF_VALIDATION]?.(value);
  }

  if (isResultValid(nestedResult)) {
    return null;
  }

  return nestedResult;
}

export function validationResultToErrorMessage(
  validationResult: NestedValidationResult,
): string | null {
  if (validationResult == null) {
    return null;
  }
  if (typeof validationResult === 'string') {
    return validationResult;
  }
  const selfValidationResult = validationResult?.[$SELF_VALIDATION];
  if (typeof selfValidationResult === 'string') {
    return selfValidationResult;
  }
  return null;
}
