import { Validator } from '@/components/library/Form/utils/validation/types';
import { isEqual } from '@/utils/lang';

export const notEmpty: Validator<unknown> = (value) => {
  if (value == null || value === '' || isEqual(value, []) || isEqual(value, {})) {
    return 'This field can not be empty';
  }
  return null;
};
