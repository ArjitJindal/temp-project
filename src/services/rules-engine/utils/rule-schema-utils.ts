import { JSONSchemaType } from 'ajv'

export function mergeRuleSchemas<T>(
  schema1: any,
  schema2: any
): JSONSchemaType<T> {
  return {
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
