import { DynamicPermissionsNode } from '@/@types/openapi-internal/DynamicPermissionsNode'
import { DynamicResourcesData } from '@/@types/openapi-internal/DynamicResourcesData'
import { StaticPermissionsNode } from '@/@types/openapi-internal/StaticPermissionsNode'

export interface DynamicPermissionsInternal extends DynamicPermissionsNode {
  validator: () => boolean
  queryGenerator: () => string
  fetcher: () => Promise<DynamicResourcesData>
}

export type PermissionsNode = DynamicPermissionsInternal | StaticPermissionsNode

export type Permissions = PermissionsNode[]
