import { compact, uniq } from 'lodash';
import { Item } from '../SegmentedControl';
import { ExtendedSchema, PropertyItem, PropertyItems, UiSchema } from './types';
import { useJsonSchemaEditorContext } from './context';
import {
  dereferenceType,
  flattenAllOf,
  isArray,
  isObject,
} from '@/components/library/JsonSchemaEditor/schema-utils';
import {
  $IS_ARRAY_VALIDATOR,
  $IS_OPTIONAL,
  $SELF_VALIDATION,
  FieldValidator,
  ObjectFieldValidator,
  Validator,
} from '@/components/library/Form/utils/validation/types';
import {
  maxLength,
  notEmpty,
  pattern,
} from '@/components/library/Form/utils/validation/basicValidators';
import { and } from '@/components/library/Form/utils/validation/combinators';

export function getUiSchema(schema: ExtendedSchema): UiSchema {
  return schema['ui:schema'] ?? {};
}

export function getOrderedProps(
  rawSchema: boolean | ExtendedSchema | undefined,
  rootSchema?: ExtendedSchema,
): PropertyItems {
  if (rawSchema == null || typeof rawSchema === 'boolean') {
    return [];
  }
  let keys: string[] = [];
  const schema: ExtendedSchema =
    rawSchema.allOf && rootSchema ? flattenAllOf(rawSchema, rootSchema) : rawSchema;
  const properties = schema?.properties ?? {};
  const uiSchema = schema?.['ui:schema'] ?? {};
  if (uiSchema['ui:order'] != null) {
    keys = uiSchema['ui:order'];
  } else {
    keys = Object.keys(properties); // todo: sort to always have predicted order
  }
  const required = Array.isArray(schema?.required) ? schema?.required : [];
  const propertiesOrdered: PropertyItems = Object.entries(properties)
    .filter(([_, schema]) => {
      if (rootSchema == null) {
        return true;
      }
      const fullSchema = dereferenceType(schema, rootSchema);
      const uiSchema: UiSchema = fullSchema?.['ui:schema'] ?? {};
      return uiSchema['ui:hidden'] !== true;
    })
    .map(([name, schema]) => ({
      isRequired: schema?.nullable !== true && required?.includes(name),
      name: schema?.name ?? name,
      schema,
    }));
  propertiesOrdered.sort((x, y) => keys.indexOf(x.name) - keys.indexOf(y.name));
  return propertiesOrdered;
}

export function useOrderedProps(rawSchema: boolean | ExtendedSchema | undefined): PropertyItems {
  const { rootSchema } = useJsonSchemaEditorContext();
  return getOrderedProps(rawSchema, rootSchema);
}

export function findRequiredProperty(propertyItems: PropertyItems, name: string): PropertyItem {
  const propertyItem = propertyItems.find((x) => x.name === name);
  if (propertyItem == null) {
    throw new Error(`Schema suppose to have "${name}" property`);
  }
  return propertyItem;
}

export function makeValidators<T>(
  props: PropertyItems,
  rootSchema?: ExtendedSchema,
): ObjectFieldValidator<T> {
  return props.reduce((acc, prop): FieldValidator<T> => {
    let propValidators;
    const schema = dereferenceType(prop.schema, rootSchema);
    if (isObject(schema)) {
      propValidators = {};
      const orderedProps = getOrderedProps(schema, rootSchema);
      const nestedValidators = makeValidators(orderedProps, rootSchema);
      if (Object.keys(nestedValidators).length > 0) {
        propValidators = nestedValidators;
      }
      if (prop.isRequired) {
        propValidators[$SELF_VALIDATION] = notEmpty;
      } else {
        propValidators[$IS_OPTIONAL] = true;
      }
    } else if (isArray(schema)) {
      const itemsSchema = schema.items ? dereferenceType(schema.items, rootSchema) : undefined;
      const orderedProps = getOrderedProps(itemsSchema, rootSchema);
      const itemValidator = makeValidators(orderedProps, rootSchema);
      if (itemValidator != null || prop.isRequired) {
        propValidators = {
          [$IS_ARRAY_VALIDATOR]: true,
          itemValidator: itemValidator,
        };
        if (prop.isRequired) {
          propValidators[$SELF_VALIDATION] = notEmpty;
        }
      }
    } else {
      const validators: Validator<unknown>[] = [];
      if (prop.isRequired) {
        validators.push(notEmpty);
      }
      if (schema.type === 'string') {
        if (schema.maxLength != null) {
          validators.push(maxLength(schema.maxLength));
        }
        if (schema.pattern != null) {
          validators.push(pattern(schema.pattern));
        }
      }
      if (validators.length > 0) {
        propValidators = and(validators);
      }
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
      const nestedProps = useOrderedProps(prop.schema);
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

export function getScopeSelectorItems(schema?: ExtendedSchema): Item<string>[] | null {
  const properties = Object.keys(schema?.properties ?? {});
  if (schema?.properties && properties && properties.length) {
    return uniq(
      compact(
        properties.map((property) => {
          const uiSchema = schema?.properties?.[property]?.['ui:schema'] ?? {};
          const scope = uiSchema['ui:scope'];
          return scope;
        }),
      ),
    ).map((scope) => ({ value: scope, label: scope }));
  }
  return null;
}
