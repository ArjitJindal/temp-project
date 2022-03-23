import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { TarponStackConstants } from '../../../../lib/constants'
import { Rule } from '../../../@types/openapi-internal/Rule'
import { DynamoDbKeys } from '../../../core/dynamodb/dynamodb-keys'

const RULE_ID_PREFIX = 'R-'

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

  async getRules(): Promise<ReadonlyArray<Rule>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.RULE().PartitionKeyID,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }

    const result = await this.dynamoDb.query(queryInput).promise()
    return (
      result.Items?.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        parametersSchema: item.parametersSchema,
        defaultParameters: item.defaultParameters,
        defaultAction: item.defaultAction,
        ruleImplementationFilename: item.ruleImplementationFilename,
      })) || []
    )
  }
  async createOrUpdateRule(rule: Rule): Promise<Rule> {
    const existingRules = (await this.getRules()).filter(
      (existingRule) => existingRule.id !== rule.id
    )
    const lastRuleId =
      _.last(existingRules.map((existingRule) => existingRule.id).sort()) ||
      'R-0'
    const newIdNumber = parseInt(lastRuleId.split(RULE_ID_PREFIX)[1])
    const existingRuleImplementationFilenames = new Set(
      existingRules
        .map((existingRule) => existingRule.ruleImplementationFilename)
        .filter(Boolean)
    )
    if (
      existingRuleImplementationFilenames.has(rule.ruleImplementationFilename)
    ) {
      throw new Error(
        `Another rule with implementation '${rule.ruleImplementationFilename}' already exists`
      )
    }

    const ruleId = rule.id || `${RULE_ID_PREFIX}${newIdNumber + 1}`
    const now = Date.now()
    const newRule: Rule = {
      ...rule,
      id: ruleId,
      createdAt: rule.createdAt || now,
      updatedAt: rule.updatedAt || now,
    }
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.RULE(ruleId),
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
