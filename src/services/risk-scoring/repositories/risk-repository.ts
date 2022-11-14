import { MongoClient } from 'mongodb'
import { StackConstants } from '@cdk/constants'
import _ from 'lodash'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { ArsItem, DrsItem, KrsItem } from '../types'
import { getRiskLevelFromScore } from '../utils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { paginateQuery } from '@/utils/dynamodb'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { ManualRiskAssignmentUserState } from '@/@types/openapi-internal/ManualRiskAssignmentUserState'
import { logger } from '@/core/logger'
import {
  ARS_SCORES_COLLECTION,
  DRS_SCORES_COLLECTION,
  KRS_SCORES_COLLECTION,
} from '@/utils/mongoDBUtils'

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

export const DEFAULT_DRS_RISK_ITEM: ManualRiskAssignmentUserState = {
  riskLevel: 'HIGH',
  isManualOverride: false,
  isUpdatable: true,
}

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

  async getKrsScore(userId: string): Promise<any> {
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
    return krsScoreItem
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

  async getDrsScore(userId: string): Promise<any> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.DRS_VALUE_ITEM(this.tenantId, userId, '1'), // will need to query after we implement versioning
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))

    if (!result.Item) {
      return null
    }

    const drsScoreItem = {
      ...result.Item,
    }
    delete drsScoreItem.PartitionKeyID
    delete drsScoreItem.SortKeyID
    return drsScoreItem
  }

  async createOrUpdateDrsScore(
    userId: string,
    score: number,
    transactionId: string
  ): Promise<any> {
    const newDrsScoreItem: any = {
      drsScore: score,
      transactionId: transactionId,
      createdAt: Date.now(),
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

    return score
  }

  async getRiskClassification(): Promise<Array<any>> {
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

  async createOrUpdateRiskClassification(
    riskClassificationValues: any
  ): Promise<any> {
    const now = Date.now()
    const newRiskClassificationValues: any = {
      classificationValues: riskClassificationValues,
      createdAt: riskClassificationValues.createdAt || now,
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

  async getDRSRiskItem(
    userId: string
  ): Promise<ManualRiskAssignmentUserState | null> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',

      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.DRS_RISK_DETAILS(this.tenantId, userId)
          .PartitionKeyID,
      },
    }
    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)
      const manualDRSItem =
        result.Items && result.Items.length > 0
          ? (result.Items[0] as ManualRiskAssignmentUserState)
          : DEFAULT_DRS_RISK_ITEM
      if (!manualDRSItem.isUpdatable) {
        return manualDRSItem
      }
      const drsScore = await this.getDrsScore(userId)
      const riskClassificationValues = await this.getRiskClassification()
      const drsRiskLevel = getRiskLevelFromScore(
        riskClassificationValues,
        drsScore
      )
      return {
        isManualOverride: manualDRSItem.isManualOverride,
        isUpdatable: manualDRSItem.isUpdatable,
        riskLevel: drsRiskLevel,
      }
    } catch (e) {
      logger.error(e)
      return null
    }
  }

  async createOrUpdateManualDRSRiskItem(
    userId: string,
    riskLevel: RiskLevel,
    isUpdatable?: boolean
  ) {
    const now = Date.now()
    const newDRSRiskItem: any = {
      riskLevel: riskLevel,
      isManualOverride: true,
      isUpdatable: isUpdatable ?? true,
      createdAt: now,
    }
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.DRS_RISK_DETAILS(this.tenantId, userId, 'LATEST'), // Version it later
        ...newDRSRiskItem,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
    return newDRSRiskItem
  }

  async createOrUpdateParameterRiskItem(
    parameterRiskLevels: ParameterAttributeRiskValues
  ) {
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(
          this.tenantId,
          parameterRiskLevels.parameter
        ), // Version it later
        ...parameterRiskLevels,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
    return parameterRiskLevels
  }

  async getParameterRiskItem(
    parameter: ParameterAttributeRiskValuesParameterEnum
  ) {
    const keyConditionExpr = 'PartitionKeyID = :pk AND SortKeyID = :sk'
    const expressionAttributeVals = {
      ':pk': DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(this.tenantId)
        .PartitionKeyID,
      ':sk': parameter,
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
        ? (result.Items as ParameterAttributeRiskValues[])
        : null
    } catch (e) {
      logger.error(e)
      return null
    }
  }

  /* MongoDB operations */

  async addKrsValueToMongo(krsItem: KrsItem): Promise<KrsItem> {
    const db = this.mongoDb.db()
    const krsValuesCollection = db.collection<KrsItem & { version: string }>(
      KRS_SCORES_COLLECTION(this.tenantId)
    )

    const structuredItem = { ...krsItem, version: krsItem.SortKeyID }

    await krsValuesCollection.replaceOne(
      { userId: krsItem.userId },
      structuredItem,
      {
        upsert: true,
      }
    )
    return krsItem
  }

  async getKrsValueFromMongo(
    userId: string
  ): Promise<(KrsItem & { version: string }) | null> {
    const db = this.mongoDb.db()
    const krsValuesCollection = db.collection<KrsItem & { version: string }>(
      KRS_SCORES_COLLECTION(this.tenantId)
    )
    return await krsValuesCollection.findOne({ userId })
  }

  async addArsValueToMongo(arsItem: ArsItem): Promise<ArsItem> {
    const db = this.mongoDb.db()
    const arsValuesCollection = db.collection<ArsItem & { version: string }>(
      ARS_SCORES_COLLECTION(this.tenantId)
    )

    const structuredItem = { ...arsItem, version: arsItem.SortKeyID }

    await arsValuesCollection.replaceOne(
      { transactionId: arsItem.transactionId },
      structuredItem,
      {
        upsert: true,
      }
    )
    return arsItem
  }

  async getArsValueFromMongo(
    transactionId: string
  ): Promise<(ArsItem & { version: string }) | null> {
    const db = this.mongoDb.db()
    const arsValuesCollection = db.collection<ArsItem & { version: string }>(
      ARS_SCORES_COLLECTION(this.tenantId)
    )
    return await arsValuesCollection.findOne({ transactionId })
  }
  async addDrsValueToMongo(drsItem: DrsItem): Promise<DrsItem> {
    const db = this.mongoDb.db()
    const drsValuesCollection = db.collection<DrsItem & { version: string }>(
      DRS_SCORES_COLLECTION(this.tenantId)
    )

    const structuredItem = { ...drsItem, version: drsItem.SortKeyID }

    await drsValuesCollection.replaceOne(
      { userId: drsItem.userId, transactionId: drsItem.transactionId },
      structuredItem,
      {
        upsert: true,
      }
    )
    return drsItem
  }

  async getDrsValueFromMongo(
    userId: string
  ): Promise<(DrsItem & { version: string }) | null> {
    const db = this.mongoDb.db()
    const drsValuesCollection = db.collection<DrsItem & { version: string }>(
      DRS_SCORES_COLLECTION(this.tenantId)
    )
    return await drsValuesCollection.findOne({ userId })
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
