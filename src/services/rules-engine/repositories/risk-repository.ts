import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { HammerheadStackConstants } from '@cdk/constants'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { paginateQuery } from '@/utils/dynamodb'

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
      return result.Items ? result.Items : []
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
}
