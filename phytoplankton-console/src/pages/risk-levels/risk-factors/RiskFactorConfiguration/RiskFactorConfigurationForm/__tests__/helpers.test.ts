import { test, describe, expect } from '@jest/globals';
import { CHANGED_FIELD_MESSAGE, makeMetaFromChangedFields } from '../helpers';

describe('makeMetaFromChangedFields', () => {
  test('empty inputs should return empty results', () => {
    expect(makeMetaFromChangedFields(undefined)).toEqual({});
    expect(makeMetaFromChangedFields([])).toEqual({});
  });
  test('empty paths should be ignored', () => {
    expect(makeMetaFromChangedFields([])).toEqual({});
  });
  test('top level diff', () => {
    expect(makeMetaFromChangedFields([['f1']])).toEqual({
      f1: {
        highlight: CHANGED_FIELD_MESSAGE,
      },
    });
  });
  test('1-level nesting', () => {
    expect(makeMetaFromChangedFields([['a', 'b']])).toEqual({
      a: {
        highlight: CHANGED_FIELD_MESSAGE,
        children: {
          b: {
            highlight: CHANGED_FIELD_MESSAGE,
          },
        },
      },
    });
    expect(
      makeMetaFromChangedFields([
        ['a', 'c'],
        ['a', 'b'],
      ]),
    ).toEqual({
      a: {
        highlight: CHANGED_FIELD_MESSAGE,
        children: {
          b: {
            highlight: CHANGED_FIELD_MESSAGE,
          },
          c: {
            highlight: CHANGED_FIELD_MESSAGE,
          },
        },
      },
    });
  });
  test('multi-level nesting', () => {
    expect(
      makeMetaFromChangedFields([
        ['a', 'b', 'c', 'd', 'e'],
        ['a', 'b', 'c', 'd', 'x'],
      ]),
    ).toEqual({
      a: {
        highlight: CHANGED_FIELD_MESSAGE,
        children: {
          b: {
            highlight: CHANGED_FIELD_MESSAGE,
            children: {
              c: {
                highlight: CHANGED_FIELD_MESSAGE,
                children: {
                  d: {
                    highlight: CHANGED_FIELD_MESSAGE,
                    children: {
                      e: {
                        highlight: CHANGED_FIELD_MESSAGE,
                      },
                      x: {
                        highlight: CHANGED_FIELD_MESSAGE,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });
});
