import { describe, expect } from '@jest/globals';
import { collectVarNamesFromJsonLogic } from '../helpers';

describe('collectVarNamesFromJsonLogic', () => {
  test('atomic values', () => {
    expect(collectVarNamesFromJsonLogic(true)).toEqual([]);
    expect(collectVarNamesFromJsonLogic(false)).toEqual([]);
    expect(collectVarNamesFromJsonLogic(42)).toEqual([]);
    expect(collectVarNamesFromJsonLogic('')).toEqual([]);
  });
  test('var object', () => {
    expect(collectVarNamesFromJsonLogic({ var: 'abc' })).toEqual(['abc']);
  });
  test('nested structure', () => {
    expect(
      collectVarNamesFromJsonLogic({
        and: [{ '<': [{ var: 'temp' }, 110] }, { '==': [{ var: 'bbb' }, { var: 'aaa' }] }],
      }),
    ).toEqual(['aaa', 'bbb', 'temp']);
  });
});
