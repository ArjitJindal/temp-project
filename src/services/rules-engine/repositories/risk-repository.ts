import { MongoClient } from 'mongodb'
import { HammerheadStackConstants } from '@cdk/constants'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { paginateQuery } from '@/utils/dynamodb'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'

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
      console.log(e)
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
}
