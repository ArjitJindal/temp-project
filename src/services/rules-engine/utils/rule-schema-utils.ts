import { JSONSchemaType } from 'ajv'

export type ExtendedJSONSchemaType<Type> = JSONSchemaType<Type> & {
  'ui:schema'?: {
    'ui:order'?: (keyof Type)[]
  }
}

export function mergeRuleSchemas<T>(
  schema1: any,
  schema2: any
): JSONSchemaType<T> {
  return {
    ...schema1,
    ...schema2,
    type: 'object',
    properties: {
      ...schema1.properties,
      ...schema2.properties,
    },
    required: Array.from(
      new Set((schema1.required || []).concat(schema2.required || []))
    ),
  } as JSONSchemaType<T>
}
