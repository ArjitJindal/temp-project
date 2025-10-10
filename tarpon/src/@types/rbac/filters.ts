import { PermissionsAction } from '../openapi-internal/PermissionsAction'

// Base filter definition - extensible for future filter types
export interface BaseFilterDefinition {
  type: 'enum' | 'range' | 'dateRange' | 'pattern' | 'array'
  param: string
  operators?: string
}

// Current implementation for status filters
export interface EnumFilterDefinition extends BaseFilterDefinition {
  type: 'enum'
  param: string
}

// A single filter condition
export interface FilterCondition {
  permissionId: string
  operator:
    | 'Equals'
    | 'NotEquals'
    | 'In'
    | 'NotIn'
    | 'Contains'
    | 'Range'
    | 'Pattern'
  param: string
  values: string[]
}

// A list of filter conditions
export type FilterConditions = FilterCondition[]

// Enhanced permission statement with filters
export interface FilterablePermissionStatement {
  actions: PermissionsAction[]
  resources: string[]
  filter?: FilterConditions
}
