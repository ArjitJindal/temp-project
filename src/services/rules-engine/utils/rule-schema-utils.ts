import { JSONSchemaType } from 'ajv'
import { ValueComparator } from './rule-parameter-schemas'

interface UiSchema<Type> {
  'ui:schema'?: {
    'ui:subtype'?: string
    'ui:order'?: (keyof Type)[]
    'ui:group'?: 'user' | 'geography' | 'transaction'
  }
}

export type ExtendedJSONSchemaType<Type> = JSONSchemaType<Type> & UiSchema<Type>

export interface UiSchemaParams<Type> {
  subtype?: string
  order?: (keyof Type)[]
  group?: 'user' | 'geography' | 'transaction'
}

export function uiSchema<T extends object>(
  ...args: (UiSchemaParams<T> | undefined)[]
): UiSchema<T> {
  const result: UiSchema<T>['ui:schema'] = {}

  for (const params of args) {
    if (params != null) {
      if (params.group) {
        result['ui:group'] = params.group
      }
      if (params.order) {
        result['ui:order'] = params.order
      }
      if (params.subtype) {
        result['ui:subtype'] = params.subtype
      }
    }
  }

  return {
    'ui:schema': result,
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

export function compareNumber(
  value: number,
  comparator: ValueComparator
): boolean {
  switch (comparator.comparator) {
    case 'GREATER_THAN_OR_EQUAL_TO':
      return value >= comparator.value
    case 'LESS_THAN_OR_EQUAL_TO':
      return value >= comparator.value
  }
}
