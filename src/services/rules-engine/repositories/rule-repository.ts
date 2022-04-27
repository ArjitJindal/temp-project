import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { TarponStackConstants } from '@cdk/constants'
import { Rule } from '@/@types/openapi-internal/Rule'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

export class RuleRepository {
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

  async getAllRules(): Promise<ReadonlyArray<Rule>> {
    return this.getRules({})
  }

  async getRuleById(ruleId: string): Promise<Rule | undefined> {
    return (
      await this.getRules({
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: {
          ':id': ruleId,
        },
      })
    )[0]
  }

  async getRulesByIds(ruleIds: string[]): Promise<ReadonlyArray<Rule>> {
    if (ruleIds.length === 0) {
      return []
    }

    const ruleParams = ruleIds.map((ruleId, index) => [`:rule${index}`, ruleId])
    const ruleKeys = ruleParams.map((params) => params[0])
    return this.getRules({
      FilterExpression: `id IN (${ruleKeys.join(',')})`,
      ExpressionAttributeValues: Object.fromEntries(ruleParams),
    })
  }

  private async getRules(
    query: Partial<AWS.DynamoDB.DocumentClient.QueryInput>
  ): Promise<ReadonlyArray<Rule>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      ...query,
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ReturnConsumedCapacity: 'TOTAL',
      ExpressionAttributeValues: {
        ...query.ExpressionAttributeValues,
        ':pk': DynamoDbKeys.RULE(this.tenantId).PartitionKeyID,
      },
    }

    const result = await this.dynamoDb.query(queryInput).promise()
    return (
      result.Items?.map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        description: item.description,
        defaultParameters: item.defaultParameters,
        defaultAction: item.defaultAction,
        ruleImplementationName: item.ruleImplementationName,
        labels: item.labels,
      })) || []
    )
  }

  async createOrUpdateRule(rule: Rule): Promise<Rule> {
    const now = Date.now()
    const newRule: Rule = {
      ...rule,
      createdAt: rule.createdAt || now,
      updatedAt: rule.updatedAt || now,
    }
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.RULE(rule.id),
        ...newRule,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.put(putItemInput).promise()
    return newRule
  }

  async deleteRule(ruleId: string): Promise<void> {
    const deleteItemInput: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE(ruleId),
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.delete(deleteItemInput).promise()
  }
}
