import { ValidationResult, Validator } from './types';

export function and<T>(validators: Validator<T>[]): Validator<T> {
  return (value: T): ValidationResult => {
    for (const validator of validators) {
      const result = validator(value);
      if (result != null) {
        return result;
      }
    }
    return null;
  };
}
