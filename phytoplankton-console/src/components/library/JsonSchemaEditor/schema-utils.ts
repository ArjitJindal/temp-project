import { JSONSchema4Type } from 'json-schema';
import { get, omit } from 'lodash';
import { ExtendedSchema } from './types';

export function isString(schema: JSONSchema4Type): schema is string {
  return typeof schema === 'string';
}

export function isSchema(
  schema: ExtendedSchema | boolean | null | undefined,
): schema is ExtendedSchema {
  return schema != null && typeof schema === 'object';
}

export function isObject(schema: ExtendedSchema | boolean | null | undefined): boolean {
  return schema != null && typeof schema === 'object' && schema.type === 'object';
}

export function isArray(schema: ExtendedSchema | boolean | null | undefined): boolean {
  return schema != null && typeof schema === 'object' && schema.type === 'array';
}

export function getEnum(property: ExtendedSchema): ExtendedSchema[] {
  const items = property.items;
  if (items && isObject(items) && items.enum && items.enum) {
    return items.enum.filter((x): x is ExtendedSchema => x != null) ?? [];
  }
  return [];
}

export function dereferenceType(type: ExtendedSchema, rootSchema?: ExtendedSchema): ExtendedSchema {
  if (type.$ref != null) {
    const path = type.$ref;
    if (!path.startsWith('#/')) {
      throw new Error(`Only local refs ('#/...') are supported`);
    }
    if (rootSchema == null) {
      console.warn(`Unable to dereference, rootSchema is not defined`);
      return type;
    }
    const pathArray = path.substring('#/'.length).split('/');
    const result = get(rootSchema, pathArray);
    if (result == null) {
      throw new Error(`Unable to resolve ref "${path}"`);
    }
    return {
      ...result,
      ...omit(type, '$ref'),
    };
  }
  return type;
}

export function flattenAllOf(schema: ExtendedSchema, rootSchema?: ExtendedSchema) {
  const newSchema: any = {
    ...schema,
    type: 'object',
    properties: {},
    required: [],
  };
  schema.allOf?.forEach((subSchema: any) => {
    const deRefSchema = dereferenceType(subSchema, rootSchema);
    if (!deRefSchema) {
      return;
    }
    const required = deRefSchema.required;
    if (Array.isArray(required) && typeof required !== 'boolean') {
      newSchema.required.push(...required);
    }
    newSchema.properties = {
      ...newSchema.properties,
      ...deRefSchema.properties,
    };
  });
  return newSchema;
}
