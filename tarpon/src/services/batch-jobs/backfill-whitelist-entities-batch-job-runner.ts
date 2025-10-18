import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import omit from 'lodash/omit'
import { DynamoDbKeys } from '../../core/dynamodb/dynamodb-keys'
import { StackConstants } from '../../../lib/constants'
import { BatchJobRunner } from './batch-job-runner-base'
import { generateChecksum, getSortedObject } from '@/utils/object'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { SANCTIONS_WHITELIST_ENTITIES_COLLECTION } from '@/utils/mongo-table-names'
import { processCursorInBatch, getMongoDbClient } from '@/utils/mongodb-utils'
import {
  batchWrite,
  BatchWriteRequestInternal,
  getDynamoDbClient,
} from '@/utils/dynamodb'
import { BatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'

const USER_ENTITY_FILTER_FIELDS = [
  'userId',
  'entityType',
  'searchTerm',
  'entity',
] as const

const OTHER_ENTITY_FILTER_FIELDS = [
  'userId',
  'entityType',
  'searchTerm',
  'entity',
  'paymentMethodId',
] as const

export class BackfillWhitelistEntitiesBatchJobRunner extends BatchJobRunner {
  private dynamoDb!: DynamoDBDocumentClient
  private mongoClient!: MongoClient
  private tenantId!: string

  protected async run(job: BatchJob): Promise<void> {
    this.dynamoDb = getDynamoDbClient()
    this.mongoClient = await getMongoDbClient()
    this.tenantId = job.tenantId
    try {
      const currentTime = Date.now()
      const db = this.mongoClient.db()
      const collection = db.collection<SanctionsWhitelistEntity>(
        SANCTIONS_WHITELIST_ENTITIES_COLLECTION(this.tenantId)
      )

      const cursor = collection.find({
        createdAt: { $lte: currentTime },
      })

      logger.info(`Starting whitelist backfill for tenant ${this.tenantId}`)

      let totalProcessed = 0
      await processCursorInBatch(
        cursor,
        async (batch: SanctionsWhitelistEntity[]) => {
          const dynamoRequests = await this.prepareDynamoRequests(batch)
          if (dynamoRequests.length > 0) {
            await batchWrite(
              this.dynamoDb,
              dynamoRequests,
              StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
            )
          }
          totalProcessed += batch.length
          logger.info(`Processed ${totalProcessed} whitelist records`)
        },
        {
          mongoBatchSize: 1000,
          processBatchSize: 1000,
          debug: true,
        }
      )

      await this.markBackfillComplete()
      logger.info(
        `Successfully completed whitelist backfill for tenant ${this.tenantId}. Total processed: ${totalProcessed}`
      )
    } catch (error) {
      logger.error(
        `Error during whitelist backfill for tenant ${this.tenantId}:`,
        error
      )
      throw error
    }
  }

  private async prepareDynamoRequests(
    entities: SanctionsWhitelistEntity[]
  ): Promise<BatchWriteRequestInternal[]> {
    const requests: BatchWriteRequestInternal[] = []

    // Group entities by their hash
    const groupedEntities = new Map<string, SanctionsWhitelistEntity[]>()

    for (const entity of entities) {
      if (!entity.provider || !entity.entity) {
        continue
      }

      // Determine filter fields based on entity type
      const filterFields =
        entity.entity === 'USER'
          ? USER_ENTITY_FILTER_FIELDS
          : OTHER_ENTITY_FILTER_FIELDS

      // Create filter object and make hash
      const filterObject = filterFields.reduce(
        (acc, key) => ({
          ...acc,
          [key]: entity[key],
        }),
        {}
      )
      const filterWithProvider = {
        ...filterObject,
        provider: entity.provider,
      }
      const dynamoHash = generateChecksum(getSortedObject(filterWithProvider))

      if (!groupedEntities.has(dynamoHash)) {
        groupedEntities.set(dynamoHash, [])
      }
      const group = groupedEntities.get(dynamoHash)
      if (group) {
        group.push(entity)
      }
    }

    // Create DynamoDB requests for each group
    for (const [dynamoHash, groupEntities] of groupedEntities) {
      const key = DynamoDbKeys.SANCTIONS_WHITELIST_ENTITIES(
        this.tenantId,
        dynamoHash
      )

      // Clean entities by removing _id fields and simplifying sanctionsEntity
      const cleanedEntities = groupEntities.map((entity) => ({
        ...omit(entity, '_id'),
        sanctionsEntity: {
          entityType: entity.sanctionsEntity.entityType,
          id: entity.sanctionsEntity.id,
          name: entity.sanctionsEntity.name,
        },
      }))

      requests.push({
        PutRequest: {
          Item: {
            ...key,
            items: cleanedEntities,
          },
        },
      })
    }

    return requests
  }

  private async markBackfillComplete(): Promise<void> {
    const key = DynamoDbKeys.SANCTIONS_WHITELIST_BATCH_JOB_STATUS(this.tenantId)
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
