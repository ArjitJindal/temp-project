import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { batchInsertToClickhouse } from '../../utils/clickhouse/utils'
import { NangoRecord } from '@/@types/nango'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { batchWrite } from '@/utils/dynamodb'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { traceable } from '@/core/xray'

@traceable
export class NangoRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBDocumentClient

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
  }

  public async storeRecord(records: NangoRecord[]) {
    try {
      await batchWrite(
        this.dynamoDb,
        records.map((record) => {
          const primaryKey = DynamoDbKeys.NANGO_RECORD(
            this.tenantId,
            record.model,
            record.id
          )

          logger.info('Written record', { primaryKey })

          return {
            PutRequest: {
              Item: {
                ...record.data,
                ...primaryKey,
                id: record.id,
                timestamp: dayjs(record.timestamp).valueOf(),
                model: record.model,
              },
            },
          }
        }),
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
      )
    } catch (error) {
      console.error(error)
    }
  }

  public async storeRecordsClickhouse(
    records: Omit<NangoRecord & object, 'data'>[]
  ) {
    await batchInsertToClickhouse(
      this.tenantId,
      CLICKHOUSE_DEFINITIONS.NANGO_RECORDS.tableName,
      records
    )
  }
}
