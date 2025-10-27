import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import pick from 'lodash/pick'
import { DynamoDbKeys } from '../../core/dynamodb/dynamodb-keys'
import { StackConstants } from '../../../lib/constants'
import { BatchJobRunner } from './batch-job-runner-base'
import { generateChecksum, getSortedObject } from '@/utils/object'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { processCursorInBatch, getMongoDbClient } from '@/utils/mongodb-utils'
import {
  batchWrite,
  BatchWriteRequestInternal,
  getDynamoDbClient,
} from '@/utils/dynamodb'
import { BatchJob } from '@/@types/batch-job'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongo-table-names'
import { logger } from '@/core/logger'
import { SanctionsSearchResponse } from '@/@types/openapi-internal/SanctionsSearchResponse'

export class BackfillSearchHitsBatchJobRunner extends BatchJobRunner {
  private dynamoDb!: DynamoDBDocumentClient
  private mongoClient!: MongoClient
  private tenantId!: string

  protected async run(job: BatchJob): Promise<void> {
    this.dynamoDb = getDynamoDbClient()
    this.mongoClient = await getMongoDbClient()
    this.tenantId = job.tenantId
    try {
      const currentTime = Date.now()
      const sanctionsSearchesCollection = this.mongoClient
        .db()
        .collection<SanctionsSearchHistory>(
          SANCTIONS_SEARCHES_COLLECTION(this.tenantId)
        )

      const cursor = sanctionsSearchesCollection.find({
        createdAt: { $lte: currentTime },
      })

      logger.info(`Starting backfill for tenant ${this.tenantId}`)

      let totalProcessed = 0
      await processCursorInBatch(
        cursor,
        async (batch: SanctionsSearchHistory[]) => {
          const dynamoRequests = await this.prepareDynamoRequests(batch)
          if (dynamoRequests.length > 0) {
            await batchWrite(
              this.dynamoDb,
              dynamoRequests,
              StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
            )
          }
          totalProcessed += batch.length
          logger.info(`Processed ${totalProcessed} records`)
        },
        {
          mongoBatchSize: 1000,
          processBatchSize: 1000,
          debug: true,
        }
      )

      await this.markBackfillComplete()
      logger.info(
        `Successfully completed backfill for tenant ${this.tenantId}. Total processed: ${totalProcessed}`
      )
    } catch (error) {
      logger.error(`Error during backfill for tenant ${this.tenantId}:`, error)
      throw error
    }
  }

  private async prepareDynamoRequests(
    searchHistories: SanctionsSearchHistory[]
  ): Promise<BatchWriteRequestInternal[]> {
    const requests: BatchWriteRequestInternal[] = []
    const uniqueKeys = new Set<string>()

    for (const searchHistory of searchHistories) {
      if (!searchHistory.response?.searchId) {
        logger.warn(
          'Skipping search history record without response or searchId'
        )
        continue
      }

      // Generate dynamoHash using the same logic as in sanctions/index.ts
      const dynamoHash = generateChecksum(
        getSortedObject(searchHistory.request)
      )
      if (uniqueKeys.has(dynamoHash)) {
        logger.warn(`Skipping duplicate key: ${dynamoHash}`)
        continue
      }
      uniqueKeys.add(dynamoHash)

      const dynamoItem = this.createDynamoItem(dynamoHash, searchHistory)

      if (dynamoItem) {
        requests.push({
          PutRequest: {
            Item: dynamoItem,
          },
        })
      }
    }

    return requests
  }

  private createDynamoItem(
    dynamoHash: string,
    searchHistory: SanctionsSearchHistory
  ): any | null {
    const key = DynamoDbKeys.SANCTION_SEARCHES(this.tenantId, dynamoHash)
    const response = searchHistory.response
    const searchId = response?.searchId

    const santizedResponse = pick(
      response,
      SanctionsSearchResponse.getAttributeTypeMap().map((attr) => attr.name)
    )

    if (santizedResponse && searchId) {
      const simplifiedResponse = {
        ...santizedResponse,
        data: santizedResponse.data?.map((entity) => ({
          entityId: entity.id,
          entityType: entity.entityType,
        })),
      }

      return {
        ...key,
        ...searchHistory,
        searchId,
        response: simplifiedResponse,
      }
    }

    return null
  }

  private async markBackfillComplete(): Promise<void> {
    const key = DynamoDbKeys.SANCTIONS_SEARCH_BATCH_JOB_STATUS(this.tenantId)
    const command = new PutCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...key,
        isBackfillDone: true,
        completedAt: Date.now(),
      },
    })
    await this.dynamoDb.send(command)
  }
}
