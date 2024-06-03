import { describe, expect, test } from '@jest/globals';
import {
  validate,
  RANGE_VALIDATIONS,
  DAY_RANGE_VALIDATIONS,
  AMOUNT_RANGE_VALIDATIONS,
  TIME_RANGE_VALIDATIONS,
} from '../consts';

describe('RANGE_NEW_VALUE_VALIDATIONS', () => {
  test('Empty value returns no error', () => {
    const result = validate('RANGE', RANGE_VALIDATIONS, {
      newValue: null,
      previousValues: [],
    });
    expect(result).toBeNull();
  });
  test('Any value without history should not return errors', () => {
    const result = validate('RANGE', RANGE_VALIDATIONS, {
      newValue: {
        kind: 'RANGE',
        start: 10,
        end: 2,
      },
      previousValues: [],
    });
    expect(result).toBeNull();
  });
  test('Nested ranges should return error', () => {
    const result = validate('RANGE', RANGE_VALIDATIONS, {
      newValue: null,
      previousValues: [
        {
          kind: 'RANGE',
          start: 10,
          end: 2,
        },
        {
          kind: 'RANGE',
          start: 5,
          end: 3,
        },
      ],
    });
    expect(result).toEqual('Ranges should not overlap');
  });
  test('Nested ranges should return error (another order)', () => {
    const result = validate('RANGE', RANGE_VALIDATIONS, {
      newValue: null,
      previousValues: [
        {
          kind: 'RANGE',
          start: 5,
          end: 3,
        },
        {
          kind: 'RANGE',
          start: 10,
          end: 2,
        },
      ],
    });
    expect(result).toEqual('Ranges should not overlap');
  });
});

describe('DAY_RANGE_NEW_VALUE_VALIDATIONS', () => {
  test('Empty value returns no error', () => {
    const result = validate('DAY_RANGE', DAY_RANGE_VALIDATIONS, {
      newValue: null,
      previousValues: [],
    });
    expect(result).toBeNull();
  });
  test('Any value without history should not return errors', () => {
    const result = validate('DAY_RANGE', DAY_RANGE_VALIDATIONS, {
      newValue: {
        kind: 'DAY_RANGE',
        start: 10,
        end: 2,
        startGranularity: 'DAYS',
        endGranularity: 'DAYS',
      },
      previousValues: [],
    });
    expect(result).toBeNull();
  });
  test('Two nested regions in previous values should return error', () => {
    const result = validate('DAY_RANGE', DAY_RANGE_VALIDATIONS, {
      newValue: null,
      previousValues: [
        {
          kind: 'DAY_RANGE',
          start: 10,
          end: 2,
          startGranularity: 'DAYS',
          endGranularity: 'DAYS',
        },
        {
          kind: 'DAY_RANGE',
          start: 5,
          end: 3,
          startGranularity: 'DAYS',
          endGranularity: 'DAYS',
        },
      ],
    });
    expect(result).toEqual('Day ranges should not overlap');
  });
  test('Two nested regions in previous values should return error (different order)', () => {
    const result = validate('DAY_RANGE', DAY_RANGE_VALIDATIONS, {
      newValue: null,
      previousValues: [
        {
          kind: 'DAY_RANGE',
          start: 5,
          end: 3,
          startGranularity: 'DAYS',
          endGranularity: 'DAYS',
        },
        {
          kind: 'DAY_RANGE',
          start: 10,
          end: 2,
          startGranularity: 'DAYS',
          endGranularity: 'DAYS',
        },
      ],
    });
    expect(result).toEqual('Day ranges should not overlap');
  });
  test('Two non-overlapping regions in previous values should not return error', () => {
    const result = validate('DAY_RANGE', DAY_RANGE_VALIDATIONS, {
      newValue: null,
      previousValues: [
        {
          kind: 'DAY_RANGE',
          start: 30,
          end: 20,
          startGranularity: 'DAYS',
          endGranularity: 'DAYS',
        },
        {
          kind: 'DAY_RANGE',
          start: 5,
          end: 1,
          startGranularity: 'DAYS',
          endGranularity: 'DAYS',
        },
      ],
    });
    expect(result).toBeNull();
  });
  test('Two overlapping regions in previous values should return error', () => {
    const result = validate('DAY_RANGE', DAY_RANGE_VALIDATIONS, {
      newValue: null,
      previousValues: [
        {
          kind: 'DAY_RANGE',
          start: 10,
          end: 2,
          startGranularity: 'DAYS',
          endGranularity: 'DAYS',
        },
        {
          kind: 'DAY_RANGE',
          start: 15,
          end: 1,
          startGranularity: 'DAYS',
          endGranularity: 'DAYS',
        },
      ],
    });
    expect(result).toEqual('Day ranges should not overlap');
  });
  test('Two crossing regions in new value and previous values should return error', () => {
    const result = validate('DAY_RANGE', DAY_RANGE_VALIDATIONS, {
      newValue: {
        kind: 'DAY_RANGE',
        start: 10,
        end: 2,
        startGranularity: 'DAYS',
        endGranularity: 'DAYS',
      },
      previousValues: [
        {
          kind: 'DAY_RANGE',
          start: 5,
          end: 3,
          startGranularity: 'DAYS',
          endGranularity: 'DAYS',
        },
      ],
    });
    expect(result).toEqual('Day ranges should not overlap');
  });
  test('Check different granularity comparison', () => {
    const result = validate('DAY_RANGE', DAY_RANGE_VALIDATIONS, {
      newValue: null,
      previousValues: [
        {
          kind: 'DAY_RANGE',
          start: 2,
          end: 3,
          startGranularity: 'MONTHS',
          endGranularity: 'DAYS',
        },
        {
          kind: 'DAY_RANGE',
          start: 15,
          end: 4,
          startGranularity: 'DAYS',
          endGranularity: 'DAYS',
        },
      ],
    });
    expect(result).toEqual('Day ranges should not overlap');
  });
});

describe('AMOUNT_RANGE_VALIDATIONS', () => {
  test('Two nested regions in previous values should return error', () => {
    const result = validate('AMOUNT_RANGE', AMOUNT_RANGE_VALIDATIONS, {
      newValue: null,
      previousValues: [
        {
          kind: 'AMOUNT_RANGE',
          currency: 'EUR',
          start: 2,
          end: 10,
        },
        {
          kind: 'AMOUNT_RANGE',
          currency: 'EUR',
          start: 3,
          end: 5,
        },
      ],
    });
    expect(result).toEqual('Value ranges should not overlap.');
  });
});

describe('TIME_RANGE_VALIDATIONS', () => {
  test('Two nested regions in previous values should return error', () => {
    const result = validate('TIME_RANGE', TIME_RANGE_VALIDATIONS, {
      newValue: null,
      previousValues: [
        {
          kind: 'TIME_RANGE',
          timezone: 'UTC',
          startHour: 2,
          endHour: 10,
        },
        {
          kind: 'TIME_RANGE',
          timezone: 'UTC',
          startHour: 3,
          endHour: 5,
        },
      ],
    });
    expect(result).toEqual('Time ranges should not overlap');
  });
});
