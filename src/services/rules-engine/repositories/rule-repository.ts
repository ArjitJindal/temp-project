import { MongoClient } from 'mongodb'
import { StackConstants } from '@cdk/constants'
import { Rule } from '@/@types/openapi-internal/Rule'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { paginateQuery } from '@/utils/dynamodb'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

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
    return this.getRules(
      this.tenantId === FLAGRIGHT_TENANT_ID
        ? {}
        : {
            FilterExpression: `contains(tenantIds, :tenantId) OR attribute_not_exists(tenantIds)`,
            ExpressionAttributeValues: {
              ':tenantId': this.tenantId,
            },
          }
    )
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ReturnConsumedCapacity: 'TOTAL',
      ExpressionAttributeValues: {
        ...query.ExpressionAttributeValues,
        ':pk': DynamoDbKeys.RULE().PartitionKeyID,
      },
    }

    const result = await paginateQuery(this.dynamoDb, queryInput)
    return (
      result.Items?.map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        description: item.description,
        descriptionTemplate: item.descriptionTemplate,
        defaultParameters: item.defaultParameters,
        defaultAction: item.defaultAction,
        ruleImplementationName: item.ruleImplementationName,
        labels: item.labels,
        tenantIds:
          this.tenantId === FLAGRIGHT_TENANT_ID ? item.tenantIds : undefined,
      })) || []
    )
  }

  async createOrUpdateRule(rule: Rule): Promise<Rule> {
    const now = Date.now()
    const newRule: Rule = {
      ...rule,
      createdAt: rule.createdAt || now,
      updatedAt: now,
    }
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE(ruleId),
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.delete(deleteItemInput).promise()
  }
}
