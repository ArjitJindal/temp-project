import { StackConstants } from '@lib/constants'
import {
  DeleteCommand,
  DeleteCommandInput,
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandInput,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb'
import _ from 'lodash'
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
    query: Partial<QueryCommandInput>
  ): Promise<Array<Rule>> {
    const queryInput: QueryCommandInput = {
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
      result.Items?.map(
        (item) =>
          ({
            ..._.omit(item, ['PartitionKeyID', 'SortKeyID']),
            tenantIds:
              this.tenantId === FLAGRIGHT_TENANT_ID
                ? item.tenantIds
                : undefined,
          } as Rule)
      ) || []
    )
  }

  async createOrUpdateRule(rule: Rule): Promise<Rule> {
    const now = Date.now()
    const newRule: Rule = {
      ...rule,
      createdAt: rule.createdAt || now,
      updatedAt: now,
    }
    const putItemInput: PutCommandInput = {
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
    const deleteItemInput: DeleteCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE(ruleId),
    }
    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
  }
}
