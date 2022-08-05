import { MongoClient } from 'mongodb'
import { HammerheadStackConstants } from '@cdk/constants'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { paginateQuery } from '@/utils/dynamodb'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
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

const DEFAULT_DRS_RISK_ITEM: ManualRiskAssignmentUserState = {
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

  async getRiskClassification(): Promise<Array<any>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: HammerheadStackConstants.DYNAMODB_TABLE_NAME,
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
      TableName: HammerheadStackConstants.DYNAMODB_TABLE_NAME,
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
      TableName: HammerheadStackConstants.DYNAMODB_TABLE_NAME,
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
      TableName: HammerheadStackConstants.DYNAMODB_TABLE_NAME,
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
    logger.info(`PARAMETER: \n\n ${parameter}`)
    logger.info(`Meta deets: \n\n ${JSON.stringify(paramMetaDetails)}`)
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: HammerheadStackConstants.DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.RULE_PARAMETER_RISK_SCORES_DETAILS(
          this.tenantId,
          parameter
        ), // Version it later
        schemaAttributes: paramMetaDetails,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.put(putItemInput).promise()
    return parameterRiskLevels
  }

  async getParameterRiskItem(parameter?: string) {
    let keyConditionExpr, expressionAttributeVals
    if (parameter) {
      keyConditionExpr = 'PartitionKeyID = :pk AND SortKeyID = :sk'
      expressionAttributeVals = {
        ':pk': DynamoDbKeys.RULE_PARAMETER_RISK_SCORES_DETAILS(this.tenantId)
          .PartitionKeyID,
        ':sk': parameter,
      }
    } else {
      keyConditionExpr = 'PartitionKeyID = :pk'
      expressionAttributeVals = {
        ':pk': DynamoDbKeys.RULE_PARAMETER_RISK_SCORES_DETAILS(this.tenantId)
          .PartitionKeyID,
      }
    }
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: HammerheadStackConstants.DYNAMODB_TABLE_NAME,
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
}
