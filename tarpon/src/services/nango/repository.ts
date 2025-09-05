import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { sanitizeString } from '@flagright/lib/utils'
import {
  batchInsertToClickhouse,
  executeClickhouseQuery,
} from '../../utils/clickhouse/utils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { batchGet, batchWrite } from '@/utils/dynamodb'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { traceable } from '@/core/xray'
import { CrmGetResponse } from '@/@types/openapi-internal/CrmGetResponse'
import { CRMModelType } from '@/@types/openapi-internal/CRMModelType'
import {
  DefaultApiGetCrmRecordsRequest,
  DefaultApiGetCrmRecordsSearchRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import { CRMRecord } from '@/@types/openapi-internal/CRMRecord'
import { CRMRecordLink } from '@/@types/openapi-internal/CRMRecordLink'
import { CRMRecordSearch } from '@/@types/openapi-internal/CRMRecordSearch'

type PrimaryKey = { PartitionKeyID: string; SortKeyID?: string }

@traceable
export class NangoRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBDocumentClient

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
  }

  public async storeRecord(records: CRMRecord[]) {
    const keys: PrimaryKey[] = []

    try {
      await batchWrite(
        this.dynamoDb,
        records.map((record) => {
          const primaryKey = DynamoDbKeys.CRM_RECORD(
            this.tenantId,
            record.recordType,
            record.id
          )

          keys.push(primaryKey)

          return { PutRequest: { Item: { ...record, ...primaryKey } } }
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

  public async storeRecordsClickhouse(records: CRMRecord[]) {
    await batchInsertToClickhouse(
      this.tenantId,
      CLICKHOUSE_DEFINITIONS.CRM_RECORDS.tableName,
      records
    )
  }

  public async getMaxTimestamp(modelType: CRMModelType, crmName: string) {
    const result = await executeClickhouseQuery<{ max: number }[]>(
      this.tenantId,
      `SELECT MAX(timestamp) as max FROM ${CLICKHOUSE_DEFINITIONS.CRM_RECORDS.tableName} FINAL WHERE recordType = '${modelType}' AND crmName = '${crmName}'`
    )
    return result[0].max
  }

  public async getCrmRecords(
    crmRecordParams: DefaultApiGetCrmRecordsRequest
  ): Promise<CrmGetResponse> {
    const {
      crmName,
      modelType,
      sortField = 'timestamp',
      sortOrder = 'desc',
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
    } = crmRecordParams
    let query = `
      SELECT nr.id as id from ${CLICKHOUSE_DEFINITIONS.CRM_RECORDS.tableName} nr
      INNER JOIN ${CLICKHOUSE_DEFINITIONS.CRM_USER_RECORD_LINK.tableName} nurl
      ON nr.id = nurl.id
      WHERE nurl.crmName = '${crmName}' AND nurl.recordType = '${modelType}'
    `

    if (crmRecordParams.userId) {
      query += ` AND nurl.userId = '${crmRecordParams.userId}'`
    }

    const countQuery = `
      SELECT COUNT(*) FROM (${query})
    `

    const [count, recordIds] = await Promise.all([
      executeClickhouseQuery<{ count: number }[]>(this.tenantId, countQuery),
      executeClickhouseQuery<{ id: string }[]>(this.tenantId, query),
    ])

    query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ${pageSize} OFFSET ${
      (page - 1) * pageSize
    }`

    const records = await this.getCrmRecordsFromDynamoDb(
      recordIds.map((record) => record.id),
      modelType
    )

    return {
      items: records,
      count: count[0].count,
    }
  }

  public async getCrmRecordsFromDynamoDb(
    recordIds: string[],
    modelType: CRMModelType
  ): Promise<CRMRecord[]> {
    const records = await batchGet<CRMRecord>(
      this.dynamoDb,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      recordIds.map((id) =>
        DynamoDbKeys.CRM_RECORD(this.tenantId, modelType, id)
      ),
      { ConsistentRead: true }
    )

    return records
  }

  public async getCrmRecordsSearch(
    crmRecordSearch: DefaultApiGetCrmRecordsSearchRequest
  ): Promise<CRMRecordSearch[]> {
    const { search, modelType, crmName } = crmRecordSearch

    let nameKey: string = ''

    if (modelType === 'TICKET') {
      nameKey = 'ticketSubject'
    }

    const records = await executeClickhouseQuery<CRMRecordSearch[]>(
      this.tenantId,
      `
        SELECT id, ${nameKey} as name, recordType as type, crmName FROM ${
        CLICKHOUSE_DEFINITIONS.CRM_RECORDS.tableName
      }
        WHERE recordType = '${modelType}' AND crmName = '${crmName}' AND (id ilike '%${search}%' ${
        nameKey.length > 0
          ? `OR ${nameKey} ilike '%${sanitizeString(search)}%'`
          : ''
      })
      `
    )

    return records
  }

  public linkCrmRecordWriteRequest(link: CRMRecordLink) {
    const key = DynamoDbKeys.CRM_USER_RECORD_LINK(
      this.tenantId,
      link.userId,
      link.recordType,
      link.crmName,
      link.id
    )
    const item = {
      Item: {
        ...link,
        ...key,
      },
    }
    const tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    const crmRecord = new PutCommand({
      TableName: tableName,
      ...item,
    })
    return {
      key,
      putItemCommand: crmRecord,
      putItemInput: {
        PutRequest: {
          ...item,
        },
      },
      tableName: tableName,
    }
  }

  public async linkCrmRecord(link: CRMRecordLink) {
    const { putItemCommand: crmRecord, key } =
      this.linkCrmRecordWriteRequest(link)

    await this.dynamoDb.send(crmRecord)

    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(this.tenantId, key)
    }
  }

  public async linkCrmRecordClickhouse(link: CRMRecordLink) {
    await batchInsertToClickhouse(
      this.tenantId,
      CLICKHOUSE_DEFINITIONS.CRM_USER_RECORD_LINK.tableName,
      [link]
    )
  }
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
