import { describe, test, expect } from '@jest/globals';
import '@testing-library/jest-dom';

import { render } from 'testing-library-wrapper';
import Component from '..';
import {
  findInputField,
  addArrayItem,
  toggleArrayItem,
  toggleItem,
  expectArrayItemError,
  expectFieldError,
  typeIntoField,
  clearField,
} from './json-schema-editor.jest-helpers';
import { ExtendedSchema } from '@/components/library/JsonSchemaEditor/types';
import { getOrderedProps, makeValidators } from '@/components/library/JsonSchemaEditor/utils';
import Form from '@/components/library/Form';
import CardStyles from '@/components/ui/Card/index.module.less';

describe('Basic fields rendering', () => {
  test('Required fields should have validation messages', async () => {
    const schema: ExtendedSchema = {
      type: 'object',
      required: ['text_field', 'number_field', 'boolean_field'],
      properties: {
        text_field: {
          type: 'string',
        },
        number_field: {
          type: 'number',
        },
        boolean_field: {
          type: 'number',
        },
      },
    };

    render(<RenderSchema alwaysShowErrors={true} schema={schema} />);
    {
      const field = await findInputField('text_field');
      await expectFieldError(field, true);
    }
    {
      const field = await findInputField('number_field');
      await expectFieldError(field, true);
    }
    {
      const field = await findInputField('boolean_field');
      await expectFieldError(field, true);
    }
  });
  test('Validation message should appear after loosing focus', async () => {
    const schema: ExtendedSchema = {
      type: 'object',
      required: ['text_field', 'number_field'],
      properties: {
        text_field: {
          type: 'string',
        },
        number_field: {
          type: 'number',
        },
      },
    };
    render(<RenderSchema schema={schema} />);
    const field1 = await findInputField('text_field');
    const field2 = await findInputField('number_field');
    await expectFieldError(field1, false);
    await typeIntoField(field1, '');
    await expectFieldError(field1, false);
    await typeIntoField(field2, '');
    await expectFieldError(field1, true);
  });
  test('Validation message disappear when changing field', async () => {
    const schema: ExtendedSchema = {
      type: 'object',
      required: ['text_field'],
      properties: {
        text_field: {
          type: 'string',
        },
      },
    };

    render(<RenderSchema alwaysShowErrors={true} schema={schema} />);
    const field1 = await findInputField('text_field');
    await expectFieldError(field1, true);
    await typeIntoField(field1, 'abc');
    await expectFieldError(field1, false);
    await clearField(field1, 3);
    await expectFieldError(field1, true);
  });
});

describe('Array fields rendering', () => {
  test('Required fields should have validation messages', async () => {
    const schema: ExtendedSchema = {
      type: 'object',
      required: ['array_field'],
      properties: {
        array_field: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    };

    render(<RenderSchema alwaysShowErrors={true} schema={schema} />);
    {
      const field = await findInputField('array_field');
      await expectFieldError(field, true);
    }
  });
  test('Array item should be in error state if nested item has an error', async () => {
    const schema: ExtendedSchema = {
      type: 'object',
      required: ['array_field'],
      properties: {
        array_field: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              object_string_field: {
                type: 'string',
              },
            },
            required: ['object_string_field'],
          },
        },
      },
    };
    render(<RenderSchema alwaysShowErrors={true} schema={schema} />);

    // Find array field
    const arrayField = await findInputField('array_field');
    // Add item
    const item = await addArrayItem(arrayField);
    // Check if item is invalid (since it's nested object has required fields)
    await expectArrayItemError(item, true);
    // Open item, make sure it's not invalid anymore
    await toggleArrayItem(item, true);
    // Fill required field
    const objectStringField = await findInputField('object_string_field');
    await typeIntoField(objectStringField, 'abc');
    // Close item, make sure it is still valid
    await toggleArrayItem(item, false);
    await expectArrayItemError(item, false);
  });
});

describe('Objects validation', () => {
  test('Objects nested into optional fields should not be considered invalid if value is empty', async () => {
    const schema: ExtendedSchema = {
      type: 'object',
      required: ['f1'],
      properties: {
        f1: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              f2: {
                type: 'object',
                required: ['f3', 'f4'],
                properties: {
                  f3: {
                    type: 'string',
                  },
                  f4: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    };

    render(<RenderSchema alwaysShowErrors={true} schema={schema} />);
    const arrayField = await findInputField('f1');
    const item = await addArrayItem(arrayField);
    expect(item).toHaveClass(CardStyles.isCollapsed);
    await expectArrayItemError(item, false);
  });
  test('Invalid fields inside of array item should make the field invalid', async () => {
    const schema: ExtendedSchema = {
      type: 'object',
      required: ['f1'],
      properties: {
        f1: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              f2: {
                type: 'object',
                required: ['f3', 'f4'],
                properties: {
                  f3: {
                    type: 'string',
                  },
                  f4: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    };

    render(<RenderSchema alwaysShowErrors={true} schema={schema} />);
    const arrayField = await findInputField('f1');
    const item = await addArrayItem(arrayField);
    const arrayFieldHeader = await findInputField('f1/card');
    {
      // It should be no errors initially
      await expectArrayItemError(item, false);
      await toggleItem(arrayFieldHeader);
      const objectItem = await findInputField('f2/card');
      await toggleItem(objectItem);
      const f3 = await findInputField('f3');
      const f4 = await findInputField('f4');
      await typeIntoField(f3, 'abc');
      // After editing field in optional nested object sibling fields should be validated
      await expectFieldError(f3, false);
      await expectFieldError(f4, true);
      // Also, when array item is closed it should be considered invalid now
      await toggleItem(arrayFieldHeader);
      await expectArrayItemError(item, true);
    }
    // After cleaning everything should become valid again
    {
      await toggleItem(arrayFieldHeader);
      const objectItem = await findInputField('f2/card');
      await toggleItem(objectItem);
      const f3 = await findInputField('f3');
      const f4 = await findInputField('f4');
      await clearField(f3, 3);
      await expectFieldError(f3, false);
      await expectFieldError(f4, false);
      await toggleItem(arrayFieldHeader);
      await expectArrayItemError(item, false);
    }
  });

  test('Empty additionalProperties should be considered invalid if isRequired is true', async () => {
    const schema: ExtendedSchema = {
      type: 'object',
      required: ['f1'],
      properties: {
        f1: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
      },
    };

    render(<RenderSchema alwaysShowErrors={true} schema={schema} />);
    const f1 = await findInputField('f1');
    await typeIntoField(f1, 'abc');
    await clearField(f1, 3);
    await expectFieldError(f1, true);
  });

  test('Empty additionalProperties should be considered valid if isRequired is false', async () => {
    const schema: ExtendedSchema = {
      type: 'object',
      required: ['f1'],
      properties: {
        f1: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
      },
    };

    render(<RenderSchema alwaysShowErrors={true} schema={schema} />);
    const f1 = await findInputField('f1');
    await typeIntoField(f1, 'abc');
    await clearField(f1, 3);
    await expectFieldError(f1, true);
  });
});

/*
  helpers
 */
function RenderSchema(props: { alwaysShowErrors?: boolean; schema: ExtendedSchema }) {
  const { alwaysShowErrors = false, schema } = props;

  const schemaProps = getOrderedProps(schema);
  return (
    <Form
      initialValues={{}}
      alwaysShowErrors={alwaysShowErrors}
      fieldValidators={makeValidators(schemaProps)}
      onChange={(_values) => {}}
    >
      <Component parametersSchema={schema} />
    </Form>
  );
}
