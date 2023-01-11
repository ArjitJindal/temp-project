import { MongoClient } from 'mongodb'
import { StackConstants } from '@cdk/constants'
import _ from 'lodash'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { getRiskLevelFromScore, getRiskScoreFromLevel } from '../utils'
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
} from '@/utils/mongoDBUtils'
import { RiskClassificationConfig } from '@/@types/openapi-internal/RiskClassificationConfig'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'

const DEFAULT_CLASSIFICATION_SETTINGS: RiskClassificationScore[] = [
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
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
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

  async createOrUpdateKrsScore(userId: string, score: number): Promise<any> {
    const newKrsScoreItem: any = {
      krsScore: score,
      createdAt: Date.now(),
    }
    const primaryKey = DynamoDbKeys.KRS_VALUE_ITEM(this.tenantId, userId, '1')

    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...primaryKey,
        ...newKrsScoreItem,
        userId: userId,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))
    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(primaryKey)
    }
    return score
  }

  async createOrUpdateArsScore(
    transactionId: string,
    score: number,
    originUserId?: string,
    destinationUserId?: string
  ): Promise<any> {
    const newArsScoreItem: any = {
      arsScore: score,
      createdAt: Date.now(),
      originUserId: originUserId,
      destinationUserId: destinationUserId,
    }
    const primaryKey = DynamoDbKeys.ARS_VALUE_ITEM(
      this.tenantId,
      transactionId,
      '1'
    )

    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
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
    return score
  }

  async getArsScore(transactionId: string): Promise<ArsScore | null> {
    try {
      const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
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
      const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
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
    transactionId: string
  ): Promise<number> {
    const newDrsScoreItem: DrsScore = {
      drsScore,
      transactionId,
      createdAt: Date.now(),
      isUpdatable: true,
    }
    const primaryKey = DynamoDbKeys.DRS_VALUE_ITEM(this.tenantId, userId, '1')

    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...primaryKey,
        ...newDrsScoreItem,
        userId: userId,
      },
    }

    await this.dynamoDb.send(new PutCommand(putItemInput))

    if (process.env.NODE_ENV === 'development') {
      await handleLocalChangeCapture(primaryKey)
    }

    return drsScore
  }

  async getRiskClassificationValues(): Promise<Array<RiskClassificationScore>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',

      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.RISK_CLASSIFICATION(this.tenantId).PartitionKeyID,
      },
    }
    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)

      return result.Items && result.Items.length > 0
        ? result.Items[0].classificationValues
        : DEFAULT_CLASSIFICATION_SETTINGS
    } catch (e) {
      logger.error(e)
      return []
    }
  }

  async createOrUpdateRiskClassificationConfig(
    riskClassificationValues: RiskClassificationScore[]
  ): Promise<RiskClassificationConfig> {
    const now = Date.now()
    const newRiskClassificationValues: RiskClassificationConfig = {
      classificationValues: riskClassificationValues,
      updatedAt: now,
    }
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.RISK_CLASSIFICATION(this.tenantId, 'LATEST'), // Version it later
        ...newRiskClassificationValues,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
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
    const now = Date.now()
    const riskClassificationValues = await this.getRiskClassificationValues()

    const newDrsRiskValue: DrsScore = {
      manualRiskLevel: isUpdatable ? undefined : riskLevel,
      createdAt: now,
      isUpdatable: isUpdatable ?? true,
      drsScore: getRiskScoreFromLevel(riskClassificationValues, riskLevel),
      userId,
      transactionId: 'MANUAL_UPDATE',
    }
    const primaryKey = DynamoDbKeys.DRS_VALUE_ITEM(this.tenantId, userId, '1')
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
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

    return newDrsRiskValue
  }

  async createOrUpdateParameterRiskItem(
    parameterRiskLevels: ParameterAttributeRiskValues
  ) {
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
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
    return parameterRiskLevels
  }

  async getParameterRiskItem(
    parameter: ParameterAttributeRiskValuesParameterEnum,
    entityType: RiskEntityType
  ) {
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

    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: keyConditionExpr,

      ExpressionAttributeValues: expressionAttributeVals,
    }
    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)
      return result.Items && result.Items.length > 0
        ? _.omit(result.Items[0], ['PartitionKeyID', 'SortKeyID'])
        : null
    } catch (e) {
      logger.error(e)
      return null
    }
  }
  async getParameterRiskItems(): Promise<
    ParameterAttributeRiskValues[] | null
  > {
    const keyConditionExpr = 'PartitionKeyID = :pk'
    const expressionAttributeVals = {
      ':pk': DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(this.tenantId)
        .PartitionKeyID,
    }

    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: keyConditionExpr,

      ExpressionAttributeValues: expressionAttributeVals,
    }
    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)
      return result.Items && result.Items.length > 0
        ? (result.Items.map((item) =>
            _.omit(item, ['PartitionKeyID', 'SortKeyID'])
          ) as ParameterAttributeRiskValues[])
        : null
    } catch (e) {
      logger.error(e)
      return null
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
      {
        upsert: true,
      }
    )
    return krsScore
  }

  async getKrsValueFromMongo(userId: string): Promise<KrsScore | null> {
    const db = this.mongoDb.db()
    const krsValuesCollection = db.collection<KrsScore>(
      KRS_SCORES_COLLECTION(this.tenantId)
    )
    return await krsValuesCollection.findOne({ userId })
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

    await drsValuesCollection.replaceOne(
      { userId: drsScore.userId, transactionId: drsScore.transactionId },
      drsScore,
      { upsert: true }
    )
    return drsScore
  }

  async getDrsValueFromMongo(userId: string): Promise<DrsScore | null> {
    const db = this.mongoDb.db()
    const drsValuesCollection = db.collection<DrsScore>(
      DRS_SCORES_COLLECTION(this.tenantId)
    )
    const result = await drsValuesCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray()

    return result && result.length > 0 ? result[0] : null
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
