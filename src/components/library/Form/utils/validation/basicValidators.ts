import { Validator } from '@/components/library/Form/utils/validation/types';

export const notEmpty: Validator<unknown> = (value) => {
  if (value == null || value === '') {
    return 'This field can not be empty';
  }
  return null;
};
