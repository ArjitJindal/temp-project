import { DynamicPermissionsNode } from '@/@types/openapi-internal/DynamicPermissionsNode'
import { DynamicResourcesData } from '@/@types/openapi-internal/DynamicResourcesData'
import { StaticPermissionsNode } from '@/@types/openapi-internal/StaticPermissionsNode'

export interface StaticPermissionsInternal
  extends Omit<StaticPermissionsNode, 'children'> {
  children?: (DynamicPermissionsInternal | StaticPermissionsInternal)[]
}

export interface DynamicPermissionsInternal
  extends Omit<DynamicPermissionsNode, 'children'> {
  validator?: () => boolean
  queryGenerator?: () => string
  fetcher?: () => Promise<DynamicResourcesData>
  children?: (DynamicPermissionsInternal | StaticPermissionsInternal)[]
}

export type PermissionsNode =
  | DynamicPermissionsInternal
  | StaticPermissionsInternal

export type Permissions = PermissionsNode[]
