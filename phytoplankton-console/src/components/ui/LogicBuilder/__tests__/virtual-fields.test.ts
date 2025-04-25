import '@testing-library/jest-dom';
import { describe, expect } from '@jest/globals';
import { Fields } from '@react-awesome-query-builder/ui';
import {
  VIRTUAL_STRING_TO_NUMBER_SUFFIX,
  addStringToNumberFields,
  addVirtualFieldsForNestedSubfields,
  reduceVirtualFields,
  parseVirtualFields,
} from '../virtual-fields';

describe('addNumberToFields', () => {
  test('should return an empty object if the fields are empty', () => {
    const fields = {};
    const result = addStringToNumberFields(fields);
    expect(result).toEqual({});
  });

  test('should do nothing if the fields are not strings', () => {
    const input: Fields = {
      'entity:01e491f8': {
        label: 'user id',
        type: 'number',
        valueSources: ['value', 'field', 'func'],
      },
    };
    const result = addStringToNumberFields(input);
    expect(result).toEqual(input);
  });
  test('should do nothing for fields with non-specific keys names', () => {
    const FIELD_NAME = 'any-field-name';
    const input: Fields = {
      [FIELD_NAME]: {
        label: 'user id',
        type: 'text',
        valueSources: ['value', 'field', 'func'],
      },
    };
    const result = addStringToNumberFields(input);
    expect(result).toEqual(input);
  });

  test('should properly add a number field to a text field', () => {
    const FIELD_NAME = 'key';
    const input: Fields = {
      [FIELD_NAME]: {
        label: 'user id',
        type: 'text',
        valueSources: ['value', 'field', 'func'],
      },
    };
    const result = addStringToNumberFields(input);
    expect(result).toEqual({
      ...input,
      [`${FIELD_NAME}${VIRTUAL_STRING_TO_NUMBER_SUFFIX}`]: {
        label: 'user id (as a number)',
        type: 'number',
        valueSources: ['value', 'field', 'func'],
      },
    });
  });
});

describe('traverseAndAddVirtualFields', () => {
  test('should return an empty object if the fields are empty', () => {
    const fields = {};
    const result = addVirtualFieldsForNestedSubfields(fields);
    expect(result).toEqual({});
  });

  test('should do nothing with first-level fields', () => {
    const input: Fields = {
      'entity:01e491f8': {
        label: 'user id',
        type: 'text',
        valueSources: ['value', 'field', 'func'],
      },
    };
    const result = addVirtualFieldsForNestedSubfields(input);
    expect(result).toEqual(input);
  });

  test('should do nothing fields with non-specific keys names', () => {
    const FIELD_NAME = 'any-field-name';
    const input = {
      'entity:01e491f8': {
        label: 'Business User / share holders (sender or receiver)',
        type: '!group',
        mode: 'array',
        conjunctions: ['AND', 'OR'],
        subfields: {
          [FIELD_NAME]: {
            label: 'user id',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
          },
        },
      },
    };
    const result = addVirtualFieldsForNestedSubfields(input);
    expect(result).toEqual({
      'entity:01e491f8': {
        label: 'Business User / share holders (sender or receiver)',
        type: '!group',
        mode: 'array',
        conjunctions: ['AND', 'OR'],
        subfields: {
          [FIELD_NAME]: {
            label: 'user id',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
          },
        },
      },
    });
  });

  test('should properly handle 1-level nested groups', () => {
    const FIELD_NAME = 'key'; // this name should be duplicated
    const input = {
      'entity:01e491f8': {
        label: 'Business User / share holders (sender or receiver)',
        type: '!group',
        mode: 'array',
        conjunctions: ['AND', 'OR'],
        subfields: {
          [FIELD_NAME]: {
            label: 'user id',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
          },
        },
      },
    };
    const result = addVirtualFieldsForNestedSubfields(input);
    expect(result).toEqual({
      'entity:01e491f8': {
        label: 'Business User / share holders (sender or receiver)',
        type: '!group',
        mode: 'array',
        conjunctions: ['AND', 'OR'],
        subfields: {
          [FIELD_NAME]: {
            label: 'user id',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
          },
          [`${FIELD_NAME}${VIRTUAL_STRING_TO_NUMBER_SUFFIX}`]: {
            label: 'user id (as a number)',
            type: 'number',
            valueSources: ['value', 'field', 'func'],
          },
        },
      },
    });
  });

  test('should properly handle multiple-level nested groups', () => {
    const FIELD_NAME = 'key'; // this name should be duplicated
    const input = {
      'entity:01e491f8': {
        label: 'Business User / share holders (sender or receiver)',
        type: '!group',
        mode: 'array',
        conjunctions: ['AND', 'OR'],
        subfields: {
          userId: {
            label: 'user id',
            type: 'text',
            valueSources: ['value', 'field', 'func'],
          },
          tags: {
            label: 'tags',
            type: '!group',
            mode: 'array',
            conjunctions: ['AND', 'OR'],
            subfields: {
              [FIELD_NAME]: {
                label: 'key',
                type: 'text',
                valueSources: ['value', 'field', 'func'],
              },
            },
          },
        },
      },
    };
    const result = addVirtualFieldsForNestedSubfields(input);
    expect(result).toEqual({
      ...input,
      'entity:01e491f8': {
        ...input['entity:01e491f8'],
        subfields: {
          ...input['entity:01e491f8'].subfields,
          tags: {
            ...input['entity:01e491f8'].subfields.tags,
            subfields: {
              ...input['entity:01e491f8'].subfields.tags.subfields,
              [`${FIELD_NAME}${VIRTUAL_STRING_TO_NUMBER_SUFFIX}`]: {
                ...input['entity:01e491f8'].subfields.tags.subfields.key,
                label: 'key (as a number)',
                type: 'number',
              },
            },
          },
        },
      },
    });
  });
});

describe('convertVirtualFields', () => {
  test('should return an empty object if the fields are empty', () => {
    const input = {};
    const result = reduceVirtualFields(input);
    expect(result).toEqual({});
  });
  test('should ignore vars with no virtual field suffix', () => {
    const input = {
      var: 'entity:bcae168a',
    };
    const result = reduceVirtualFields(input);
    expect(result).toEqual(input);
  });
  test('should properly convert number field to text field wrapped with function', () => {
    const input = {
      var: `entity:bcae168a${VIRTUAL_STRING_TO_NUMBER_SUFFIX}`,
    };
    const result = reduceVirtualFields(input);
    expect(result).toEqual({
      string_to_number: [
        {
          var: 'entity:bcae168a',
        },
      ],
    });
  });
  test('should properly handle complex json logic', () => {
    const input = {
      and: [
        {
          some: [
            {
              var: 'entity:01e491f8',
            },
            {
              some: [
                {
                  var: 'tags',
                },
                {
                  '==': [
                    {
                      var: `entity:bcae168a${VIRTUAL_STRING_TO_NUMBER_SUFFIX}`,
                    },
                    113,
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = reduceVirtualFields(input);
    expect(result).toEqual({
      and: [
        {
          some: [
            {
              var: 'entity:01e491f8',
            },
            {
              some: [
                {
                  var: 'tags',
                },
                {
                  '==': [
                    {
                      string_to_number: [
                        {
                          var: 'entity:bcae168a',
                        },
                      ],
                    },
                    113,
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });
});

describe('parseVirtualFields', () => {
  test('should return an empty object if the fields are empty', () => {
    const input = {};
    const result = parseVirtualFields(input);
    expect(result).toEqual({});
  });

  test('should ignore top-level function usages', () => {
    const input = {
      string_to_number: [
        {
          var: 'entity:bcae168a',
        },
      ],
    };
    const result = parseVirtualFields(input);
    expect(result).toEqual(input);
  });

  test('should properly unwrap function usages for nested complex json logic', () => {
    const input = {
      and: [
        {
          some: [
            {
              var: 'entity:01e491f8',
            },
            {
              some: [
                {
                  var: 'tags',
                },
                {
                  '==': [
                    {
                      string_to_number: [
                        {
                          var: 'entity:bcae168a',
                        },
                      ],
                    },
                    113,
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = parseVirtualFields(input);
    expect(result).toEqual({
      and: [
        {
          some: [
            {
              var: 'entity:01e491f8',
            },
            {
              some: [
                {
                  var: 'tags',
                },
                {
                  '==': [
                    {
                      var: `entity:bcae168a${VIRTUAL_STRING_TO_NUMBER_SUFFIX}`,
                    },
                    113,
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });
});
