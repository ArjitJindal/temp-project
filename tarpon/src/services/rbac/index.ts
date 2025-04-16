import { hydratePermissions, PERMISSIONS_LIBRARY } from './utils/permissions'
import { PermissionsRepository } from './repository'
import { PermissionsResponse } from '@/@types/openapi-internal/PermissionsResponse'
import { traceable } from '@/core/xray'
import { DynamicPermissionsNodeSubType } from '@/@types/openapi-internal/DynamicPermissionsNodeSubType'
import { DynamicResourcesData } from '@/@types/openapi-internal/DynamicResourcesData'
import { PermissionsNode } from '@/@types/rbac/permissions'

@traceable
export class PermissionsService {
  tenantId: string
  clickhouseRepository: PermissionsRepository

  constructor(tenantId: string) {
    this.tenantId = tenantId
    this.clickhouseRepository = new PermissionsRepository(tenantId)
  }

  private async getDynamicResources(
    type: DynamicPermissionsNodeSubType,
    search?: string
  ): Promise<DynamicResourcesData[]> {
    const permissions = await this.clickhouseRepository.dynamicPermissionItems(
      type,
      search
    )

    return permissions
  }

  private async traverseHydratedPermissions(
    permissions: PermissionsNode[]
  ): Promise<PermissionsNode[]> {
    for (const permission of permissions) {
      if (permission.type === 'DYNAMIC') {
        if (!permission.items) {
          permission.items = await this.getDynamicResources(permission.subType)
        }
      }

      if (permission.children) {
        permission.children = await this.traverseHydratedPermissions(
          permission.children
        )
      }
    }

    return permissions
  }

  private async putItemsInHydratedPermissions(
    permissions: PermissionsNode[]
  ): Promise<PermissionsNode[]> {
    return this.traverseHydratedPermissions(permissions)
  }

  private async filterBySearch(
    permissions: PermissionsNode[],
    search?: string
  ): Promise<PermissionsNode[]> {
    if (!search) {
      return permissions
    }

    const searchTerms = search
      .toLowerCase()
      .split(' ')
      .map((s) => s.trim())

    if (searchTerms.length === 0) {
      return permissions
    }

    const matches = async (permission: PermissionsNode): Promise<boolean> => {
      // For static nodes, search by name
      if (permission.type === 'STATIC') {
        return searchTerms.some((term) =>
          permission.name.toLowerCase().includes(term)
        )
      }

      // For dynamic nodes, search by id
      if (permission.type === 'DYNAMIC') {
        const items = await this.getDynamicResources(permission.subType, search)
        const isMatch = !!items.length

        permission.items = items

        return isMatch
      }

      return false
    }

    const filteredPermissions: PermissionsNode[] = []

    for (const permission of permissions) {
      const isMatch = await matches(permission)

      if (isMatch) {
        // If node matches, include it with all its children
        filteredPermissions.push(permission)
      } else if (permission.children) {
        // If node doesn't match, check its children
        const filteredChildren = await this.filterBySearch(
          permission.children,
          search
        )
        if (filteredChildren.length > 0) {
          filteredPermissions.push({
            ...permission,
            children: filteredChildren,
          })
        }
      }
    }

    return filteredPermissions
  }

  async getAllPermissions(search?: string): Promise<PermissionsResponse> {
    const hydratedPermissions = hydratePermissions(PERMISSIONS_LIBRARY)
    const filteredPermissions = await this.filterBySearch(
      hydratedPermissions,
      search
    )
    const permissions = await this.putItemsInHydratedPermissions(
      filteredPermissions
    )

    return {
      permissions,
    }
  }

  async insertDynamicPermission(
    subType: DynamicPermissionsNodeSubType,
    permission: DynamicResourcesData
  ): Promise<void> {
    await this.clickhouseRepository.insertPermission({
      createdAt: Date.now(),
      id: permission.id,
      name: permission.name,
      subType,
    })
  }

  async deleteDynamicPermission(
    subType: DynamicPermissionsNodeSubType,
    id: string
  ): Promise<void> {
    await this.clickhouseRepository.deletePermission(subType, id)
  }
}
