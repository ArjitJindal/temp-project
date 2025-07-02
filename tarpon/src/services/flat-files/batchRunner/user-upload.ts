import { NotFound } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { ConnectionCredentials } from 'thunder-schema'
import { ClickHouseClient } from '@clickhouse/client'
import { FlatFileBatchRunner } from './index'
import { sendAsyncRuleTasks } from '@/services/rules-engine/utils'
import { User } from '@/@types/openapi-public/User'
import {
  FlatFileValidationResult,
  FlatFilesRecordsSchema,
} from '@/@types/flat-files'
import { UserService } from '@/services/users'
import { Business } from '@/@types/openapi-public/Business'

export class UserUploadRunner<
  T extends User | Business
> extends FlatFileBatchRunner<T> {
  public concurrency = 20
  public model: typeof User | typeof Business
  private type: 'CONSUMER' | 'BUSINESS'
  private userService: UserService

  constructor(
    tenantId: string,
    type: 'CONSUMER' | 'BUSINESS',
    connections?: {
      dynamoDb: DynamoDBDocumentClient
      mongoDb: MongoClient
      clickhouseClient: ClickHouseClient
      clickhouseConnectionConfig: ConnectionCredentials
    }
  ) {
    super(tenantId, connections)
    this.userService = new UserService(this.tenantId, {
      dynamoDb: connections?.dynamoDb,
      mongoDb: connections?.mongoDb,
    })
    this.type = type
    this.model = type === 'CONSUMER' ? User : Business
  }

  async validate(
    data: T
  ): Promise<Pick<FlatFileValidationResult, 'valid' | 'errors'>> {
    const userId = data.userId
    try {
      const user = await this.userService.getUser(userId, false)
      if (user) {
        return {
          valid: false,
          errors: [
            {
              message: `User ${userId} already exists`,
              keyword: 'USER_ALREADY_EXISTS',
              stage: 'VALIDATE_STORE',
            },
          ],
        }
      }
      return { valid: true, errors: [] }
    } catch (error) {
      if (error instanceof NotFound) {
        return { valid: true, errors: [] }
      }
      throw { valid: false, errors: error, stage: 'VALIDATE_STORE' }
    }
  }

  async batchRun(
    batchId: string,
    records: Array<{
      data: T
      schema: FlatFilesRecordsSchema
    }>
  ): Promise<void> {
    await sendAsyncRuleTasks(
      records.map((v) => ({
        type: 'USER_BATCH',
        userType: this.type,
        user: v.data,
        tenantId: this.tenantId,
        batchId: batchId,
      })),
      false
    )
  }
}
