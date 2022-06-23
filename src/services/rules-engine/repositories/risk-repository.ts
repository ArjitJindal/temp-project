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

  async getRiskQuantification(): Promise<Array<any>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: HammerheadStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ReturnConsumedCapacity: 'TOTAL',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.RISK_QUANTIFICATION(this.tenantId).PartitionKeyID,
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

  async createOrUpdateRiskQuantification(
    riskQuantificationValues: any
  ): Promise<any> {
    const now = Date.now()
    const newRiskQuantificationValues: any = {
      quantificationValues: riskQuantificationValues,
      createdAt: riskQuantificationValues.createdAt || now,
      updatedAt: now,
    }
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: HammerheadStackConstants.DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.RISK_QUANTIFICATION(this.tenantId, 'LATEST'), // Version it later
        ...newRiskQuantificationValues,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.put(putItemInput).promise()
    return newRiskQuantificationValues
  }
}
