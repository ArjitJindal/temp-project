import { isValidEmail } from '@flagright/lib/utils';
import { Validator } from '@/components/library/Form/utils/validation/types';
import { isEqual } from '@/utils/lang';

export const notEmpty: Validator<unknown> = (value) => {
  if (value == null || value === '' || isEqual(value, []) || isEqual(value, {})) {
    return 'This field can not be empty';
  }
  return null;
};

export const email: Validator<unknown> = (value) => {
  if (typeof value === 'string' && !isValidEmail(value)) {
    return 'This field should be a proper email';
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

export const pattern = (pattern: string): Validator<unknown> => {
  let re: RegExp;
  try {
    re = new RegExp(pattern);
  } catch (e) {
    console.warn(`Invalid regexp: ${pattern}`);
    return () => null;
  }
  return (value) => {
    if (typeof value === 'string' && !re.test(value)) {
      return `This field should match pattern "${pattern}"`;
    }
    return null;
  };
};
