import { Filter, FindCursor, MongoClient, WithId } from 'mongodb'
import { StackConstants } from '@lib/constants'
import { InternalServerError } from 'http-errors'
import {
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
import { isEmpty, memoize, omit } from 'lodash'
import {
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
  isNotArsChangeTxId,
} from '@flagright/lib/utils/risk'
import { WithOperators } from 'thunder-schema'
import {
  hasFeature,
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
} from '@/utils/dynamodb'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { logger } from '@/core/logger'
import {
  ARS_SCORES_COLLECTION,
  DRS_SCORES_COLLECTION,
  KRS_SCORES_COLLECTION,
  RISK_CLASSIFICATION_HISTORY_COLLECTION,
} from '@/utils/mongodb-definitions'
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
import {
  getMongoDbClient,
  internalMongoReplace,
  paginateCursor,
} from '@/utils/mongodb-utils'
import {
  getClickhouseCredentials,
  isClickhouseEnabledInRegion,
  sendMessageToMongoConsumer,
} from '@/utils/clickhouse/utils'
import { getTriggerSource } from '@/utils/lambda'
import {
  createNonConsoleApiInMemoryCache,
  getInMemoryCacheKey,
} from '@/utils/memory-cache'
import { TrsScoresResponse } from '@/@types/openapi-internal/TrsScoresResponse'
import { handleSmallNumber } from '@/utils/helpers'
import { CounterRepository } from '@/services/counter/repository'
import { DrsValuesResponse } from '@/@types/openapi-internal/DrsValuesResponse'
import {
  DefaultApiGetDrsValuesRequest,
  DefaultApiGetRiskLevelVersionHistoryRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { RiskClassificationHistory } from '@/@types/openapi-internal/RiskClassificationHistory'
import { RiskClassificationHistoryTable } from '@/models/risk-classification-history'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'

const riskClassificationValuesCache = createNonConsoleApiInMemoryCache<
  RiskClassificationScore[]
>({
  max: 100,
  ttlMinutes: 10,
})

export const DEFAULT_CLASSIFICATION_SETTINGS: RiskClassificationScore[] = [
  {
    riskLevel: 'VERY_LOW',
    lowerBoundRiskScore: 0,
    upperBoundRiskScore: 20,
  },
  {
    riskLevel: 'LOW',
    lowerBoundRiskScore: 20,
    upperBoundRiskScore: 40,
  },
  {
    riskLevel: 'MEDIUM',
    lowerBoundRiskScore: 40,
    upperBoundRiskScore: 60,
  },
  {
    riskLevel: 'HIGH',
    lowerBoundRiskScore: 60,
    upperBoundRiskScore: 80,
  },
  {
    riskLevel: 'VERY_HIGH',
    lowerBoundRiskScore: 80,
    upperBoundRiskScore: 100,
  },
]

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
    return drsScore?.prevDrsScore
      ? getRiskLevelFromScore(riskClassificationValues, drsScore.prevDrsScore)
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

    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...primaryKey,
        ...newKrsScoreItem,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))
    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(this.tenantId, primaryKey)
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

    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...primaryKey,
        ...newArsScoreItem,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))
    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(this.tenantId, primaryKey)
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

    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...primaryKey,
        ...newDrsScoreItem,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))

    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(this.tenantId, primaryKey)
    }

    logger.debug(
      `Updated DRS score for user ${userId} to ${drsScore} with transaction ${transactionId}`
    )
    return newDrsScoreItem
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

    return result.Item as RiskClassificationConfig
  }

  async createOrUpdateRiskClassificationConfig(
    id: string,
    comment: string,
    riskClassificationValues: RiskClassificationScore[]
  ): Promise<RiskClassificationHistory> {
    logger.debug(`Updating risk classification config.`)
    const now = Date.now()
    const newRiskClassificationValues: RiskClassificationConfig = {
      classificationValues: riskClassificationValues,
      updatedAt: now,
      createdAt: now,
      id,
    }
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...DynamoDbKeys.RISK_CLASSIFICATION(this.tenantId, 'LATEST'), // Version it later
        ...newRiskClassificationValues,
      },
    }

    const historyItem: RiskClassificationHistory = {
      comment,
      createdAt: now,
      createdBy: getContext()?.user?.id ?? FLAGRIGHT_SYSTEM_USER,
      id,
      scores: newRiskClassificationValues.classificationValues,
      updatedAt: now,
    }

    await Promise.all([
      this.dynamoDb.send(new PutCommand(putItemInput)),
      this.createRiskClassificationHistoryInClickhouse(historyItem),
    ])

    logger.debug(`Updated risk classification config.`)

    updateTenantRiskClassificationValues(riskClassificationValues)

    return historyItem
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
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...primaryKey,
        ...newKrsScoreItem,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(this.tenantId, primaryKey)
    }
    logger.info(`Manual risk level updated for user ${userId} to ${riskLevel}`)
    return newKrsScoreItem
  }

  async createOrUpdateManualDRSRiskItem(
    userId: string,
    riskLevel: RiskLevel,
    isUpdatable?: boolean
  ) {
    logger.debug(
      `Updating manual risk level for user ${userId} to ${riskLevel}`
    )
    const now = Date.now()
    const [riskClassificationValues, previousDrsScore] = await Promise.all([
      this.getRiskClassificationValues(),
      this.getDrsScore(userId),
    ])

    const newDrsRiskValue: DrsScore = {
      manualRiskLevel: riskLevel,
      createdAt: now,
      isUpdatable: isUpdatable ?? true,
      drsScore: getRiskScoreFromLevel(riskClassificationValues, riskLevel),
      userId,
      transactionId: 'MANUAL_UPDATE',
      triggeredBy: getTriggerSource(),
      prevDrsScore: previousDrsScore?.drsScore,
    }
    const primaryKey = DynamoDbKeys.DRS_VALUE_ITEM(this.tenantId, userId, '1')
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...primaryKey,
        ...newDrsRiskValue,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))

    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(this.tenantId, primaryKey)
    }

    logger.debug(`Manual risk level updated for user ${userId} to ${riskLevel}`)

    return newDrsRiskValue
  }

  public async augmentRiskLevel<T extends { arsScore?: ArsScore }>(
    items: Array<T>
  ): Promise<T[]> {
    const riskClassificationValues = await this.getRiskClassificationValues()

    return items.map((item) => ({
      ...item,
      arsScore: item.arsScore && {
        ...item.arsScore,
        riskLevel: getRiskLevelFromScore(
          riskClassificationValues,
          item.arsScore.arsScore
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
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...primaryKey,
        ...averageArsScore,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(this.tenantId, primaryKey)
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

  /* MongoDB operations */

  async addKrsValueToMongo(krsScore: KrsScore): Promise<KrsScore> {
    await internalMongoReplace(
      this.mongoDb,
      KRS_SCORES_COLLECTION(this.tenantId),
      { userId: krsScore.userId },
      krsScore
    )

    return krsScore
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
    return krsValue
      ? {
          ...krsValue,
          riskLevel: getRiskLevelFromScore(
            riskClassificationValues,
            krsValue.krsScore
          ),
        }
      : null
  }

  async addArsValueToMongo(arsScore: ArsScore): Promise<ArsScore> {
    await internalMongoReplace(
      this.mongoDb,
      ARS_SCORES_COLLECTION(this.tenantId),
      { transactionId: arsScore.transactionId },
      arsScore
    )
    return arsScore
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

  async createOrUpdateRiskFactor(riskFactor: RiskFactor) {
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

    await this.dynamoDb.send(new PutCommand(putItemInput))
    logger.debug(`Updated risk factor for V8`)

    return newRiskFactor
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
              arsScore?.arsScore ?? null
            ),
            arsRiskScore: arsScore?.arsScore,
          }
        : {}

      return {
        ...data,
        derivedRiskLevel: getRiskLevelFromScore(
          riskClassificationValues,
          data.drsScore
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

  async createRiskClassificationHistoryInMongo(
    riskClassificationHistory: RiskClassificationHistory
  ) {
    await this.mongoDb
      .db()
      .collection<RiskClassificationHistory>(
        RISK_CLASSIFICATION_HISTORY_COLLECTION(this.tenantId)
      )
      .insertOne(riskClassificationHistory)
  }

  async createRiskClassificationHistoryInClickhouse(
    riskClassificationHistory: RiskClassificationHistory
  ) {
    if (!isClickhouseEnabledInRegion()) {
      return this.createRiskClassificationHistoryInMongo(
        riskClassificationHistory
      )
    }

    const credentials = await getClickhouseCredentials(this.tenantId)
    const clickhouseRepository = new RiskClassificationHistoryTable({
      credentials,
    })
    await clickhouseRepository.create(riskClassificationHistory).save()
  }

  private getFilters(
    params: DefaultApiGetRiskLevelVersionHistoryRequest
  ): Partial<WithOperators<RiskClassificationHistory>> {
    const filters: Partial<WithOperators<RiskClassificationHistory>> = {}

    if (params.filterVersionId != null) {
      filters.id = params.filterVersionId
    }
    if (params.filterCreatedBy != null) {
      filters.createdBy__in = params.filterCreatedBy
    }

    if (
      params.filterBeforeTimestamp != null &&
      params.filterAfterTimestamp != null
    ) {
      filters.createdAt__lt = params.filterBeforeTimestamp
      filters.createdAt__gt = params.filterAfterTimestamp
    }
    return filters
  }

  private getMongoFilters(
    params: DefaultApiGetRiskLevelVersionHistoryRequest
  ): Filter<RiskClassificationHistory> {
    const filters: Filter<RiskClassificationHistory> = {}

    if (params.filterVersionId != null) {
      filters.id = params.filterVersionId
    }
    if (params.filterCreatedBy != null) {
      filters.createdBy = { $in: params.filterCreatedBy }
    }

    if (
      params.filterBeforeTimestamp != null &&
      params.filterAfterTimestamp != null
    ) {
      filters.createdAt = {
        $gte: params.filterAfterTimestamp,
        $lte: params.filterBeforeTimestamp,
      }
    }

    return filters
  }

  async getRiskClassificationHistoryMongo(
    params: DefaultApiGetRiskLevelVersionHistoryRequest
  ): Promise<RiskClassificationHistory[]> {
    const result = await this.mongoDb
      .db()
      .collection<RiskClassificationHistory>(
        RISK_CLASSIFICATION_HISTORY_COLLECTION(this.tenantId)
      )
      .find(this.getMongoFilters(params))
      .toArray()

    return result
  }

  async getRiskClassificationHistory(
    params: DefaultApiGetRiskLevelVersionHistoryRequest
  ): Promise<RiskClassificationHistory[]> {
    if (!isClickhouseEnabledInRegion()) {
      return this.getRiskClassificationHistoryMongo(params)
    }

    const credentials = await getClickhouseCredentials(this.tenantId)
    const clickhouseRepository = new RiskClassificationHistoryTable({
      credentials,
    })

    const filters = this.getFilters(params)

    const result = await clickhouseRepository.objects
      .filter(filters)
      .final()
      .limit(params.pageSize ?? DEFAULT_PAGE_SIZE)
      .offset(((params.page ?? 1) - 1) * (params.pageSize ?? DEFAULT_PAGE_SIZE))
      .sort({
        [params.sortField ?? 'createdAt']:
          params.sortOrder === 'descend' ? -1 : 1,
      })
      .all()

    return result
  }

  async getRiskClassificationHistoryCountMongo(
    params: DefaultApiGetRiskLevelVersionHistoryRequest
  ): Promise<number> {
    const result = await this.mongoDb
      .db()
      .collection<RiskClassificationHistory>(
        RISK_CLASSIFICATION_HISTORY_COLLECTION(this.tenantId)
      )
      .countDocuments(this.getMongoFilters(params))
    return result
  }

  async getRiskClassificationHistoryCount(
    params: DefaultApiGetRiskLevelVersionHistoryRequest
  ): Promise<number> {
    if (!isClickhouseEnabledInRegion()) {
      return this.getRiskClassificationHistoryCountMongo(params)
    }

    const credentials = await getClickhouseCredentials(this.tenantId)
    const clickhouseRepository = new RiskClassificationHistoryTable({
      credentials,
    })

    const filters = this.getFilters(params)

    const count = await clickhouseRepository.objects
      .filter(filters)
      .final()
      .count()

    return count
  }

  async getRiskClassificationHistoryByIdMongo(
    id: string
  ): Promise<RiskClassificationHistory | null> {
    const result = await this.mongoDb
      .db()
      .collection<RiskClassificationHistory>(
        RISK_CLASSIFICATION_HISTORY_COLLECTION(this.tenantId)
      )
      .findOne({ id })
    return result
  }

  async getRiskClassificationHistoryById(
    id: string
  ): Promise<RiskClassificationHistory | null> {
    if (!isClickhouseEnabledInRegion()) {
      return this.getRiskClassificationHistoryByIdMongo(id)
    }

    const credentials = await getClickhouseCredentials(this.tenantId)
    const table = new RiskClassificationHistoryTable({
      credentials,
    })

    const data = await table.objects.filter({ id }).final().first()

    if (!data) {
      return null
    }

    return data
  }
}

/** Kinesis Util */

const handleLocalChangeCapture = async (
  tenantId: string,
  primaryKey: { PartitionKeyID: string; SortKeyID?: string }
) => {
  const { localTarponChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )

  await localTarponChangeCaptureHandler(tenantId, primaryKey, 'HAMMERHEAD')
}
