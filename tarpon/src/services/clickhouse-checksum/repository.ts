import { PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { envIs } from '@/utils/env'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ClickHouseSyncChecksum } from '@/utils/clickhouse-checksum'

const TableName = envIs('test')
  ? StackConstants.TARPON_DYNAMODB_TABLE_NAME('test')
  : 'Tarpon'

export class ClickHouseChecksumRepository {
  async getStoredClickHouseChecksums(
    tenantId: string
  ): Promise<ClickHouseSyncChecksum | null> {
    const dynamoDb = getDynamoDbClient()
    const key = DynamoDbKeys.CLICKHOUSE_SYNC_CHECKSUM(tenantId)

    try {
      const command = new GetCommand({
        TableName,
        Key: key,
        ConsistentRead: true,
      })

      const result = await dynamoDb.send(command)
      return result.Item as ClickHouseSyncChecksum | null
    } catch (error) {
      console.warn(
        `Failed to get stored checksums for tenant ${tenantId}:`,
        error
      )
      return null
    }
  }

  async storeClickHouseChecksums(
    syncChecksum: ClickHouseSyncChecksum
  ): Promise<void> {
    const dynamoDb = getDynamoDbClient()
    const key = DynamoDbKeys.CLICKHOUSE_SYNC_CHECKSUM(syncChecksum.tenantId)

    const command = new PutCommand({
      TableName,
      Item: {
        ...key,
        ...syncChecksum,
      },
    })

    await dynamoDb.send(command)
  }

  async clearClickHouseChecksums(tenantId: string): Promise<void> {
    const dynamoDb = getDynamoDbClient()
    const key = DynamoDbKeys.CLICKHOUSE_SYNC_CHECKSUM(tenantId)

    const command = new DeleteCommand({
      TableName,
      Key: key,
    })

    await dynamoDb.send(command)
  }
}
