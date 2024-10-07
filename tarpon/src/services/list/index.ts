import readline from 'node:readline'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import * as csvParse from '@fast-csv/parse'
import { S3 } from '@aws-sdk/client-s3'
import { Credentials as STSCredentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials,
} from 'aws-lambda'
import { NodeJsRuntimeStreamingBlobPayloadOutputTypes } from '@smithy/types/dist-types/streaming-payload/streaming-blob-payload-output-types'
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
} from '@/utils/pagination'
import { S3Config } from '@/services/aws/s3-service'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { getErrorMessage } from '@/utils/lang'
import { ListImportResponse } from '@/@types/openapi-internal/ListImportResponse'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getS3ClientByEvent } from '@/utils/s3'
import { CaseConfig } from '@/lambdas/console-api-case/app'

@traceable
export class ListService {
  listRepository: ListRepository
  protected s3: S3
  protected s3Config: S3Config
  protected awsCredentials?: Credentials

  constructor(
    tenantId: string,
    connections: { dynamoDb: DynamoDBDocumentClient },
    s3: S3,
    s3Config: S3Config,
    awsCredentials?: Credentials
  ) {
    this.s3 = s3
    this.s3Config = s3Config
    this.awsCredentials = awsCredentials
    this.listRepository = new ListRepository(tenantId, connections.dynamoDb)
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<STSCredentials>
    >
  ) {
    const dynamoDb = getDynamoDbClientByEvent(event)
    const s3 = getS3ClientByEvent(event)
    const { principalId: tenantId } = event.requestContext.authorizer

    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig
    return new ListService(tenantId, { dynamoDb }, s3, {
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

  public async setListItem(listId: string, item: ListItem): Promise<void> {
    return await this.listRepository.setListItem(listId, item)
  }

  public async setListItems(listId: string, items: ListItem[]): Promise<void> {
    return await this.listRepository.setListItems(listId, items)
  }

  public async deleteListItem(listId: string, itemId: string): Promise<void> {
    return await this.listRepository.deleteListItem(listId, itemId)
  }

  public async deleteList(listId: string) {
    return await this.listRepository.deleteList(listId)
  }

  public async clearListItems(listId: string): Promise<void> {
    return await this.listRepository.clearListItems(listId)
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
    return await this.listRepository.updateListItems(listId, items)
  }

  public async getListItems(
    listId: string,
    params?: Pick<CursorPaginationParams, 'fromCursorKey' | 'pageSize'>
  ): Promise<CursorPaginationResponse<ListItem>> {
    return await this.listRepository.getListItems(listId, params)
  }

  public async importFromCSV(
    listId: string,
    file: FileInfo
  ): Promise<ListImportResponse> {
    const object = await this.s3.getObject({
      Bucket: this.s3Config.tmpBucketName,
      Key: file.s3Key,
    })

    const BATCH_SIZE = 25

    if (object.Body == null) {
      throw new Error(`S3 response is empty`)
    }

    const rl = readline.createInterface({
      input: object.Body as NodeJsRuntimeStreamingBlobPayloadOutputTypes,
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
    return {
      totalRows: lineNumber,
      successRows: successRows,
      failedRows: failedRows,
    }
  }
}
