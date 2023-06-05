import { JSONSchema4Type } from 'json-schema';
import { ExtendedSchema } from './types';

export function isString(schema: JSONSchema4Type): schema is string {
  return typeof schema === 'string';
}

export function isSchema(
  schema: ExtendedSchema | boolean | null | undefined,
): schema is ExtendedSchema {
  return schema != null && typeof schema === 'object';
}

export function isObject(
  schema: ExtendedSchema | boolean | null | undefined,
): schema is ExtendedSchema {
  return schema != null && typeof schema === 'object' && schema.type === 'object';
}

export function isArray(
  schema: ExtendedSchema | boolean | null | undefined,
): schema is ExtendedSchema {
  return schema != null && typeof schema === 'object' && schema.type === 'array';
}

export function getEnum(property: ExtendedSchema): ExtendedSchema[] {
  const items = property.items;
  if (items && isObject(items) && items.enum && items.enum) {
    return items.enum.filter((x): x is ExtendedSchema => x != null) ?? [];
  }
  return [];
}
