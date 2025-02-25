import { JSONSchemaType } from 'ajv'
import { ValueComparator } from './rule-parameter-schemas'
import { Feature } from '@/@types/openapi-internal/Feature'

interface UiSchema<Type> {
  'ui:schema'?: {
    'ui:subtype'?: string
    'ui:order'?: (keyof Type)[]
    'ui:group'?: string
  }
}

export type ExtendedJSONSchemaType<Type> = JSONSchemaType<Type> & UiSchema<Type>

export interface UiSchemaParamsShared {
  group?:
    | 'user'
    | 'geography'
    | 'transaction'
    | 'transaction_historical'
    | 'general'
}

export interface UiSchemaParamsAgeRange extends UiSchemaParamsShared {
  subtype: 'AGE_RANGE'
  defaultGranularity?: 'day' | 'month' | 'year'
}

export interface UiSchemaNumberRange extends UiSchemaParamsShared {
  subtype: 'NUMBER_RANGE'
  minimum: number
  maximum: number
  multipleOf?: number
  startExclusive?: boolean
  endExclusive?: boolean
}

export interface UiSchemaGeneric<Type> extends UiSchemaParamsShared {
  subtype?: string
  order?: (keyof Type)[]
  requiredFeatures?: Feature[]
}

export interface UiSchemaRequiredFeatures extends UiSchemaParamsShared {
  requiredFeatures: Feature[]
}

export type UiSchemaParams<Type> =
  | UiSchemaParamsAgeRange
  | UiSchemaGeneric<Type>
  | UiSchemaRequiredFeatures
  | UiSchemaNumberRange

export function uiSchema<T extends object>(
  ...args: (UiSchemaParams<T> | undefined)[]
): UiSchema<T> {
  const result: Record<string, unknown> = {}

  for (const params of args) {
    if (params != null) {
      for (const [key, value] of Object.entries(params)) {
        result[`ui:${key}`] = value
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
