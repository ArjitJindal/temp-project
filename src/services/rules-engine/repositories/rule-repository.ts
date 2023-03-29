import { StackConstants } from '@cdk/constants'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { Rule } from '@/@types/openapi-internal/Rule'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { paginateQuery } from '@/utils/dynamodb'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

export class RuleRepository {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.tenantId = tenantId
  }

  async getAllRules(): Promise<Array<Rule>> {
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
  ): Promise<Array<Rule>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      ...query,
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',

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
        parametersSchema: item.parametersSchema,
        defaultParameters: item.defaultParameters,
        defaultAction: item.defaultAction,
        ruleImplementationName: item.ruleImplementationName,
        labels: item.labels,
        defaultNature: item.defaultNature,
        tenantIds:
          this.tenantId === FLAGRIGHT_TENANT_ID ? item.tenantIds : undefined,
        defaultCasePriority: item.defaultCasePriority,
        typology: item.typology,
        typologyGroup: item.typologyGroup,
        typologyDescription: item.typologyDescription,
        source: item.source,
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
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.RULE(rule.id),
        ...newRule,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
    return newRule
  }

  async deleteRule(ruleId: string): Promise<void> {
    const deleteItemInput: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE(ruleId),
    }
    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
  }
}
