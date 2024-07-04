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
} from '@aws-sdk/lib-dynamodb'
import { isEmpty, isEqual, omit } from 'lodash'
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
import { ParameterAttributeRiskValuesV8 } from '@/@types/openapi-internal/ParameterAttributeRiskValuesV8'
import { ParameterAttributeValuesListV8 } from '@/@types/openapi-internal/ParameterAttributeValuesListV8'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { getAggVarHash } from '@/services/rules-engine/v8-engine/aggregation-repository'

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
  }

  async getKrsScore(userId: string): Promise<KrsScore | null> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
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
    components?: RiskScoreComponent[]
  ): Promise<KrsScore> {
    logger.info(`Updating KRS score for user ${userId} to ${score}`)
    const newKrsScoreItem: KrsScore = {
      krsScore: score,
      createdAt: Date.now(),
      userId: userId,
      components,
    }
    const primaryKey = DynamoDbKeys.KRS_VALUE_ITEM(this.tenantId, userId, '1')

    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...primaryKey,
        ...newKrsScoreItem,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))
    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(primaryKey)
    }

    logger.info(`Updated KRS score for user ${userId} to ${score}`)
    return newKrsScoreItem
  }

  async createOrUpdateArsScore(
    transactionId: string,
    score: number,
    originUserId?: string,
    destinationUserId?: string,
    components?: RiskScoreComponent[]
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
    }

    const primaryKey = DynamoDbKeys.ARS_VALUE_ITEM(
      this.tenantId,
      transactionId,
      '1'
    )

    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...primaryKey,
        ...newArsScoreItem,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))
    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(primaryKey)
    }
    logger.info(
      `Updated ARS score for transaction ${transactionId} to ${score}`
    )
    return newArsScoreItem
  }

  async getArsScore(transactionId: string): Promise<ArsScore | null> {
    try {
      const getItemInput: GetCommandInput = {
        TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
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
        TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
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
    components: RiskScoreComponent[]
  ): Promise<DrsScore> {
    logger.info(
      `Updating DRS score for user ${userId} to ${drsScore} with transaction ${transactionId}`
    )
    const newDrsScoreItem: DrsScore = {
      drsScore,
      transactionId,
      createdAt: Date.now(),
      isUpdatable: true,
      userId: userId,
      components,
    }
    const primaryKey = DynamoDbKeys.DRS_VALUE_ITEM(this.tenantId, userId, '1')

    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...primaryKey,
        ...newDrsScoreItem,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))

    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(primaryKey)
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

    const queryInput: QueryCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
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
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
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
    return {
      ...drsScore,
      derivedRiskLevel,
    }
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
    }
    const primaryKey = DynamoDbKeys.DRS_VALUE_ITEM(this.tenantId, userId, '1')
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...primaryKey,
        ...newDrsRiskValue,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))

    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(primaryKey)
    }

    logger.info(`Manual risk level updated for user ${userId} to ${riskLevel}`)

    return newDrsRiskValue
  }

  private async getLogicAggVarsWithUpdatedVersion(
    parameter: ParameterAttributeRiskValuesV8
  ): Promise<RuleAggregationVariable[] | undefined> {
    // Early return if no aggregation variables
    if (
      !parameter.logicAggregationVariables ||
      parameter.logicAggregationVariables.length === 0
    ) {
      return parameter.logicAggregationVariables
    }

    const oldRiskFactor = parameter.id
      ? await this.getParameterRiskItemV8(parameter.id)
      : null
    // Early return if aggregation variables are not changed
    const isBeingEnabled =
      (!oldRiskFactor || !oldRiskFactor.isActive) && parameter.isActive === true

    if (
      !parameter.isActive ||
      (!isBeingEnabled &&
        isEqual(
          oldRiskFactor?.logicAggregationVariables?.map((v) =>
            getAggVarHash(v, false)
          ),
          parameter.logicAggregationVariables?.map((v) =>
            getAggVarHash(v, false)
          )
        ))
    ) {
      return parameter.logicAggregationVariables
    }
    const activeRiskFactors = await this.getActiveParameterRiskItemsV8(
      parameter.riskEntityType
    )

    const activeLogicAggregationVariables = activeRiskFactors.flatMap(
      (r) => r.logicAggregationVariables ?? []
    )
    const newVersion = Date.now()
    return parameter.logicAggregationVariables.map((aggVar) => {
      const existingSameAggVar = activeLogicAggregationVariables.find(
        (v) => getAggVarHash(v, false) === getAggVarHash(aggVar, false)
      )

      // NOTE: An aggregation variable's version is determined by the timestamp when
      // it is first created and enabled. This is to ensure that the version is consistent.
      return {
        ...aggVar,
        version: existingSameAggVar?.version ?? newVersion,
      }
    })
  }

  async createOrUpdateParameterRiskItem(
    parameterRiskLevels: ParameterAttributeRiskValues
  ) {
    logger.info(`Updating parameter risk levels.`)
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
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

  async createOrUpdateParameterRiskItemV8(
    parameter: ParameterAttributeRiskValuesV8
  ) {
    logger.info(`Updating parameter risk levels for V8.`)

    const riskFactor: ParameterAttributeRiskValuesV8 = {
      ...parameter,
      logicAggregationVariables:
        (await this.getLogicAggVarsWithUpdatedVersion(parameter)) ?? [],
    }

    const putItemInput: PutCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...riskFactor,
        ...DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS_V8(
          this.tenantId,
          parameter.id
        ),
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))
    logger.info(`Updated parameter risk levels.`)

    return riskFactor
  }

  async getParameterRiskItemV8(
    parameterId: string
  ): Promise<ParameterAttributeRiskValuesV8 | null> {
    const getInput: GetCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS_V8(
        this.tenantId,
        parameterId
      ),
    }

    try {
      const result = await this.dynamoDb.send(new GetCommand(getInput))

      if (!result.Item) {
        return null
      }

      return result.Item as ParameterAttributeRiskValuesV8
    } catch (e) {
      logger.error(e)
      throw new InternalServerError(
        `Parameter Risk Item not found for ${parameterId}`
      )
    }
  }

  async deleteParameterRiskItemV8(parameterId: string) {
    logger.info(`Deleting parameter risk item.`)
    const primaryKey = DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS_V8(
      this.tenantId,
      parameterId
    )

    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Key: primaryKey,
    }

    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
    logger.info(`Deleted parameter risk item.`)
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
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
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
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
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
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
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

  async getParameterRiskItemsV8(
    entityType?: RiskEntityType
  ): Promise<Array<ParameterAttributeValuesListV8>> {
    const keyConditionExpr = 'PartitionKeyID = :pk'
    const expressionAttributeVals = {
      ':pk': DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS_V8(this.tenantId)
        .PartitionKeyID,
    }

    let filterExpression = ''

    if (entityType) {
      filterExpression = 'riskEntityType = :entityType'
      expressionAttributeVals[':entityType'] = entityType
    }

    const queryString =
      ParameterAttributeValuesListV8.getAttributeTypeMap().reduce(
        (acc, curr) => {
          if (curr.baseName === 'name') {
            return acc + '#name' + ','
          }

          return acc + curr.baseName + ','
        },
        ''
      )

    const queryInput: QueryCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: keyConditionExpr,
      ExpressionAttributeValues: expressionAttributeVals,
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ProjectionExpression: queryString.slice(0, -1),
      ...(filterExpression && { FilterExpression: filterExpression }),
    }

    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)
      return result.Items && result.Items.length > 0
        ? (result.Items.map((item) =>
            omit(item, ['PartitionKeyID', 'SortKeyID'])
          ) as ParameterAttributeValuesListV8[])
        : []
    } catch (e) {
      logger.error(e)
      return []
    }
  }

  async getActiveParameterRiskItemsV8(
    riskEntityType: RiskEntityType
  ): Promise<Array<ParameterAttributeRiskValuesV8>> {
    const queryInput: QueryCommandInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS_V8(this.tenantId)
          .PartitionKeyID,
        ':isActive': true,
        ':entityType': riskEntityType,
      },
      FilterExpression: 'isActive = :isActive AND riskEntityType = :entityType',
    }

    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)
      return result.Items && result.Items.length > 0
        ? (result.Items.map((item) =>
            omit(item, ['PartitionKeyID', 'SortKeyID'])
          ) as ParameterAttributeRiskValuesV8[])
        : []
    } catch (e) {
      logger.error(e)
      return []
    }
  }

  /* MongoDB operations */

  async addKrsValueToMongo(krsScore: KrsScore): Promise<KrsScore> {
    const db = this.mongoDb.db()
    const krsValuesCollection = db.collection<KrsScore>(
      KRS_SCORES_COLLECTION(this.tenantId)
    )

    await krsValuesCollection.replaceOne(
      { userId: krsScore.userId },
      krsScore,
      { upsert: true }
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
    const db = this.mongoDb.db()
    const arsValuesCollection = db.collection<ArsScore>(
      ARS_SCORES_COLLECTION(this.tenantId)
    )

    await arsValuesCollection.replaceOne(
      { transactionId: arsScore.transactionId },
      arsScore,
      {
        upsert: true,
      }
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
    const drsValuesCollection = db.collection<DrsScore>(
      DRS_SCORES_COLLECTION(this.tenantId)
    )
    await drsValuesCollection.insertOne(drsScore)
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
}

/** Kinesis Util */

const handleLocalChangeCapture = async (primaryKey: {
  PartitionKeyID: string
  SortKeyID?: string
}) => {
  const { localHammerheadChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )
  await localHammerheadChangeCaptureHandler(primaryKey)
}
