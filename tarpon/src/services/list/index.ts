import readline from 'node:readline'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import * as csvParse from '@fast-csv/parse'
import { S3 } from '@aws-sdk/client-s3'
import { Credentials as STSCredentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NodeJsRuntimeStreamingBlobPayloadOutputTypes } from '@smithy/types/dist-types/streaming-payload/streaming-blob-payload-output-types'
import { MongoClient } from 'mongodb'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { ListRepository } from './repositories/list-repository'
import { ListType } from '@/@types/openapi-public/ListType'
import { ListSubtype } from '@/@types/openapi-public/ListSubtype'
import { ListData } from '@/@types/openapi-public/ListData'
import { ListExisted } from '@/@types/openapi-public/ListExisted'
import { ListHeader } from '@/@types/openapi-public/ListHeader'
import { ListItem } from '@/@types/openapi-public/ListItem'
import { traceable } from '@/core/xray'
import {
  CursorPaginationParams,
  CursorPaginationResponse,
  iteratePages,
} from '@/utils/pagination'
import { S3Config } from '@/services/aws/s3-service'
import {
  ThinWebhookDeliveryTask,
  sendWebhookTasks,
} from '@/services/webhook/utils'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { getErrorMessage } from '@/utils/lang'
import { ListImportResponse } from '@/@types/openapi-internal/ListImportResponse'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getS3ClientByEvent } from '@/utils/s3'
import { CaseConfig } from '@/lambdas/console-api-case/app'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getUserName } from '@/utils/helpers'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { ListUpdatedDetails } from '@/@types/openapi-public/ListUpdatedDetails'

export const METADATA_USER_FULL_NAME = 'userFullName'

@traceable
export class ListService {
  tenantId: string
  listRepository: ListRepository
  userRepository: UserRepository
  riskScoringService: RiskScoringV8Service
  protected s3: S3 | undefined
  protected s3Config: S3Config | undefined

  constructor(
    tenantId: string,
    connections: { dynamoDb: DynamoDBDocumentClient; mongoDb: MongoClient },
    s3?: S3,
    s3Config?: S3Config
  ) {
    this.tenantId = tenantId
    this.s3 = s3
    this.s3Config = s3Config
    this.listRepository = new ListRepository(tenantId, connections.dynamoDb)
    this.userRepository = new UserRepository(tenantId, connections)
    const logicEvaluator = new LogicEvaluator(tenantId, connections.dynamoDb)
    this.riskScoringService = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      { dynamoDb: connections.dynamoDb }
    )
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<STSCredentials>
    >
  ) {
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const s3 = getS3ClientByEvent(event)
    const { principalId: tenantId } = event.requestContext.authorizer

    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig
    return new ListService(tenantId, { dynamoDb, mongoDb }, s3, {
      documentBucketName: DOCUMENT_BUCKET,
      tmpBucketName: TMP_BUCKET,
    })
  }

  public async createList(
    listType: ListType,
    subtype: ListSubtype,
    newList: ListData = {},
    mannualListId?: string
  ): Promise<ListExisted> {
    return await this.listRepository.createList(
      listType,
      subtype,
      newList,
      mannualListId
    )
  }

  private async validateAndHandleReRunTriggers(
    listId: string,
    params: { items?: ListItem[]; clearedListId?: string }
  ) {
    const { items, clearedListId } = params
    const listHeader = await this.getListHeader(listId)
    if (listHeader?.subtype === 'USER_ID') {
      const userIds = items?.map((item) => item.key)
      await this.riskScoringService.handleReRunTriggers('LIST', {
        userIds: userIds,
        clearedListId: clearedListId,
      })
    }
  }

  public async setListItem(listId: string, item: ListItem): Promise<void> {
    const data = await this.listRepository.setListItem(listId, item)
    // To rerun risk scores for user
    await this.validateAndHandleReRunTriggers(listId, { items: [item] })
    await this.sendListUpdatedWebhook(listId, 'SET', [item])
    return data
  }

  public async setListItems(listId: string, items: ListItem[]): Promise<void> {
    const data = await this.listRepository.setListItems(listId, items)
    // To rerun risk scores for user
    await this.validateAndHandleReRunTriggers(listId, { items })
    await this.sendListUpdatedWebhook(listId, 'SET', items)
    return data
  }

  public async deleteListItem(listId: string, itemId: string): Promise<void> {
    const existingItem = await this.listRepository.getListItem(listId, itemId)
    if (!existingItem) {
      return
    }
    await this.listRepository.deleteListItem(listId, itemId)
    // To re run risk scoring on triggers
    await this.validateAndHandleReRunTriggers(listId, { items: [existingItem] })
    await this.sendListUpdatedWebhook(listId, 'UNSET', [existingItem])
  }

  public async deleteList(listId: string) {
    await this.listRepository.deleteList(listId)
    await this.sendListUpdatedWebhook(listId, 'CLEAR')
  }

  public async clearListItems(listId: string): Promise<void> {
    await this.listRepository.clearListItems(listId)
    // To re run risk scoring on triggers
    await this.validateAndHandleReRunTriggers(listId, {
      clearedListId: listId,
    })
    await this.sendListUpdatedWebhook(listId, 'CLEAR')
  }

  public async getListHeaders(
    listType: ListType | null = null
  ): Promise<ListHeader[]> {
    return await this.listRepository.getListHeaders(listType)
  }

  public async getListHeader(listId: string): Promise<ListHeader | null> {
    return await this.listRepository.getListHeader(listId)
  }

  public async updateListHeader(list: ListHeader): Promise<void> {
    return await this.listRepository.updateListHeader(list)
  }

  public async updateListItems(
    listId: string,
    items: ListItem[]
  ): Promise<void> {
    await this.listRepository.updateListItems(listId, items)
    await this.sendListUpdatedWebhook(listId, 'SET', items)
  }

  public async getListItems(
    listId: string,
    params?: Pick<CursorPaginationParams, 'fromCursorKey' | 'pageSize'>
  ): Promise<CursorPaginationResponse<ListItem>> {
    return await this.listRepository.getListItems(listId, params)
  }

  public async getListItem(
    listId: string,
    key: string
  ): Promise<ListItem | null> {
    return await this.listRepository.getListItem(listId, key)
  }

  public async importCsvFromStream(
    listId: string,
    input: NodeJS.ReadableStream
  ): Promise<ListImportResponse> {
    const BATCH_SIZE = 25

    const rl = readline.createInterface({
      input: input,
      crlfDelay: Infinity,
    })
    let lineNumber = 0
    let successRows = 0
    const failedRows: ListImportResponse['failedRows'] = []
    let batch: ListItem[] = []
    const uniqueItems = new Set<string>()

    for await (const line of rl) {
      try {
        const parsedRow: string[] = await new Promise((resolve, reject) => {
          csvParse
            .parseString(line)
            .on('data', (row: string[]) => resolve(row))
            .on('error', (error) => reject(error))
            .on('end', () => resolve([]))
        })
        if (parsedRow.length < 1) {
          throw new Error(
            `Every row should contain at least 1 values (item key)`
          )
        }
        const [key, reason] = parsedRow

        const item = {
          key,
          metadata: reason ? { reason } : undefined,
        }

        if (uniqueItems.has(key)) {
          continue
        }
        uniqueItems.add(key)
        batch.push(item)

        if (batch.length === BATCH_SIZE) {
          await this.setListItems(listId, batch)
          batch = []
        }
        successRows++
      } catch (e) {
        failedRows.push({ lineNumber, reason: getErrorMessage(e) })
      }
      lineNumber++
    }
    if (batch.length > 0) {
      await this.setListItems(listId, batch)
    }

    await this.syncListMetadata(listId)

    return {
      totalRows: lineNumber,
      successRows: successRows,
      failedRows: failedRows,
    }
  }

  public async syncListsMetadata(
    providedData: {
      listIds?: string[]
      keys?: string[]
    } = {}
  ) {
    const { listIds, keys } = providedData
    const listIdsToSync =
      listIds != null
        ? listIds
        : (await this.listRepository.getListHeaders()).map((x) => x.listId)
    await Promise.all(
      listIdsToSync.map((listId) =>
        keys != null
          ? this.syncListItemsMetadata(listId, keys)
          : this.syncListMetadata(listId)
      )
    )
  }

  public async syncListItemsMetadata(listId: string, keys: string[]) {
    const listHeader = await this.getListHeader(listId)
    if (listHeader?.subtype === 'USER_ID') {
      await Promise.all(
        keys.map(async (key) => {
          const item = await this.listRepository.getListItem(listId, key)
          if (item) {
            const user = await this.userRepository.getUser<User | Business>(key)
            await this.listRepository.updateListItems(listId, [
              {
                ...item,
                metadata: {
                  ...item.metadata,
                  [METADATA_USER_FULL_NAME]: user
                    ? getUserName(user)
                    : undefined,
                },
              },
            ])
          }
        })
      )
    }
  }

  public async syncListMetadata(listId: string) {
    const listHeader = await this.getListHeader(listId)
    if (listHeader?.subtype === 'USER_ID') {
      for await (const items of iteratePages((pagination) =>
        this.listRepository.getListItems(listId, pagination)
      )) {
        const userIds = items.map((x) => x.key)
        const users = await this.userRepository.getMongoUsersByIds(userIds)
        const newItems = items.map((item): ListItem => {
          const itemUser = users.find((x) => x.userId === item.key)
          return {
            ...item,
            metadata: {
              ...item.metadata,
              [METADATA_USER_FULL_NAME]: itemUser
                ? getUserName(itemUser)
                : undefined,
            },
          }
        })
        await this.updateListItems(listId, newItems)
      }
    }
  }

  public async importCsvfromS3(
    listId: string,
    file: FileInfo
  ): Promise<ListImportResponse> {
    if (this.s3 == null || this.s3Config == null) {
      throw new Error(`ListService is not configured to work with S3`)
    }
    const object = await this.s3.getObject({
      Bucket: this.s3Config.tmpBucketName,
      Key: file.s3Key,
    })

    if (object.Body == null) {
      throw new Error(`S3 response is empty`)
    }

    return this.importCsvFromStream(
      listId,
      object.Body as NodeJsRuntimeStreamingBlobPayloadOutputTypes
    )
  }

  private async sendListUpdatedWebhook(
    listId: string,
    action: 'SET' | 'UNSET' | 'CLEAR',
    items: ListItem[] = []
  ) {
    const webhookTask: ThinWebhookDeliveryTask<ListUpdatedDetails> = {
      event: 'LIST_UPDATED',
      triggeredBy: 'SYSTEM',
      payload: {
        listId,
        action,
        items,
      },
    }
    await sendWebhookTasks<ListUpdatedDetails>(this.tenantId, [webhookTask])
  }
}
