import { MongoClient } from 'mongodb'
import { StackConstants } from '@cdk/constants'
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
  dynamoDb: AWS.DynamoDB.DocumentClient
  mongoDb: MongoClient

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: AWS.DynamoDB.DocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as AWS.DynamoDB.DocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  async getKrsScore(userId: string): Promise<any> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.KRS_VALUE_ITEM(this.tenantId, userId, '1'), // will need to query after we implement versioning
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()

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

    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.KRS_VALUE_ITEM(this.tenantId, userId, '1'),
        ...newKrsScoreItem,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }

    await this.dynamoDb.put(putItemInput).promise()

    return score
  }

  async getRiskClassification(): Promise<Array<any>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ReturnConsumedCapacity: 'TOTAL',
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
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.put(putItemInput).promise()
    return newRiskClassificationValues
  }

  async getManualDRSRiskItem(
    userId: string
  ): Promise<ManualRiskAssignmentUserState | null> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ReturnConsumedCapacity: 'TOTAL',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.DRS_RISK_DETAILS(this.tenantId, userId)
          .PartitionKeyID,
      },
    }
    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)
      return result.Items && result.Items.length > 0
        ? (result.Items[0] as ManualRiskAssignmentUserState)
        : DEFAULT_DRS_RISK_ITEM
    } catch (e) {
      logger.error(e)
      return null
    }
  }

  async createOrUpdateManualDRSRiskItem(userId: string, riskLevel: RiskLevel) {
    const now = Date.now()
    const newDRSRiskItem: any = {
      riskLevel: riskLevel,
      isManualOverride: true,
      isUpdatable: false,
      createdAt: now,
    }
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.DRS_RISK_DETAILS(this.tenantId, userId, 'LATEST'), // Version it later
        ...newDRSRiskItem,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.put(putItemInput).promise()
    return newDRSRiskItem
  }

  async createOrUpdateParameterRiskItem(
    parameterRiskLevels: ParameterAttributeRiskValues
  ) {
    const { parameter, ...paramMetaDetails } = parameterRiskLevels
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(this.tenantId, parameter), // Version it later
        schemaAttributes: paramMetaDetails,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.put(putItemInput).promise()
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
      ReturnConsumedCapacity: 'TOTAL',
      ExpressionAttributeValues: expressionAttributeVals,
    }
    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)
      return result.Items && result.Items.length > 0
        ? result.Items[0].schemaAttributes
        : null
    } catch (e) {
      logger.error(e)
      return null
    }
  }
  async getParameterRiskItems() {
    const keyConditionExpr = 'PartitionKeyID = :pk'
    const expressionAttributeVals = {
      ':pk': DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(this.tenantId)
        .PartitionKeyID,
    }

    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: keyConditionExpr,
      ReturnConsumedCapacity: 'TOTAL',
      ExpressionAttributeValues: expressionAttributeVals,
    }
    try {
      const result = await paginateQuery(this.dynamoDb, queryInput)
      return result.Items && result.Items.length > 0 ? result.Items : null
    } catch (e) {
      logger.error(e)
      return null
    }
  }
}
