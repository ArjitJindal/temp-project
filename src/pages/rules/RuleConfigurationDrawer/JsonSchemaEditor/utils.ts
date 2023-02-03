import { ExtendedSchema, PropertyItem, PropertyItems, UiSchema } from './types';
import {
  isArray,
  isObject,
} from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/schema-utils';
import { ObjectFieldValidator } from '@/components/library/Form/utils/validation/types';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';

export function getUiSchema(schema: ExtendedSchema): UiSchema {
  return schema['ui:schema'] ?? {};
}

export function getOrderedProps(schema: boolean | ExtendedSchema | undefined): PropertyItems {
  if (schema == null || typeof schema === 'boolean') {
    return [];
  }

  let keys: string[] = [];
  const properties = schema.properties ?? {};
  const uiSchema = schema['ui:schema'] ?? {};
  if (uiSchema['ui:order'] != null) {
    keys = uiSchema['ui:order'];
  } else {
    keys = Object.keys(properties); // todo: sort to always have predicted order
  }
  const required = Array.isArray(schema.required) ? schema.required : [];
  const propertiesOrdered: PropertyItems = Object.entries(properties).map(([name, schema]) => ({
    isRequired: schema.nullable !== true && required.includes(name),
    name,
    schema,
  }));
  propertiesOrdered.sort((x, y) => keys.indexOf(x.name) - keys.indexOf(y.name));
  return propertiesOrdered;
}

export function findRequiredProperty(propertyItems: PropertyItems, name: string): PropertyItem {
  const propertyItem = propertyItems.find((x) => x.name === name);
  if (propertyItem == null) {
    throw new Error(`Schema suppose to have "${name}" property`);
  }
  return propertyItem;
}

export function makeValidators<T>(props: PropertyItems): ObjectFieldValidator<T> {
  return props.reduce((acc, prop): ObjectFieldValidator<T> => {
    let propValidators;
    if (isObject(prop.schema)) {
      const orderedProps = getOrderedProps(prop.schema);
      const nestedValidators = makeValidators(orderedProps);
      if (Object.keys(nestedValidators).length > 0) {
        propValidators = nestedValidators;
      }
    } else if (prop.isRequired) {
      propValidators = notEmpty;
    }

    if (propValidators == null) {
      return acc;
    }

    return {
      ...acc,
      [prop.name]: propValidators,
    };
  }, {});
}

export function makeDefaultState(props: PropertyItems): unknown {
  return props.reduce((acc, prop) => {
    // todo: generalise for other subtypes
    let result: unknown = undefined;
    if (getUiSchema(prop.schema)['ui:subtype'] === 'DAY_WINDOW') {
      result = {
        granularity: 'day',
      };
    } else if (isObject(prop)) {
      const nestedProps = getOrderedProps(prop.schema);
      result = makeDefaultState(nestedProps);
    } else if (isArray(prop)) {
      result = [];
    }
    return {
      ...acc,
      [prop.name]: result,
    };
  }, {});
}
