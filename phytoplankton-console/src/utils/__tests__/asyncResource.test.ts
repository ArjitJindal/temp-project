import { describe, expect } from '@jest/globals';
import { success, init, failed, loading, getOr, all, AsyncResource } from '@/utils/asyncResource';

describe('helpers', () => {
  test('getOr', () => {
    expect(getOr(success('success value'), 'default value')).toEqual('success value');
    expect(getOr(init(), 'default value')).toEqual('default value');
    expect(getOr(failed('Some error'), 'default value')).toEqual('default value');
    expect(getOr(loading('last value'), 'default value')).toEqual('last value');
  });
  test('all', () => {
    expect(all([success('first value'), success('second value')])).toEqual(
      success(['first value', 'second value']),
    );
    expect(all([success('first value'), loading()])).toEqual(loading());
    expect(all([loading(), success('last value')])).toEqual(loading());
    expect(all([success('first value'), loading('prev value')])).toEqual(
      loading(['first value', 'prev value']),
    );

    // @ts-expect-error Result should be an AsyncResource
    const _err1: number = all([success(111), loading('222')]);
    // @ts-expect-error AsyncResource should contain the same types
    const _err2: AsyncResource<[string, string]> = all([success(111), loading('222')]);
    // @ts-expect-error Array version of a function should return proper array
    const _err3: AsyncResource<string[]> = all([success(123)] as Array<AsyncResource<number>>);

    // Properly typed values
    const _allGood: AsyncResource<[number, string]> = all([success(111), loading('222')]);
    const _allGood2: AsyncResource<string[]> = all<string>([
      success('abc'),
      success('abc'),
      success('abc'),
      success('abc'),
      success('abc'),
      success('abc'),
      success('abc'),
      success('abc'),
    ]);
  });
});
