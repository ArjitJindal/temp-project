import { expect } from '@jest/globals';
import { notEmpty } from '../basicValidators';

test('notEmpty', () => {
  expect(notEmpty(100)).toEqual(null);
  expect(notEmpty(0)).toEqual(null);
  expect(notEmpty('test')).toEqual(null);
  expect(notEmpty([1, 'test'])).toEqual(null);
  expect(notEmpty({ f1: 42 })).toEqual(null);
  expect(notEmpty({ f1: null })).toEqual(null);
  expect(notEmpty({ f1: undefined })).toEqual(null);

  expect(notEmpty(null)).not.toEqual(null);
  expect(notEmpty(undefined)).not.toEqual(null);
  expect(notEmpty('')).not.toEqual(null);
  expect(notEmpty([])).not.toEqual(null);
  expect(notEmpty({})).not.toEqual(null);
});
