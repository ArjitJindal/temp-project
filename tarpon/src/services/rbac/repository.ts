import { DynamicPermissionsNodeSubType } from '@/@types/openapi-internal/DynamicPermissionsNodeSubType'
import { DynamicResourcesData } from '@/@types/openapi-internal/DynamicResourcesData'
import {
  batchInsertToClickhouse,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

type DynamicPermissionItem = DynamicResourcesData & {
  subType: DynamicPermissionsNodeSubType
}

type InsertPermissionItem = DynamicPermissionItem & {
  createdAt: number
}

export class PermissionsRepository {
  constructor(private readonly tenantId: string) {}

  async dynamicPermissionItems(
    type: DynamicPermissionsNodeSubType,
    search?: string
  ): Promise<DynamicPermissionItem[]> {
    const result = await executeClickhouseQuery<DynamicPermissionItem[]>(
      this.tenantId,
      `SELECT id, name, subType from ${
        CLICKHOUSE_DEFINITIONS.DYNAMIC_PERMISSIONS_ITEMS.tableName
      } FINAL WHERE subType = '${type}'  ${
        search ? `AND name LIKE '%${search}%'` : ''
      }`
    )

    return result
  }

  async insertPermission(permission: InsertPermissionItem) {
    await batchInsertToClickhouse(
      this.tenantId,
      CLICKHOUSE_DEFINITIONS.DYNAMIC_PERMISSIONS_ITEMS.tableName,
      [permission]
    )
  }

  async deletePermission(subType: DynamicPermissionsNodeSubType, id: string) {
    await executeClickhouseQuery(this.tenantId, {
      query: `DELETE FROM ${CLICKHOUSE_DEFINITIONS.DYNAMIC_PERMISSIONS_ITEMS.tableName} WHERE id = '${id}' AND subType = '${subType}'`,
    })
  }
}
