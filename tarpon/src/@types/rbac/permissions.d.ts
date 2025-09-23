import { BaseFilterDefinition } from './filters'
import { DynamicPermissionsNode } from '@/@types/openapi-internal/DynamicPermissionsNode'
import { StaticPermissionsNode } from '@/@types/openapi-internal/StaticPermissionsNode'

export type PermissionsNode = StaticPermissionsNode | DynamicPermissionsNode

export type Permissions = PermissionsNode[]

export type FilterKey = 'filterNarrativeTemplateIds'

export type RBACFilter = Partial<Record<FilterKey, string[]>>

export type FilterableNodeInfo = {
  id: string
  path: string
  filter: BaseFilterDefinition
}
