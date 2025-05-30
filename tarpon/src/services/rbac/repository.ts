import { MongoClient } from 'mongodb'
import { DynamicPermissionsNodeSubType } from '@/@types/openapi-internal/DynamicPermissionsNodeSubType'
import { DynamicResourcesData } from '@/@types/openapi-internal/DynamicResourcesData'
import {
  batchInsertToClickhouse,
  executeClickhouseQuery,
  runExecClickhouseQuery,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { DYNAMIC_PERMISSIONS_ITEMS_COLLECTION } from '@/utils/mongodb-definitions'
import {
  internalMongoDeleteOne,
  internalMongoInsert,
} from '@/utils/mongodb-utils'

type DynamicPermissionItem = DynamicResourcesData & {
  subType: DynamicPermissionsNodeSubType
}

type InsertPermissionItem = DynamicPermissionItem & {
  createdAt: number
}

export class PermissionsRepository {
  constructor(
    private readonly tenantId: string,
    private readonly mongoDbClient: MongoClient
  ) {}

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

  async dynamicPermissionItemsMongo(
    type: DynamicPermissionsNodeSubType,
    search?: string
  ): Promise<DynamicPermissionItem[]> {
    const collection = DYNAMIC_PERMISSIONS_ITEMS_COLLECTION(this.tenantId)
    const mongoClient = this.mongoDbClient
    const db = mongoClient.db()
    const cursor = db.collection<DynamicPermissionItem>(collection).find({
      subType: type,
      name: search ? { $regex: search } : { $exists: true },
    })

    return await cursor.toArray()
  }

  async insertPermission(permission: InsertPermissionItem) {
    await batchInsertToClickhouse(
      this.tenantId,
      CLICKHOUSE_DEFINITIONS.DYNAMIC_PERMISSIONS_ITEMS.tableName,
      [permission]
    )
  }

  async insertPermissionMongo(permission: InsertPermissionItem) {
    const collection = DYNAMIC_PERMISSIONS_ITEMS_COLLECTION(this.tenantId)
    await internalMongoInsert(this.mongoDbClient, collection, permission)
  }

  async deletePermission(subType: DynamicPermissionsNodeSubType, id: string) {
    await runExecClickhouseQuery(this.tenantId, {
      query: `DELETE FROM ${CLICKHOUSE_DEFINITIONS.DYNAMIC_PERMISSIONS_ITEMS.tableName} WHERE id = '${id}' AND subType = '${subType}'`,
    })
  }

  async deletePermissionMongo(
    subType: DynamicPermissionsNodeSubType,
    id: string
  ) {
    const collection = DYNAMIC_PERMISSIONS_ITEMS_COLLECTION(this.tenantId)
    await internalMongoDeleteOne(this.mongoDbClient, collection, {
      subType,
      id,
    })
  }
}
