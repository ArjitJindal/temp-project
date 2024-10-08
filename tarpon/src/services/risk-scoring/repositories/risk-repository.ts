import { FindCursor, MongoClient, WithId } from 'mongodb'
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
  QueryCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { isEmpty, omit } from 'lodash'
import {
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@flagright/lib/utils/risk'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { paginateQuery } from '@/utils/dynamodb'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { logger } from '@/core/logger'
import {
  ARS_SCORES_COLLECTION,
  DRS_SCORES_COLLECTION,
  KRS_SCORES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { RiskClassificationConfig } from '@/@types/openapi-internal/RiskClassificationConfig'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { RiskScoreComponent } from '@/@types/openapi-internal/RiskScoreComponent'
import { traceable } from '@/core/xray'
import { TrsScoresResponse } from '@/@types/openapi-internal/TrsScoresResponse'
import {
  getContext,
  updateTenantRiskClassificationValues,
} from '@/core/utils/context'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { AverageArsScore } from '@/@types/openapi-internal/AverageArsScore'
import { AggregationRepository } from '@/services/logic-evaluator/engine/aggregation-repository'
import { RiskFactorScoreDetails } from '@/@types/openapi-internal/RiskFactorScoreDetails'
import { RuleInstanceStatus } from '@/@types/openapi-internal/RuleInstanceStatus'
import { getLogicAggVarsWithUpdatedVersion } from '@/utils/risk-rule-shared'
import { internalMongoReplace } from '@/utils/mongodb-utils'
import { sendMessageToMongoConsumer } from '@/utils/clickhouse/utils'
import { getTriggerSource } from '@/utils/lambda'
import {
  createNonConsoleApiInMemoryCache,
  getInMemoryCacheKey,
} from '@/utils/memory-cache'

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

const RISK_SCORE_HISTORY_ITEMS_TO_SHOW = 5
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
    factorScoreDetails?: RiskFactorScoreDetails[]
  ): Promise<KrsScore> {
    logger.info(`Updating KRS score for user ${userId} to ${score}`)
    const newKrsScoreItem: KrsScore = {
      krsScore: score,
      createdAt: Date.now(),
      userId: userId,
      components,
      factorScoreDetails,
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

    logger.info(`Updated KRS score for user ${userId} to ${score}`)
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
    logger.info(
      `Updating ARS score for transaction ${transactionId} to ${score}`
    )
    const newArsScoreItem: ArsScore = {
      arsScore: score,
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
    logger.info(
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
    logger.info(
      `Updating DRS score for user ${userId} to ${drsScore} with transaction ${transactionId}`
    )
    const newDrsScoreItem: DrsScore = {
      drsScore,
      transactionId,
      createdAt: Date.now(),
      isUpdatable: isUpdatable ?? true,
      userId: userId,
      components,
      factorScoreDetails,
      triggeredBy: getTriggerSource(),
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

    logger.info(
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

  async createOrUpdateRiskClassificationConfig(
    riskClassificationValues: RiskClassificationScore[]
  ): Promise<RiskClassificationConfig> {
    logger.info(`Updating risk classification config.`)
    const now = Date.now()
    const newRiskClassificationValues: RiskClassificationConfig = {
      classificationValues: riskClassificationValues,
      updatedAt: now,
    }
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...DynamoDbKeys.RISK_CLASSIFICATION(this.tenantId, 'LATEST'), // Version it later
        ...newRiskClassificationValues,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
    logger.info(`Updated risk classification config.`)

    updateTenantRiskClassificationValues(riskClassificationValues)

    return newRiskClassificationValues
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

  async createOrUpdateManualDRSRiskItem(
    userId: string,
    riskLevel: RiskLevel,
    isUpdatable?: boolean
  ) {
    logger.info(`Updating manual risk level for user ${userId} to ${riskLevel}`)
    const now = Date.now()
    const riskClassificationValues = await this.getRiskClassificationValues()
    const newDrsRiskValue: DrsScore = {
      manualRiskLevel: riskLevel,
      createdAt: now,
      isUpdatable: isUpdatable ?? true,
      drsScore: getRiskScoreFromLevel(riskClassificationValues, riskLevel),
      userId,
      transactionId: 'MANUAL_UPDATE',
      triggeredBy: getTriggerSource(),
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

    logger.info(`Manual risk level updated for user ${userId} to ${riskLevel}`)

    return newDrsRiskValue
  }

  async createOrUpdateParameterRiskItem(
    parameterRiskLevels: ParameterAttributeRiskValues
  ) {
    logger.info(`Updating parameter risk levels.`)
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...parameterRiskLevels,
        ...DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(
          this.tenantId,

          parameterRiskLevels.parameter,
          parameterRiskLevels.riskEntityType
        ),
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
    logger.info(`Updated parameter risk levels.`)
    return parameterRiskLevels
  }

  async deleteParameterRiskItem(
    parameter: ParameterAttributeRiskValuesParameterEnum,
    entityType: RiskEntityType
  ) {
    logger.info(`Deleting parameter risk item.`)
    const primaryKey = DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(
      this.tenantId,
      parameter,
      entityType
    )

    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: primaryKey,
    }

    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
    logger.info(`Deleted parameter risk item.`)
  }

  async getParameterRiskItem(
    parameter: ParameterAttributeRiskValuesParameterEnum,
    entityType: RiskEntityType
  ): Promise<ParameterAttributeRiskValues | null> {
    const keyConditionExpr = 'PartitionKeyID = :pk AND SortKeyID = :sk'
    const { PartitionKeyID, SortKeyID } =
      DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(
        this.tenantId,
        parameter,
        entityType
      )
    const expressionAttributeVals = {
      ':pk': PartitionKeyID,
      ':sk': SortKeyID,
    }

    const queryInput: QueryCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: keyConditionExpr,

      ExpressionAttributeValues: expressionAttributeVals,
    }
    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)

      if (!result.Items?.length) {
        return null
      }

      return omit(result.Items[0], [
        'PartitionKeyID',
        'SortKeyID',
      ]) as ParameterAttributeRiskValues
    } catch (e) {
      logger.error(e)
      throw new InternalServerError(
        `Parameter Risk Item not found for ${parameter} and ${entityType}`
      )
    }
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

  async getParameterRiskItems(): Promise<
    ParameterAttributeRiskValues[] | null
  > {
    const keyConditionExpr = 'PartitionKeyID = :pk'
    const expressionAttributeVals = {
      ':pk': DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(this.tenantId)
        .PartitionKeyID,
    }

    const queryInput: QueryCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: keyConditionExpr,
      ExpressionAttributeValues: expressionAttributeVals,
    }
    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)
      return result.Items && result.Items.length > 0
        ? (result.Items.map((item) =>
            omit(item, ['PartitionKeyID', 'SortKeyID'])
          ) as ParameterAttributeRiskValues[])
        : null
    } catch (e) {
      logger.error(e)
      return null
    }
  }

  async getAverageArsScore(userId: string): Promise<AverageArsScore | null> {
    const getInput: GetCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.AVG_ARS_VALUE_ITEM(this.tenantId, userId, '1'),
    }
    const result = await this.dynamoDb.send(new GetCommand(getInput))
    if (!result.Item) {
      return null
    }

    return omit(result.Item, ['PartitionKeyID', 'SortKeyID']) as AverageArsScore
  }

  async updateOrCreateAverageArsScore(
    userId: string,
    averageArsScore: AverageArsScore
  ): Promise<AverageArsScore> {
    logger.info(`Updating average ARS score for user ${userId}`)
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

  public async getAverageArsScoreForUser(
    userId: string
  ): Promise<TrsScoresResponse> {
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
      average: data?.average ?? 0,
    }
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
      documentKey: { _id: data.insertedId.toString() },
      operationType: 'insert',
    })

    return drsScore
  }
  async getDrsValueFromMongo(userId: string): Promise<DrsScore[]> {
    const db = this.mongoDb.db()
    const drsValuesCollection = db.collection<DrsScore>(
      DRS_SCORES_COLLECTION(this.tenantId)
    )
    const drsValues: WithId<DrsScore>[] = await drsValuesCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(RISK_SCORE_HISTORY_ITEMS_TO_SHOW)
      .toArray()
    const riskClassificationValues = await this.getRiskClassificationValues()

    return drsValues.map((drsValue) => ({
      ...drsValue,
      derivedRiskLevel: getRiskLevelFromScore(
        riskClassificationValues,
        drsValue.drsScore
      ),
    }))
  }

  async createOrUpdateRiskFactor(riskFactor: RiskFactor) {
    logger.info(`Updating risk factor for V8.`)

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
    logger.info(`Updated risk factor for V8`)

    return riskFactor
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

  async deleteRiskFactor(riskFactorId: string) {
    logger.info(`Deleting risk factor.`)
    const primaryKey = DynamoDbKeys.RISK_FACTOR(this.tenantId, riskFactorId)

    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: primaryKey,
    }

    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
    logger.info(`Deleted risk factor.`)
    await this.removeRiskFactorFromUsedAggVar(riskFactorId)
  }

  async getAllRiskFactors(
    entityType?: RiskEntityType
  ): Promise<Array<RiskFactor>> {
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
}

/** Kinesis Util */

const handleLocalChangeCapture = async (
  tenantId: string,
  primaryKey: { PartitionKeyID: string; SortKeyID?: string }
) => {
  const { localHammerheadChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )
  await localHammerheadChangeCaptureHandler(tenantId, primaryKey)
}
