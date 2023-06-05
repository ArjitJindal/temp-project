import { expect } from '@jest/globals';
import { and } from '../combinators';
import { notEmpty } from '../basicValidators';

test('and', () => {
  const v = and([
    notEmpty,
    (value) => (typeof value === 'string' && value.length > 5 ? null : 'Should be longer than 5'),
  ]);

  expect(v('123456')).toEqual(null);

  expect(v(null)).not.toEqual(null);
  expect(v(42)).not.toEqual(null);
  expect(v('')).not.toEqual(null);
  expect(v('12345')).not.toEqual(null);
  expect(v(null)).not.toEqual(null);
  expect(v([1, 2, 3, 4, 5, 6])).not.toEqual(null);
});
