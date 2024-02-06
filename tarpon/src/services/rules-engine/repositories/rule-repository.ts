import { StackConstants } from '@lib/constants'
import {
  DeleteCommand,
  DeleteCommandInput,
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandInput,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { omit } from 'lodash'
import { Filter, MongoClient } from 'mongodb'
import { Rule } from '@/@types/openapi-internal/Rule'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { paginateQuery } from '@/utils/dynamodb'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { traceable } from '@/core/xray'
import { RULES_COLLECTION } from '@/utils/mongodb-definitions'
import { escapeStringRegexp } from '@/utils/regex'
import { RuleSearchFilter } from '@/@types/rule/rule-actions'
import { RuleNature } from '@/@types/openapi-internal/RuleNature'

@traceable
export class RuleRepository {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
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

  async searchRules(query: string, filters: RuleSearchFilter): Promise<Rule[]> {
    const db = this.mongoDb.db()
    const rulesCollectionName = RULES_COLLECTION
    const rulesCollection = db.collection<Rule>(rulesCollectionName)
    const regexQuery = escapeStringRegexp(query)
    const fields: ReadonlyArray<keyof Rule> = [
      'name',
      'description',
      'id',
      'checksFor',
      'defaultNature',
      'labels',
      'types',
    ]

    const queryInput: Filter<Rule> = {
      $and: [
        {
          ...(filters?.filterChecksFor?.length && {
            checksFor: { $in: filters.filterChecksFor },
          }),
          ...(filters?.filterTypology?.length && {
            typologies: { $in: filters.filterTypology },
          }),
          ...(filters?.filterNature?.length && {
            defaultNature: { $in: filters.filterNature as RuleNature[] },
          }),
        },
        {
          $or: fields.map((field) => ({
            [field]: { $regex: regexQuery, $options: 'i' },
          })),
        },
      ],
    }
    const rules = await rulesCollection.find(queryInput).toArray()

    return rules
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
            ...omit(item, ['PartitionKeyID', 'SortKeyID']),
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
    const db = this.mongoDb.db()
    const rulesCollection = RULES_COLLECTION

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

    await Promise.all([
      this.dynamoDb.send(new PutCommand(putItemInput)),
      db
        .collection<Rule>(rulesCollection)
        .replaceOne({ id: rule.id }, { ...newRule }, { upsert: true }),
    ])

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
