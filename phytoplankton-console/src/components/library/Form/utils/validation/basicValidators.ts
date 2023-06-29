import { Validator } from '@/components/library/Form/utils/validation/types';
import { isEqual } from '@/utils/lang';

export const notEmpty: Validator<unknown> = (value) => {
  if (value == null || value === '' || isEqual(value, []) || isEqual(value, {})) {
    return 'This field can not be empty';
  }
  return null;
};

export const maxLength =
  (maxLength: number): Validator<unknown> =>
  (value) => {
    if (typeof value === 'string' && value.length > maxLength) {
      return `This field can not be longer than ${maxLength} symbols`;
    }
    return null;
  };
