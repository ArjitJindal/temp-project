import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { batchInsertToClickhouse } from '../../utils/clickhouse/utils'
import { NangoRecord } from '@/@types/nango'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { batchWrite, batchGet, getDynamoDbClient } from '@/utils/dynamodb'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { traceable } from '@/core/xray'
import { DEFAULT_PAGE_SIZE, offsetPaginateClickhouse } from '@/utils/pagination'
import { CRMRecord } from '@/@types/openapi-internal/CRMRecord'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { CrmGetResponse } from '@/@types/openapi-internal/CrmGetResponse'
export interface CrmRecordParams {
  model: string
  email: string
  page?: number
  pageSize?: number
  sortField?: string
  sortOrder?: 'ascend' | 'descend'
}

type PrimaryKey = { PartitionKeyID: string; SortKeyID?: string }

@traceable
export class NangoRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBDocumentClient

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
  }

  public async storeRecord(records: NangoRecord[]) {
    const keys: PrimaryKey[] = []

    try {
      await batchWrite(
        this.dynamoDb,
        records.map((record) => {
          const primaryKey = DynamoDbKeys.NANGO_RECORD(
            this.tenantId,
            record.model,
            record.id
          )

          keys.push(primaryKey)
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

    if (process.env.NODE_ENV === 'development') {
      await Promise.all(
        keys.map((key) => handleLocalChangeCapture(this.tenantId, key))
      )
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

  public async getCrmRecords(
    crmRecordParams: CrmRecordParams
  ): Promise<CrmGetResponse> {
    const { items, count: itemCount } = await getCrmTicketIds(
      crmRecordParams,
      this.tenantId
    )

    const values: string[] = items.map((obj) => Object.values(obj)[0])

    const records = await getCrmTicketRecords(values, this.tenantId)

    return {
      items: records,
      count: Number(itemCount),
    }
  }
}

const getCrmTicketIds = async (
  crmRecordParams: CrmRecordParams,
  tenantId: string
): Promise<{ items: { id: string }[]; count: number }> => {
  const { model, email, page, pageSize, sortField, sortOrder } = crmRecordParams

  const clickHouseClient = await getClickhouseClient(tenantId)

  const whereConditions = `model = '${model}' AND email = '${email}'`

  const { items, count: itemCount } = await offsetPaginateClickhouse<{
    id: string
  }>(
    clickHouseClient,
    CLICKHOUSE_DEFINITIONS.NANGO_RECORDS.tableName,
    CLICKHOUSE_DEFINITIONS.NANGO_RECORDS.tableName,
    {
      pageSize: pageSize || DEFAULT_PAGE_SIZE,
      sortField: sortField ?? '',
      page: page || 1,
      sortOrder: sortOrder ?? 'ascend',
    },

    whereConditions,

    { id: 'id' }
  )

  return {
    items: items,
    count: itemCount,
  }
}

const getCrmTicketRecords = async (
  values: string[],
  tenantId: string
): Promise<CRMRecord[]> => {
  const dynamoDb = await getDynamoDbClient()
  const res = await batchGet<CRMRecord>(
    dynamoDb,
    StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
    values.map((id) =>
      DynamoDbKeys.NANGO_RECORD(tenantId, 'FreshDeskTicket', id)
    )
  )

  return res
}

const handleLocalChangeCapture = async (
  tenantId: string,
  primaryKey: { PartitionKeyID: string; SortKeyID?: string }
) => {
  const { localTarponChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )

  await localTarponChangeCaptureHandler(tenantId, primaryKey, 'TARPON')
}
