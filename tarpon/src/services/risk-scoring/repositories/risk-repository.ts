import { FindCursor, MongoClient, WithId } from 'mongodb'
import { StackConstants } from '@lib/constants'
import { InternalServerError, NotFound } from 'http-errors'
import {
  BatchWriteCommand,
  DeleteCommand,
  DeleteCommandInput,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import isEmpty from 'lodash/isEmpty'
import memoize from 'lodash/memoize'
import omit from 'lodash/omit'
import {
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
  isNotArsChangeTxId,
} from '@flagright/lib/utils/risk'
import {
  hasFeature,
  tenantHasFeature,
  tenantSettings,
  updateTenantRiskClassificationValues,
} from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  batchGet,
  batchWrite,
  BatchWriteRequestInternal,
  DeleteRequestInternal,
  paginateQuery,
  upsertSaveDynamo,
} from '@/utils/dynamodb'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { logger } from '@/core/logger'
import {
  ARS_SCORES_COLLECTION,
  DRS_SCORES_COLLECTION,
  KRS_SCORES_COLLECTION,
  VERSION_HISTORY_COLLECTION,
} from '@/utils/mongo-table-names'
import { RiskClassificationConfig } from '@/@types/openapi-internal/RiskClassificationConfig'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { RiskScoreComponent } from '@/@types/openapi-internal/RiskScoreComponent'
import { traceable } from '@/core/xray'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { AverageArsScore } from '@/@types/openapi-internal/AverageArsScore'
import { AggregationRepository } from '@/services/logic-evaluator/engine/aggregation-repository'
import { RiskFactorScoreDetails } from '@/@types/openapi-internal/RiskFactorScoreDetails'
import { RuleInstanceStatus } from '@/@types/openapi-internal/RuleInstanceStatus'
import { getLogicAggVarsWithUpdatedVersion } from '@/utils/risk-rule-shared'
import { getMongoDbClient, paginateCursor } from '@/utils/mongodb-utils'
import { sendMessageToMongoConsumer } from '@/utils/clickhouse/utils'
import { getClickhouseCredentials } from '@/utils/clickhouse/client'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { getTriggerSource } from '@/utils/lambda'
import {
  createNonConsoleApiInMemoryCache,
  getInMemoryCacheKey,
} from '@/utils/memory-cache'
import { TrsScoresResponse } from '@/@types/openapi-internal/TrsScoresResponse'
import { handleSmallNumber } from '@/utils/helpers'
import { CounterRepository } from '@/services/counter/repository'
import { DrsValuesResponse } from '@/@types/openapi-internal/DrsValuesResponse'
import { DefaultApiGetDrsValuesRequest } from '@/@types/openapi-internal/RequestParameters'
import { RiskClassificationConfigApproval } from '@/@types/openapi-internal/RiskClassificationConfigApproval'
import { RiskFactorApproval } from '@/@types/openapi-internal/RiskFactorApproval'
import { updateInMongoWithVersionCheck } from '@/utils/downstream-version'
import { RiskFactorLogic } from '@/@types/openapi-internal/RiskFactorLogic'
import { VersionHistoryTable } from '@/models/version-history'
import { VersionHistory } from '@/@types/openapi-internal/VersionHistory'
import { LogicEntityVariableInUse } from '@/@types/openapi-internal/LogicEntityVariableInUse'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/constants/risk/classification'

type DailyStats = { [dayLabel: string]: { [dataType: string]: number } }

const riskClassificationValuesCache = createNonConsoleApiInMemoryCache<
  RiskClassificationScore[]
>({
  max: 100,
  ttlMinutes: 10,
})

const defaultRiskClassificationItem: RiskClassificationConfig = {
  classificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
  updatedAt: Date.now(),
  createdAt: Date.now(),
  id: '',
}

@traceable
export class RiskRepository {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  aggregationRepository: AggregationRepository
  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
    this.aggregationRepository = new AggregationRepository(
      tenantId,
      this.dynamoDb
    )
  }

  async getPreviousCraLevel(
    userId: string
  ): Promise<RiskLevel | null | undefined> {
    const drsScore = await this.getDrsScore(userId)
    const riskClassificationValues = await this.getRiskClassificationValues()
    const { riskLevelAlias } = await tenantSettings(this.tenantId)
    return drsScore?.prevDrsScore
      ? getRiskLevelFromScore(
          riskClassificationValues,
          drsScore.prevDrsScore,
          riskLevelAlias
        )
      : null
  }

  async getKrsScore(userId: string): Promise<KrsScore | null> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.KRS_VALUE_ITEM(this.tenantId, userId, '1'), // will need to query after we implement versioning
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))

    if (!result.Item) {
      return null
    }

    const krsScoreItem = {
      ...result.Item,
    }
    delete krsScoreItem.PartitionKeyID
    delete krsScoreItem.SortKeyID
    return krsScoreItem as KrsScore
  }

  async allArsScoresForUser(userId: string): Promise<FindCursor<ArsScore>> {
    const mongoDb = this.mongoDb.db()
    const arsScoresCollection = mongoDb.collection<ArsScore>(
      ARS_SCORES_COLLECTION(this.tenantId)
    )

    return arsScoresCollection
      .find({ $or: [{ originUserId: userId }, { destinationUserId: userId }] })
      .sort({ createdAt: 1 })
  }

  async createOrUpdateKrsScore(
    userId: string,
    score: number,
    components?: RiskScoreComponent[],
    factorScoreDetails?: RiskFactorScoreDetails[],
    lockKrs?: boolean
  ): Promise<KrsScore> {
    logger.debug(`Updating KRS score for user ${userId} to ${score}`)
    const newKrsScoreItem: KrsScore = {
      krsScore: handleSmallNumber(score),
      createdAt: Date.now(),
      userId: userId,
      components,
      factorScoreDetails,
      isLocked: lockKrs ?? false,
    }
    const primaryKey = DynamoDbKeys.KRS_VALUE_ITEM(this.tenantId, userId, '1')

    await upsertSaveDynamo(
      this.dynamoDb,
      {
        entity: { ...newKrsScoreItem },
        key: primaryKey,
        tableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      },
      { versioned: true }
    )

    if (process.env.NODE_ENV === 'development') {
      const { handleLocalHammerheadChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )

      await handleLocalHammerheadChangeCapture(this.tenantId, primaryKey)
    }

    logger.debug(`Updated KRS score for user ${userId} to ${score}`)
    return newKrsScoreItem
  }

  async createOrUpdateArsScore(
    transactionId: string,
    score: number,
    originUserId?: string,
    destinationUserId?: string,
    components?: RiskScoreComponent[],
    factorScoreDetails?: RiskFactorScoreDetails[]
  ): Promise<ArsScore> {
    logger.debug(
      `Updating ARS score for transaction ${transactionId} to ${score}`
    )
    const newArsScoreItem: ArsScore = {
      arsScore: handleSmallNumber(score),
      createdAt: Date.now(),
      originUserId,
      destinationUserId,
      transactionId,
      components,
      factorScoreDetails,
    }

    const primaryKey = DynamoDbKeys.ARS_VALUE_ITEM(
      this.tenantId,
      transactionId,
      '1'
    )

    await upsertSaveDynamo(
      this.dynamoDb,
      {
        entity: { ...newArsScoreItem },
        key: primaryKey,
        tableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      },
      { versioned: true }
    )

    if (process.env.NODE_ENV === 'development') {
      const { handleLocalHammerheadChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )

      await handleLocalHammerheadChangeCapture(this.tenantId, primaryKey)
    }
    logger.debug(
      `Updated ARS score for transaction ${transactionId} to ${score}`
    )
    return newArsScoreItem
  }

  async getArsScore(transactionId: string): Promise<ArsScore | null> {
    try {
      const getItemInput: GetCommandInput = {
        TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: DynamoDbKeys.ARS_VALUE_ITEM(this.tenantId, transactionId, '1'),
      }
      const result = await this.dynamoDb.send(new GetCommand(getItemInput))

      if (!result.Item) {
        return null
      }

      return result.Item as ArsScore
    } catch (error) {
      logger.error('Error getting ars score', error)
      return null
    }
  }

  async getArsScores(transactionIds: string[]): Promise<ArsScore[]> {
    return await batchGet<ArsScore>(
      this.dynamoDb,
      StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      transactionIds.map((transactionId) =>
        DynamoDbKeys.ARS_VALUE_ITEM(this.tenantId, transactionId, '1')
      )
    )
  }

  async getDrsScore(userId: string): Promise<DrsScore | null> {
    try {
      const getItemInput: GetCommandInput = {
        TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: DynamoDbKeys.DRS_VALUE_ITEM(this.tenantId, userId, '1'), // will need to query after we implement versioning
      }
      const result = await this.dynamoDb.send(new GetCommand(getItemInput))

      if (!result.Item) {
        return null
      }

      return result.Item as DrsScore
    } catch (error) {
      logger.error('Error getting drs score', error)
      return null
    }
  }

  async createOrUpdateDrsScore(
    userId: string,
    drsScore: number,
    transactionId: string,
    components: RiskScoreComponent[],
    isUpdatable?: boolean,
    factorScoreDetails?: RiskFactorScoreDetails[]
  ): Promise<DrsScore> {
    logger.debug(
      `Updating DRS score for user ${userId} to ${drsScore} with transaction ${transactionId}`
    )
    const prevDrsScore = await this.getDrsScore(userId)

    const newDrsScoreItem: DrsScore = {
      drsScore: handleSmallNumber(drsScore),
      transactionId,
      createdAt: Date.now(),
      isUpdatable: isUpdatable ?? true,
      userId: userId,
      components,
      factorScoreDetails,
      triggeredBy: getTriggerSource(),
      prevDrsScore: prevDrsScore?.drsScore,
    }
    const primaryKey = DynamoDbKeys.DRS_VALUE_ITEM(this.tenantId, userId, '1')

    await upsertSaveDynamo(
      this.dynamoDb,
      {
        entity: { ...newDrsScoreItem },
        key: primaryKey,
        tableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
        propertiesToUnset: ['manualRiskLevel'],
      },
      { versioned: true }
    )

    if (process.env.NODE_ENV === 'development') {
      const { handleLocalHammerheadChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )

      await handleLocalHammerheadChangeCapture(this.tenantId, primaryKey)
    }

    logger.debug(
      `Updated DRS score for user ${userId} to ${drsScore} with transaction ${transactionId}`
    )
    return newDrsScoreItem
  }

  async updateRiskAssignmentLock(
    userId: string,
    isUpdatable: boolean,
    releaseAt?: number
  ): Promise<DrsScore> {
    logger.debug(
      `Updating risk assignment lock for user ${userId} to ${isUpdatable}`
    )

    const primaryKey = DynamoDbKeys.DRS_VALUE_ITEM(this.tenantId, userId, '1')

    const now = Date.now()

    // Check if CRA lock timer feature is enabled
    const hasCraLockTimerFeature = await tenantHasFeature(
      this.tenantId,
      'CRA_LOCK_TIMER'
    )

    // If feature is disabled, we still allow manual lock/unlock but without expiration
    if (!isUpdatable && releaseAt && !hasCraLockTimerFeature) {
      logger.info(
        `CRA lock timer feature not enabled for tenant ${this.tenantId}, ignoring releaseAt`
      )
      releaseAt = undefined
    }

    const lockExpiresAt =
      !isUpdatable && releaseAt && hasCraLockTimerFeature
        ? releaseAt
        : undefined

    // remove lock item(s) from inverse index if unlocking
    if (isUpdatable) {
      // Unlocking: Delete inverse index item first, then update main item
      // With new key structure: PK = ${tenantId}#drs-lock, SK = ${userId}#${releaseAt}
      // Very efficient query using begins_with on sort key
      const queryInput = {
        TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
        KeyConditionExpression:
          'PartitionKeyID = :pk AND begins_with(SortKeyID, :userPrefix)',
        ExpressionAttributeValues: {
          ':pk': `${this.tenantId}#drs-lock`,
          ':userPrefix': `${userId}#`,
        },
        ProjectionExpression: 'PartitionKeyID, SortKeyID',
      }

      const queryResult = await this.dynamoDb.send(new QueryCommand(queryInput))

      if (queryResult.Items && queryResult.Items.length > 0) {
        // Delete all lock items for this user (there should typically be only one)
        const deletePromises = queryResult.Items.map((item) =>
          this.dynamoDb.send(
            new DeleteCommand({
              TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(
                this.tenantId
              ),
              Key: {
                PartitionKeyID: item.PartitionKeyID,
                SortKeyID: item.SortKeyID,
              },
            })
          )
        )
        await Promise.all(deletePromises)
      }
      // add lock item to inverse index if locking
    } else {
      // Locking: Create inverse index item for efficient querying only if feature is enabled and expiration is set
      if (lockExpiresAt && hasCraLockTimerFeature) {
        const lockItemKey = DynamoDbKeys.DRS_LOCK_ITEM(
          this.tenantId,
          userId,
          lockExpiresAt.toString()
        )

        const lockItem = {
          ...lockItemKey,
          tenantId: this.tenantId,
          lockExpiresAt,
          createdAt: now,
        }

        await this.dynamoDb.send(
          new PutCommand({
            TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(
              this.tenantId
            ),
            Item: lockItem,
          })
        )
      }
    }

    // update main DRS item
    const updateInput: UpdateCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: primaryKey,
      UpdateExpression: isUpdatable
        ? 'SET isUpdatable = :isUpdatable, updatedAt = :updatedAt REMOVE lockedAt, lockExpiresAt'
        : lockExpiresAt
        ? 'SET isUpdatable = :isUpdatable, updatedAt = :updatedAt, lockedAt = :lockedAt, lockExpiresAt = :lockExpiresAt'
        : 'SET isUpdatable = :isUpdatable, updatedAt = :updatedAt, lockedAt = :lockedAt REMOVE lockExpiresAt',
      ExpressionAttributeValues: {
        ':isUpdatable': isUpdatable,
        ':updatedAt': now,
        ...(isUpdatable
          ? {}
          : {
              ':lockedAt': now,
              ...(lockExpiresAt ? { ':lockExpiresAt': lockExpiresAt } : {}),
            }),
      },
      ReturnValues: 'ALL_NEW',
    }

    const result = await this.dynamoDb.send(new UpdateCommand(updateInput))

    if (!result.Attributes) {
      throw new Error(
        `Failed to update risk assignment lock for user ${userId}`
      )
    }

    const updatedDrsScore = result.Attributes as DrsScore

    if (process.env.NODE_ENV === 'development') {
      const { handleLocalHammerheadChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )

      await handleLocalHammerheadChangeCapture(this.tenantId, primaryKey)
    }

    logger.debug(
      `Updated risk assignment lock for user ${userId} to ${isUpdatable}`
    )

    return updatedDrsScore
  }

  async unlockExpiredCraLocks(): Promise<string[]> {
    logger.debug(`Checking for expired CRA locks`)

    const now = Date.now()

    // With new sort key structure: SK = ${userId}#${releaseAt}
    // Query all CRA lock items for a tenant and filter by releaseAt in application code
    // NOTE: there is no other way to do this with DynamoDB:
    //       either you can query efficiently by user with userId#releaseAt sort key
    //       or you can query efficiently by releaseAt with releaseAt#userId sort key
    //       but you cannot do both efficiently at the same time
    //       so we chose the first option to ensure manual unlocks from console are fast
    const queryInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.tenantId}#drs-lock`,
      },
      ProjectionExpression: 'PartitionKeyID, SortKeyID',
    }

    const queryResult = await this.dynamoDb.send(new QueryCommand(queryInput))

    if (!queryResult.Items || queryResult.Items.length === 0) {
      logger.debug('No expired CRA locks found')
      return []
    }

    // Parse and filter for expired locks from sort keys: ${userId}#${releaseAt}
    const expiredLockItems = queryResult.Items.map((item) => {
      const sortKey = item.SortKeyID as string
      const parts = sortKey.split('#')
      if (parts.length < 2) {
        return null
      }

      const userId = parts[0]
      const releaseAt = parseInt(parts[1], 10)

      // Only include if releaseAt is expired
      if (isNaN(releaseAt) || releaseAt >= now) {
        return null
      }

      return {
        PartitionKeyID: item.PartitionKeyID,
        SortKeyID: item.SortKeyID,
        userId,
      }
    }).filter((item): item is NonNullable<typeof item> => item !== null)

    if (expiredLockItems.length === 0) {
      logger.debug('No valid expired CRA locks found after parsing')
      return []
    }

    logger.info(`Found ${expiredLockItems.length} expired CRA locks to unlock`)

    const BATCH_SIZE = 25 // DynamoDB batch limit
    const unlockedUserIds: string[] = []

    // Process in batches of 25
    for (let i = 0; i < expiredLockItems.length; i += BATCH_SIZE) {
      const batchItems = expiredLockItems.slice(i, i + BATCH_SIZE)

      // Step 1: Update DRS items using individual UpdateCommands (with proper SET operations)
      const drsUpdatePromises = batchItems.map(async (lockItem) => {
        try {
          await this.dynamoDb.send(
            new UpdateCommand({
              TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(
                this.tenantId
              ),
              Key: DynamoDbKeys.DRS_VALUE_ITEM(
                this.tenantId,
                lockItem.userId,
                '1'
              ),
              UpdateExpression:
                'SET isUpdatable = :isUpdatable, updatedAt = :updatedAt REMOVE lockedAt, lockExpiresAt',
              ConditionExpression: 'attribute_exists(lockedAt)', // Safety check
              ExpressionAttributeValues: {
                ':isUpdatable': true,
                ':updatedAt': now,
              },
            })
          )
          return lockItem // Return the lock item for cleanup
        } catch (error: any) {
          if (error.name === 'ConditionalCheckFailedException') {
            logger.debug(
              `Item ${lockItem.userId} was already unlocked, skipping`
            )
          } else {
            logger.error(
              `Failed to unlock CRA for user ${lockItem.userId}:`,
              error
            )
          }
          return null
        }
      })

      // Execute all updates in this batch concurrently
      const updateResults = await Promise.allSettled(drsUpdatePromises)
      const successfulUpdates = updateResults
        .filter(
          (result) => result.status === 'fulfilled' && result.value !== null
        )
        .map((result) => (result as PromiseFulfilledResult<any>).value)

      logger.debug(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1}: Updated ${
          successfulUpdates.length
        }/${batchItems.length} DRS items`
      )

      // Step 2: For successful DRS updates, batch delete the lock tracking items
      if (successfulUpdates.length > 0) {
        const lockDeleteRequests = successfulUpdates.map((lockItem) => ({
          DeleteRequest: {
            Key: {
              PartitionKeyID: lockItem.PartitionKeyID,
              SortKeyID: lockItem.SortKeyID,
            },
          },
        }))

        try {
          await this.dynamoDb.send(
            new BatchWriteCommand({
              RequestItems: {
                [StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId)]:
                  lockDeleteRequests,
              },
            })
          )

          logger.debug(
            `Batch ${Math.floor(i / BATCH_SIZE) + 1}: Deleted ${
              successfulUpdates.length
            } lock tracking items`
          )
        } catch (error) {
          logger.error(
            `Failed to delete lock tracking items for batch ${
              Math.floor(i / BATCH_SIZE) + 1
            }:`,
            error
          )
          // Continue - DRS items are already unlocked, lock items can be cleaned up later
        }

        // Add successful userIds to result
        successfulUpdates.forEach((lockItem) =>
          unlockedUserIds.push(lockItem.userId)
        )
      }
    }

    logger.info(
      `Automatically unlocked ${unlockedUserIds.length} expired CRA locks`
    )
    return unlockedUserIds
  }

  async getRiskClassificationValues(): Promise<Array<RiskClassificationScore>> {
    const contextRiskClassificationValues =
      getContext()?.riskClassificationValues

    if (
      contextRiskClassificationValues &&
      !isEmpty(contextRiskClassificationValues)
    ) {
      return contextRiskClassificationValues
    }

    const cacheKey = getInMemoryCacheKey(
      this.tenantId,
      'risk-classification-values'
    )

    if (riskClassificationValuesCache?.has(cacheKey)) {
      return riskClassificationValuesCache.get(
        cacheKey
      ) as RiskClassificationScore[]
    }

    const queryInput: QueryCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',

      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.RISK_CLASSIFICATION(this.tenantId).PartitionKeyID,
      },
    }
    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)

      const riskClassificationValues =
        result.Items && result.Items.length > 0
          ? result.Items[0].classificationValues
          : DEFAULT_CLASSIFICATION_SETTINGS

      updateTenantRiskClassificationValues(riskClassificationValues)

      if (riskClassificationValuesCache) {
        riskClassificationValuesCache.set(cacheKey, riskClassificationValues)
      }

      return riskClassificationValues
    } catch (e) {
      logger.error(e)
      return DEFAULT_CLASSIFICATION_SETTINGS
    }
  }

  async getRiskClassificationItem(): Promise<RiskClassificationConfig> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.RISK_CLASSIFICATION(this.tenantId, 'LATEST'),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))

    return (result.Item ??
      defaultRiskClassificationItem) as RiskClassificationConfig
  }

  async createOrUpdateRiskClassificationConfig(
    id: string,
    riskClassificationValues: RiskClassificationScore[]
  ): Promise<RiskClassificationConfig> {
    logger.debug(`Updating risk classification config.`)
    const now = Date.now()
    const riskClassificationConfig: RiskClassificationConfig = {
      classificationValues: riskClassificationValues,
      updatedAt: now,
      createdAt: now,
      id,
    }
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...DynamoDbKeys.RISK_CLASSIFICATION(this.tenantId, 'LATEST'), // Version it later
        ...riskClassificationConfig,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))

    logger.debug(`Updated risk classification config.`)

    updateTenantRiskClassificationValues(riskClassificationValues)

    return riskClassificationConfig
  }

  async getDRSRiskItem(userId: string): Promise<DrsScore | null> {
    const drsScore = await this.getDrsScore(userId)
    if (!drsScore) {
      return null
    }

    const riskClassificationValues = await this.getRiskClassificationValues()
    const derivedRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      drsScore.drsScore
    )
    const result = {
      ...drsScore,
      derivedRiskLevel,
    }
    return result
  }

  async createOrUpdateManualKrsRiskItem(
    userId: string,
    riskLevel: RiskLevel,
    isLocked?: boolean
  ) {
    const primaryKey = DynamoDbKeys.KRS_VALUE_ITEM(this.tenantId, userId, '1')
    const riskClassificationValues = await this.getRiskClassificationValues()
    const newKrsScoreItem: KrsScore = {
      krsScore: getRiskScoreFromLevel(riskClassificationValues, riskLevel),
      createdAt: Date.now(),
      userId,
      isLocked: isLocked ?? false,
      manualRiskLevel: riskLevel,
    }
    await upsertSaveDynamo(
      this.dynamoDb,
      {
        entity: { ...newKrsScoreItem },
        key: primaryKey,
        tableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      },
      { versioned: true }
    )
    if (process.env.NODE_ENV === 'development') {
      const { handleLocalHammerheadChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )

      await handleLocalHammerheadChangeCapture(this.tenantId, primaryKey)
    }
    logger.info(`Manual risk level updated for user ${userId} to ${riskLevel}`)
    return newKrsScoreItem
  }

  async createOrUpdateManualDRSRiskItem(
    userId: string,
    riskLevel: RiskLevel,
    isUpdatable?: boolean,
    releaseAt?: number
  ) {
    logger.debug(
      `Updating manual risk level for user ${userId} to ${riskLevel}`
    )
    const now = Date.now()
    const [riskClassificationValues, previousDrsScore] = await Promise.all([
      this.getRiskClassificationValues(),
      this.getDrsScore(userId),
    ])

    // Check if CRA lock timer feature is enabled
    const hasCraLockTimerFeature = await tenantHasFeature(
      this.tenantId,
      'CRA_LOCK_TIMER'
    )

    // If feature is disabled, ignore releaseAt timestamp
    if (isUpdatable === false && releaseAt && !hasCraLockTimerFeature) {
      logger.info(
        `CRA lock timer feature not enabled for tenant ${this.tenantId}, ignoring releaseAt`
      )
      releaseAt = undefined
    }

    // Use releaseAt timestamp directly for lock expiration
    const lockExpiresAt =
      isUpdatable === false && releaseAt && hasCraLockTimerFeature
        ? releaseAt
        : undefined

    const lockExpirationFields =
      isUpdatable === false && lockExpiresAt
        ? {
            lockedAt: now,
            lockExpiresAt,
          }
        : {}

    const newDrsRiskValue: DrsScore = {
      manualRiskLevel: riskLevel,
      createdAt: now,
      isUpdatable: isUpdatable ?? true,
      drsScore: getRiskScoreFromLevel(riskClassificationValues, riskLevel),
      userId,
      transactionId: 'MANUAL_UPDATE',
      triggeredBy: getTriggerSource(),
      prevDrsScore: previousDrsScore?.drsScore,
      ...lockExpirationFields,
    }

    const primaryKey = DynamoDbKeys.DRS_VALUE_ITEM(this.tenantId, userId, '1')

    await upsertSaveDynamo(
      this.dynamoDb,
      {
        entity: { ...newDrsRiskValue },
        key: primaryKey,
        tableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      },
      { versioned: true }
    )

    // Create inverse index lock item if locking with expiration
    if (isUpdatable === false && lockExpiresAt) {
      const lockItemKey = DynamoDbKeys.DRS_LOCK_ITEM(
        this.tenantId,
        userId,
        lockExpiresAt.toString()
      )
      const lockItem = {
        ...lockItemKey,
        tenantId: this.tenantId,
        lockExpiresAt,
        createdAt: now,
      }
      await this.dynamoDb.send(
        new PutCommand({
          TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(
            this.tenantId
          ),
          Item: lockItem,
        })
      )
    }

    if (process.env.NODE_ENV === 'development') {
      const { handleLocalHammerheadChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )

      await handleLocalHammerheadChangeCapture(this.tenantId, primaryKey)
    }

    logger.debug(
      `Manual risk level updated for user ${userId} to ${riskLevel}${
        lockExpiresAt
          ? ` with lock expiring at ${new Date(lockExpiresAt).toISOString()}`
          : ''
      }`
    )

    return newDrsRiskValue
  }

  public async augmentRiskLevel<T extends { arsScore?: ArsScore }>(
    items: Array<T>
  ): Promise<T[]> {
    const riskClassificationValues = await this.getRiskClassificationValues()
    const { riskLevelAlias } = await tenantSettings(this.tenantId)
    return items.map((item) => ({
      ...item,
      arsScore: item.arsScore && {
        ...item.arsScore,
        riskLevel: getRiskLevelFromScore(
          riskClassificationValues,
          item.arsScore.arsScore,
          riskLevelAlias
        ),
      },
    }))
  }

  async getAverageArsScoreDynamo(userId: string) {
    const getInput: GetCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.AVG_ARS_VALUE_ITEM(this.tenantId, userId, '1'),
    }
    const result = await this.dynamoDb.send(new GetCommand(getInput))
    if (!result.Item) {
      logger.warn(`Average ars score null for user: ${userId}`)
      return null
    }

    return omit(result.Item, ['PartitionKeyID', 'SortKeyID']) as AverageArsScore
  }

  async getAverageArsScore(userId: string): Promise<AverageArsScore | null> {
    // Todo: Remove this after Algorithm switch is GA and we've backfilled Average Ars score to dynamo.
    if (hasFeature('PNB')) {
      return await this.getAverageArsScoreDynamo(userId)
    }
    const db = this.mongoDb.db()
    const arsScoresCollectionName = ARS_SCORES_COLLECTION(this.tenantId)
    const arsScoresCollection = db.collection<ArsScore>(arsScoresCollectionName)

    const data = await arsScoresCollection
      .aggregate<TrsScoresResponse>([
        {
          $match: {
            $or: [{ originUserId: userId }, { destinationUserId: userId }],
          },
        },
        {
          $group: {
            _id: null,
            average: { $avg: '$arsScore' },
          },
        },
      ])
      .next()

    return {
      userId,
      value: data?.average ?? 0,
      transactionCount: 0, // unused
      createdAt: Date.now(),
    }
  }

  async updateOrCreateAverageArsScore(
    userId: string,
    averageArsScore: AverageArsScore
  ): Promise<AverageArsScore> {
    logger.debug(`Updating average ARS score for user ${userId}`)
    const primaryKey = DynamoDbKeys.AVG_ARS_VALUE_ITEM(
      this.tenantId,
      userId,
      '1'
    )
    await upsertSaveDynamo(
      this.dynamoDb,
      {
        entity: { ...averageArsScore },
        tableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
        key: primaryKey,
      },
      { versioned: true }
    )
    if (process.env.NODE_ENV === 'development') {
      const { handleLocalHammerheadChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )

      await handleLocalHammerheadChangeCapture(this.tenantId, primaryKey)
    }

    return averageArsScore
  }

  async getAvgArsReadyMarker(): Promise<boolean> {
    const getInput: GetCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.AVG_ARS_READY_MARKER(this.tenantId),
    }
    const result = await this.dynamoDb.send(new GetCommand(getInput))
    return result.Item?.isReady ?? false
  }

  async setAvgArsReadyMarker(isReady: boolean): Promise<void> {
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...DynamoDbKeys.AVG_ARS_READY_MARKER(this.tenantId),
        isReady: isReady,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
  }

  // Fetches the RiskClassificationConfigApproval object from DynamoDB for the given version (or 'LATEST' if not provided).
  async getPendingRiskClassificationConfig(
    version: string = 'LATEST'
  ): Promise<RiskClassificationConfigApproval | null> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.RISK_CLASSIFICATION_APPROVAL(this.tenantId, version),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return result.Item
      ? (result.Item as RiskClassificationConfigApproval)
      : null
  }

  // Sets (creates or updates) the RiskClassificationConfigApproval object in DynamoDB for the given version (or 'LATEST' if not provided).
  async setPendingRiskClassificationConfig(
    approval: RiskClassificationConfigApproval,
    version: string = 'LATEST'
  ): Promise<RiskClassificationConfigApproval> {
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...DynamoDbKeys.RISK_CLASSIFICATION_APPROVAL(this.tenantId, version),
        ...approval,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
    return approval
  }

  // Deletes the RiskClassificationConfigApproval object from DynamoDB for the given version (or 'LATEST' if not provided).
  async deletePendingRiskClassificationConfig(
    version: string = 'LATEST'
  ): Promise<void> {
    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.RISK_CLASSIFICATION_APPROVAL(this.tenantId, version),
    }
    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
  }

  // Risk Factors Approval methods
  async getPendingRiskFactor(
    riskFactorId: string
  ): Promise<RiskFactorApproval | null> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.RISK_FACTORS_APPROVAL(this.tenantId, riskFactorId),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return result.Item ? (result.Item as RiskFactorApproval) : null
  }

  async getPendingRiskFactors(): Promise<RiskFactorApproval[]> {
    const queryInput: QueryCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.RISK_FACTORS_APPROVAL(this.tenantId).PartitionKeyID,
      },
    }
    const result = await this.dynamoDb.send(new QueryCommand(queryInput))

    // Log partition/sort keys and risk factor id for each item
    logger.info(
      'Found partition and sort keys:',
      result.Items?.map((item) => ({
        PartitionKeyID: item.PartitionKeyID,
        SortKeyID: item.SortKeyID,
        riskFactorId: item.riskFactor?.id,
      }))
    )

    return result.Items
      ? (result.Items.map((item) =>
          omit(item, ['PartitionKeyID', 'SortKeyID'])
        ) as RiskFactorApproval[])
      : []
  }

  // Sets (creates or updates) the RiskFactorApproval object in DynamoDB for the given riskFactorId (or 'LATEST' if not provided).
  async setPendingRiskFactorsConfig(
    riskFactorId: string,
    approval: RiskFactorApproval
  ): Promise<RiskFactorApproval> {
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...DynamoDbKeys.RISK_FACTORS_APPROVAL(this.tenantId, riskFactorId),
        ...approval,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
    return approval
  }

  // Deletes the RiskFactorConfigApproval object from DynamoDB for the given riskFactorId (or 'LATEST' if not provided).
  async deletePendingRiskFactorConfig(riskFactorId: string): Promise<void> {
    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.RISK_FACTORS_APPROVAL(this.tenantId, riskFactorId),
    }
    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
  }

  /**
   * Bulk updates all pending risk level approvals to use a new workflow reference and reset approval step to 0
   * This is used when a workflow is updated to restart all pending approval flows
   */
  async bulkUpdateRiskLevelApprovalsWorkflow(newWorkflowRef: {
    id: string
    version: number
  }): Promise<number> {
    // Use a single UpdateItem operation with a condition to update existing items only
    // where workflowRef doesn't match the new workflow reference
    const updateInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: {
        PartitionKeyID: DynamoDbKeys.RISK_CLASSIFICATION_APPROVAL(this.tenantId)
          .PartitionKeyID,
        SortKeyID: 'LATEST', // Update the LATEST version
      },
      UpdateExpression:
        'SET workflowRef = :newWorkflowRef, approvalStep = :newApprovalStep',
      ConditionExpression:
        'attribute_exists(PartitionKeyID) AND (attribute_not_exists(workflowRef) OR workflowRef.id <> :newWorkflowId OR workflowRef.version <> :newWorkflowVersion)',
      ExpressionAttributeValues: {
        ':newWorkflowRef': newWorkflowRef,
        ':newApprovalStep': 0,
        ':newWorkflowId': newWorkflowRef.id,
        ':newWorkflowVersion': newWorkflowRef.version,
      },
      ReturnValues: 'ALL_NEW' as const,
    }

    try {
      await this.dynamoDb.send(new UpdateCommand(updateInput))
      return 1 // Updated one item
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        // No items matched the condition, nothing to update
        return 0
      }
      throw error
    }
  }

  /**
   * Bulk updates all pending risk factor approvals to use a new workflow reference and reset approval step to 0
   * This is used when a workflow is updated to restart all pending approval flows
   */
  async bulkUpdateRiskFactorApprovalsWorkflow(newWorkflowRef: {
    id: string
    version: number
  }): Promise<number> {
    // First, query to find all risk factor approvals that need updating
    const queryInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression:
        'attribute_not_exists(workflowRef) OR workflowRef.id <> :newWorkflowId OR workflowRef.version <> :newWorkflowVersion',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.RISK_FACTORS_APPROVAL(this.tenantId).PartitionKeyID,
        ':newWorkflowId': newWorkflowRef.id,
        ':newWorkflowVersion': newWorkflowRef.version,
      },
    }

    const result = await this.dynamoDb.send(new QueryCommand(queryInput))

    console.log(`Risk factors approval query result:`, {
      partitionKey: DynamoDbKeys.RISK_FACTORS_APPROVAL(this.tenantId)
        .PartitionKeyID,
      totalItems: result.Items?.length || 0,
      items: result.Items?.map((item) => ({
        SortKeyID: item.SortKeyID,
        workflowRef: item.workflowRef,
        approvalStep: item.approvalStep,
      })),
    })

    if (!result.Items?.length) {
      return 0
    }

    // Use BatchWriteItem for bulk update (DynamoDB allows up to 25 items per batch)
    const batchSize = 25
    let updatedCount = 0

    for (let i = 0; i < result.Items.length; i += batchSize) {
      const batch = result.Items.slice(i, i + batchSize)

      const batchWriteInput = {
        RequestItems: {
          [StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId)]:
            batch.map((item) => ({
              PutRequest: {
                Item: {
                  ...item,
                  workflowRef: newWorkflowRef,
                  approvalStep: 0,
                },
              },
            })),
        },
      }

      await this.dynamoDb.send(new BatchWriteCommand(batchWriteInput))
      updatedCount += batch.length
    }

    return updatedCount
  }

  /* MongoDB operations */

  async addKrsValueToMongo(krsScore: KrsScore): Promise<KrsScore> {
    const result = await updateInMongoWithVersionCheck<KrsScore>(
      this.mongoDb,
      KRS_SCORES_COLLECTION(this.tenantId),
      { userId: krsScore.userId },
      krsScore,
      true
    )
    const updatedScore = omit(result.value, '_id')
    return updatedScore
  }

  async getKrsValueFromMongo(userId: string): Promise<KrsScore | null> {
    const db = this.mongoDb.db()
    const krsValuesCollection = db.collection<KrsScore>(
      KRS_SCORES_COLLECTION(this.tenantId)
    )
    const krsValue: WithId<KrsScore> | null = await krsValuesCollection.findOne(
      { userId }
    )
    const riskClassificationValues = await this.getRiskClassificationValues()
    const { riskLevelAlias } = await tenantSettings(this.tenantId)
    return krsValue
      ? {
          ...krsValue,
          riskLevel: getRiskLevelFromScore(
            riskClassificationValues,
            krsValue.krsScore,
            riskLevelAlias
          ),
        }
      : null
  }

  async addArsValueToMongo(arsScore: ArsScore): Promise<ArsScore> {
    const result = await updateInMongoWithVersionCheck<ArsScore>(
      this.mongoDb,
      ARS_SCORES_COLLECTION(this.tenantId),
      { transactionId: arsScore.transactionId },
      arsScore,
      true
    )
    const updatedScore = omit(result.value, '_id')
    return updatedScore
  }

  async getArsValueFromMongo(transactionId: string): Promise<ArsScore | null> {
    const db = this.mongoDb.db()
    const arsValuesCollection = db.collection<ArsScore>(
      ARS_SCORES_COLLECTION(this.tenantId)
    )
    return await arsValuesCollection.findOne({ transactionId })
  }

  async addDrsValueToMongo(drsScore: DrsScore): Promise<DrsScore> {
    const db = this.mongoDb.db()
    const collectionName = DRS_SCORES_COLLECTION(this.tenantId)
    const drsValuesCollection = db.collection<DrsScore>(collectionName)
    const data = await drsValuesCollection.insertOne(drsScore)

    await sendMessageToMongoConsumer({
      clusterTime: Date.now(),
      collectionName,
      documentKey: { type: 'id', value: data.insertedId.toString() },
      operationType: 'insert',
    })

    return drsScore
  }

  async createOrUpdateDemoRiskFactor(riskFactor: RiskFactor) {
    logger.debug(`Updating risk factor for V8.`)

    const now = Date.now()
    const oldRiskFactor = await this.getRiskFactor(riskFactor.id)
    const newRiskFactor: RiskFactor = {
      ...riskFactor,
      logicAggregationVariables:
        (await getLogicAggVarsWithUpdatedVersion(
          riskFactor,
          riskFactor.id,
          oldRiskFactor,
          this.aggregationRepository
        )) ?? [],
      updatedAt: now,
      createdAt: oldRiskFactor?.createdAt ?? now,
    }
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...newRiskFactor,
        ...DynamoDbKeys.RISK_FACTOR(this.tenantId, riskFactor.id),
      },
    }
    return putItemInput
  }

  private async getNewRiskFactor(riskFactor: RiskFactor) {
    const now = Date.now()
    const oldRiskFactor = await this.getRiskFactor(riskFactor.id)
    const newRiskFactor: RiskFactor = {
      ...riskFactor,
      logicAggregationVariables:
        (await getLogicAggVarsWithUpdatedVersion(
          riskFactor,
          riskFactor.id,
          oldRiskFactor,
          this.aggregationRepository
        )) ?? [],
      updatedAt: now,
      createdAt: oldRiskFactor?.createdAt ?? now,
    }
    return newRiskFactor
  }

  async createDemoRiskFactor(riskFactors: RiskFactor[]) {
    const newRiskFactors = await Promise.all(
      riskFactors.map((riskFactor) => this.getNewRiskFactor(riskFactor))
    )

    const writeRequests: BatchWriteRequestInternal[] = newRiskFactors.map(
      (riskFactor) => ({
        PutRequest: {
          Item: {
            ...riskFactor,
            ...DynamoDbKeys.RISK_FACTOR(this.tenantId, riskFactor.id),
          },
        },
      })
    )
    return {
      writeRequests,
      tableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
    }
  }

  async createOrUpdateRiskFactor(riskFactor: RiskFactor) {
    logger.debug(`Updating risk factor for V8.`)

    const newRiskFactor = await this.getNewRiskFactor(riskFactor)
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...newRiskFactor,
        ...DynamoDbKeys.RISK_FACTOR(this.tenantId, riskFactor.id),
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))
    logger.debug(`Updated risk factor for V8`)

    return newRiskFactor
  }

  async bulkUpdateRiskFactors(
    riskFactors: RiskFactor[]
  ): Promise<RiskFactor[]> {
    const now = Date.now()
    const updatedRiskFactors: RiskFactor[] = []

    logger.info(`Bulk updating ${riskFactors.length} risk factors for V8`)

    // Process each risk factor to update logic aggregation variables and timestamps
    for (const riskFactor of riskFactors) {
      const updatedRiskFactor: RiskFactor = {
        ...riskFactor,
        logicAggregationVariables:
          (await getLogicAggVarsWithUpdatedVersion(
            riskFactor,
            riskFactor.id,
            riskFactor,
            this.aggregationRepository
          )) ?? [],
        updatedAt: now,
        createdAt: riskFactor.createdAt,
      }

      updatedRiskFactors.push(updatedRiskFactor)
    }

    // Prepare batch write requests
    const writeRequests: BatchWriteRequestInternal[] = updatedRiskFactors.map(
      (riskFactor) => ({
        PutRequest: {
          Item: {
            ...riskFactor,
            ...DynamoDbKeys.RISK_FACTOR(this.tenantId, riskFactor.id),
          },
        },
      })
    )

    // Execute bulk write
    await batchWrite(
      this.dynamoDb,
      writeRequests,
      StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId)
    )

    // Handle local change capture for development
    if (process.env.NODE_ENV === 'development') {
      const { handleLocalHammerheadChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )

      await Promise.all(
        updatedRiskFactors.map((riskFactor) =>
          handleLocalHammerheadChangeCapture(
            this.tenantId,
            DynamoDbKeys.RISK_FACTOR(this.tenantId, riskFactor.id)
          )
        )
      )
    }

    logger.debug(
      `Bulk updated ${updatedRiskFactors.length} risk factors for V8`
    )
    return updatedRiskFactors
  }

  async updateRiskFactorStatus(
    riskFactorId: string,
    status: RuleInstanceStatus
  ): Promise<void> {
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.RISK_FACTOR(this.tenantId, riskFactorId),
      UpdateExpression: `SET #status = :status`,
      ExpressionAttributeValues: {
        ':status': status,
      },
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ReturnValues: 'UPDATED_NEW',
    }
    await this.dynamoDb.send(new UpdateCommand(updateItemInput))
    if (status === 'INACTIVE') {
      await this.removeRiskFactorFromUsedAggVar(riskFactorId)
    }
  }

  async removeRiskFactorFromUsedAggVar(riskFactorId: string) {
    const factor = await this.getRiskFactor(riskFactorId)
    if (factor) {
      await this.aggregationRepository.updateLogicAggVars(
        undefined,
        riskFactorId,
        factor
      )
    }
  }

  async getRiskFactor(riskFactorId: string): Promise<RiskFactor | null> {
    const getInput: GetCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.RISK_FACTOR(this.tenantId, riskFactorId),
    }

    try {
      const result = await this.dynamoDb.send(new GetCommand(getInput))

      if (!result.Item) {
        return null
      }

      return result.Item as RiskFactor
    } catch (e) {
      logger.error(e)
      throw new InternalServerError(
        `Parameter Risk Item not found for ${riskFactorId}`
      )
    }
  }

  async getRiskFactorLogic(
    riskFactorId: string,
    versionId: string,
    riskLevel: RiskLevel
  ): Promise<{
    riskFactorLogic: RiskFactorLogic
    riskFactorEntityVariables: Array<LogicEntityVariableInUse>
    riskFactorAggregationVariables: Array<LogicAggregationVariable>
    isDefaultRiskLevel: boolean
  }> {
    let riskFactors: Array<RiskFactor> = []
    if (versionId === 'CURRENT') {
      const riskFactor = await this.getRiskFactor(riskFactorId)
      if (!riskFactor) {
        throw new NotFound('Risk factor not found')
      }
      riskFactors = [riskFactor]
    } else {
      if (isClickhouseEnabledInRegion()) {
        const credentials = await getClickhouseCredentials(this.tenantId)
        const clickhouseRepository = new VersionHistoryTable({
          credentials,
        })
        const result = await clickhouseRepository.objects
          .filter({
            type: 'RiskFactors',
            id: versionId,
          })
          .final()
          .limit(1)
          .all()

        if (result.length === 0) {
          throw new NotFound('Version history not found')
        }

        riskFactors = JSON.parse(result[0].data) as Array<RiskFactor>
      } else {
        const result = await this.mongoDb
          .db()
          .collection<VersionHistory>(VERSION_HISTORY_COLLECTION(this.tenantId))
          .find({
            type: 'RiskFactors',
            id: versionId,
          })
          .toArray()

        if (result.length === 0) {
          throw new NotFound('Version history not found')
        }

        riskFactors = result[0].data as Array<RiskFactor>
      }
    }

    const riskFactor = riskFactors.find((factor) => factor.id === riskFactorId)

    if (!riskFactor) {
      throw new NotFound('Risk factor not found')
    }

    const logic = riskFactor.riskLevelLogic?.find(
      (logic) => logic.riskLevel === riskLevel
    )

    let isDefaultRiskLevel = false

    if (!logic) {
      if (riskFactor.defaultRiskLevel === riskLevel) {
        isDefaultRiskLevel = true
      } else {
        throw new NotFound('Risk factor logic not found')
      }
    }

    return {
      riskFactorLogic: logic ?? {
        logic: {},
        riskLevel: riskFactor.defaultRiskLevel ?? 'LOW',
        weight: riskFactor.defaultWeight,
        riskScore: riskFactor.defaultRiskScore ?? 1,
      },
      riskFactorEntityVariables: riskFactor.logicEntityVariables ?? [],
      riskFactorAggregationVariables:
        riskFactor.logicAggregationVariables ?? [],
      isDefaultRiskLevel,
    }
  }

  async deleteAllRiskFactors() {
    logger.debug(`Deleting all risk factors.`)

    try {
      // Query to get all risk factor keys
      const queryInput: QueryCommandInput = {
        TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': DynamoDbKeys.RISK_FACTOR(this.tenantId).PartitionKeyID,
        },
        ProjectionExpression: 'PartitionKeyID, SortKeyID',
      }

      const queryResult = await this.dynamoDb.send(new QueryCommand(queryInput))

      if (queryResult.Items && queryResult.Items.length > 0) {
        // Prepare batch delete request
        const deleteRequests = queryResult.Items.map(
          (item): BatchWriteRequestInternal => ({
            DeleteRequest: {
              Key: {
                PartitionKeyID: item.PartitionKeyID,
                SortKeyID: item.SortKeyID,
              },
            } as DeleteRequestInternal,
          })
        )

        await batchWrite(
          this.dynamoDb,
          deleteRequests,
          StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId)
        )
        // Remove risk factors from used aggregation variables
        for (const item of queryResult.Items) {
          await this.removeRiskFactorFromUsedAggVar(item.SortKeyID)
        }
      }
    } catch (e) {
      logger.error(e)
    }
    logger.debug(`Deleted all risk factors.`)
  }

  async deleteRiskFactor(riskFactorId: string) {
    logger.debug(`Deleting risk factor.`)
    const key = DynamoDbKeys.RISK_FACTOR(this.tenantId, riskFactorId)

    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: key,
    }

    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
    logger.debug(`Deleted risk factor.`)
    await this.removeRiskFactorFromUsedAggVar(riskFactorId)
  }

  public getAllRiskFactors = memoize(
    async (entityType?: RiskEntityType): Promise<Array<RiskFactor>> => {
      const keyConditionExpr = 'PartitionKeyID = :pk'
      const expressionAttributeVals: Record<string, any> = {
        ':pk': DynamoDbKeys.RISK_FACTOR(this.tenantId).PartitionKeyID,
      }

      const expressionAttributeNames: Record<string, string> = {}
      let filterExpression = ''

      if (entityType) {
        filterExpression = '#type = :entityType'
        expressionAttributeVals[':entityType'] = entityType
        expressionAttributeNames['#type'] = 'type'
      }

      const queryInput: QueryCommandInput = {
        TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
        KeyConditionExpression: keyConditionExpr,
        ExpressionAttributeValues: expressionAttributeVals,
        ...(Object.keys(expressionAttributeNames).length > 0 && {
          ExpressionAttributeNames: expressionAttributeNames,
        }),
        ...(filterExpression && { FilterExpression: filterExpression }),
      }

      try {
        const result = await paginateQuery(this.dynamoDb, queryInput)
        return result.Items && result.Items.length > 0
          ? (result.Items.map((item) =>
              omit(item, ['PartitionKeyID', 'SortKeyID'])
            ) as RiskFactor[])
          : []
      } catch (e) {
        logger.error(e)
        return []
      }
    }
  )

  async getDrsScoresForUser(
    request: DefaultApiGetDrsValuesRequest
  ): Promise<DrsValuesResponse> {
    const collection = this.mongoDb
      .db()
      .collection<DrsScore>(DRS_SCORES_COLLECTION(this.tenantId))
    const cursor = collection
      .find({ userId: request.userId })
      .sort({ createdAt: -1 })

    const result = await paginateCursor<
      DefaultApiGetDrsValuesRequest,
      DrsScore
    >(cursor, request).toArray()

    const count = await collection.countDocuments({ userId: request.userId })

    const riskClassificationValues = await this.getRiskClassificationValues()
    const { riskLevelAlias } = await tenantSettings(this.tenantId)
    const arsPromises = result.map((data) => {
      const hasArs = !isNotArsChangeTxId(data.transactionId)
      return hasArs && data.transactionId
        ? this.getArsValueFromMongo(data.transactionId)
        : Promise.resolve(null)
    })

    const arsScores = await Promise.all(arsPromises)

    const enrichedData = result.map((data, index) => {
      const arsScore = arsScores[index]
      const arsData = arsScore
        ? {
            arsRiskLevel: getRiskLevelFromScore(
              riskClassificationValues,
              arsScore?.arsScore ?? null,
              riskLevelAlias
            ),
            arsRiskScore: arsScore?.arsScore,
          }
        : {}

      return {
        ...data,
        derivedRiskLevel: getRiskLevelFromScore(
          riskClassificationValues,
          data.drsScore,
          riskLevelAlias
        ),
        ...arsData,
      }
    })

    return {
      total: count,
      items: enrichedData,
    }
  }

  async getDrsScores(userIds: string[]): Promise<DrsScore[]> {
    return (
      await batchGet<DrsScore>(
        this.dynamoDb,
        StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
        userIds.map((userId) =>
          DynamoDbKeys.DRS_VALUE_ITEM(this.tenantId, userId, '1')
        )
      )
    ).map((item) => {
      delete item['PartitionKeyID']
      delete item['SortKeyID']
      return item
    })
  }

  async getKrsScores(userIds: string[]): Promise<KrsScore[]> {
    return (
      await batchGet<KrsScore>(
        this.dynamoDb,
        StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
        userIds.map((userId) =>
          DynamoDbKeys.KRS_VALUE_ITEM(this.tenantId, userId, '1')
        )
      )
    ).map((item) => {
      delete item['PartitionKeyID']
      delete item['SortKeyID']
      return item
    })
  }

  public async getNewRiskFactorId(
    riskFactorId?: string,
    update = false
  ): Promise<string> {
    const mongoDb = await getMongoDbClient()
    const counterRepository = new CounterRepository(this.tenantId, {
      mongoDb,
      dynamoDb: this.dynamoDb,
    })

    if (riskFactorId) {
      const id = riskFactorId.split('.')[0]
      const nextCount = await counterRepository[
        update ? 'getNextCounterAndUpdate' : 'getNextCounter'
      ](id as any)
      return `${id}.${nextCount}`
    } else {
      const count = await counterRepository[
        update ? 'getNextCounterAndUpdate' : 'getNextCounter'
      ]('RiskFactor' as any)
      return `RF-${count.toString().padStart(3, '0')}`
    }
  }

  async getDailyRiskFactorCount(timeRange: {
    startTimestamp: number
    endTimestamp: number
  }): Promise<DailyStats> {
    const keyConditionExpr = 'PartitionKeyID = :pk'
    const expressionAttributeVals: Record<string, any> = {
      ':pk': DynamoDbKeys.RISK_FACTOR(this.tenantId).PartitionKeyID,
      ':startTime': timeRange.startTimestamp,
      ':endTime': timeRange.endTimestamp,
    }

    const expressionAttributeNames: Record<string, string> = {
      '#createdAt': 'createdAt',
    }

    const filterExpression = '#createdAt BETWEEN :startTime AND :endTime'

    const queryInput: QueryCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: keyConditionExpr,
      ExpressionAttributeValues: expressionAttributeVals,
      ExpressionAttributeNames: expressionAttributeNames,
      FilterExpression: filterExpression,
    }

    const result = await paginateQuery(this.dynamoDb, queryInput)

    const dailyStats: DailyStats = {}

    if (result.Items?.length) {
      result.Items.forEach((item) => {
        const createdAt = item.createdAt as number
        const type = item.type as RiskEntityType
        const dayLabel = new Date(createdAt).toISOString().split('T')[0] // YYYY-MM-DD

        if (!dailyStats[dayLabel]) {
          dailyStats[dayLabel] = {
            CONSUMER_USER: 0,
            BUSINESS: 0,
            TRANSACTION: 0,
          }
        }

        dailyStats[dayLabel][type]++
      })
    }

    return dailyStats
  }
}

/** Kinesis Util */

/**
 * Version history
 * - Non Active Verison History
 * - Dynamo we keep another latest and pending
 * - On approve to
 *
 *
 *
 */
