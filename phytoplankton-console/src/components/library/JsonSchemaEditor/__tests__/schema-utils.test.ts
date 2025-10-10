import { expect } from '@jest/globals';
import { dereferenceType } from '../schema-utils';
import { ExtendedSchema } from '../types';

const SCHEMA: ExtendedSchema = {
  type: 'object',
  required: [],
  properties: {
    location: {
      $ref: '#/definitions/t_address',
    },
  },
  definitions: {
    t_address: {
      type: 'object',
      properties: {
        address_type: {
          type: 'string',
        },
      },
    },
  },
};

test('dereferenceType', () => {
  const result = dereferenceType(
    {
      $ref: '#/definitions/t_address',
    },
    SCHEMA,
  );
  expect(result).toEqual(SCHEMA.definitions?.['t_address']);
});
